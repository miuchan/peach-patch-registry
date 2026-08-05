mod support;

use assert_cmd::Command;
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;
use support::TemporaryDirectory;
use wasmi::{Engine, Instance, Memory, Module, Store, TypedFunc};

fn root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).to_owned()
}

fn fixture() -> PathBuf {
    root().join("tests/fixtures/scaffold-plugin")
}

struct ScaffoldArtifact {
    _output: TemporaryDirectory,
    report: Value,
    runtime: Value,
    adapter: String,
    wasm: Option<Vec<u8>>,
}

fn scaffold(slug: &str, compile: bool) -> ScaffoldArtifact {
    let output = TemporaryDirectory::new(&format!("scaffold-{slug}"));
    let fixture = fixture();
    let mut command = Command::new("node");
    command
        .current_dir(root())
        .arg(root().join("scripts/scaffold-library-module.mjs"))
        .arg(format!("https://library.vcvrack.com/FixturePlugin/{slug}"))
        .arg("--manifest-file")
        .arg(fixture.join("plugin.json"))
        .arg("--source-dir")
        .arg(&fixture)
        .arg("--output")
        .arg(output.path())
        .arg("--use-rust-analysis")
        .env("RACK_WEB_REQUIRE_RUST_CONFIG_CALLS", "1")
        .env("RACK_WEB_REQUIRE_RUST_CONFIG_EXPANSION", "1")
        .env("RACK_WEB_REQUIRE_RUST_CONSTANT_ANALYSIS", "1")
        .env("RACK_WEB_REQUIRE_RUST_PREPROCESS", "1")
        .env("RACK_WEB_REQUIRE_RUST_STRING_EVAL", "1")
        .env("RACK_WEB_REQUIRE_RUST_NUMBER_EVAL", "1")
        .timeout(Duration::from_secs(180));
    if compile {
        command.arg("--compile");
    }
    let output_result = command.output().expect("scaffold command should run");
    assert!(
        output_result.status.success(),
        "scaffolding {slug} failed:\n{}",
        String::from_utf8_lossy(&output_result.stderr)
    );
    let report = serde_json::from_slice(&output_result.stdout)
        .expect("scaffold stdout should contain a JSON report");
    let runtime = serde_json::from_slice(
        &fs::read(output.path().join("runtime.json")).expect("runtime should be written"),
    )
    .expect("runtime should be JSON");
    let adapter =
        fs::read_to_string(output.path().join("adapter.cpp")).expect("adapter should be written");
    let wasm = compile.then(|| {
        fs::read(output.path().join("module.wasm")).expect("compiled WASM should be written")
    });
    ScaffoldArtifact {
        _output: output,
        report,
        runtime,
        adapter,
        wasm,
    }
}

struct RackRuntime {
    store: Store<()>,
    instance: Instance,
    memory: Memory,
}

impl RackRuntime {
    fn new(wasm: &[u8]) -> Self {
        let engine = Engine::default();
        let module = Module::new(&engine, wasm).expect("compiled artifact should be valid WASM");
        let mut store = Store::new(&engine, ());
        let instance = wasmi::Linker::new(&engine)
            .instantiate_and_start(&mut store, &module)
            .expect("fixture WASM should have no unresolved imports and should start");
        let memory = instance
            .get_memory(&store, "memory")
            .expect("Rack runtime should export memory");
        let initialize = instance
            .get_typed_func::<(), ()>(&store, "_initialize")
            .expect("Rack runtime should export _initialize");
        initialize
            .call(&mut store, ())
            .expect("Rack runtime should initialize");
        Self {
            store,
            instance,
            memory,
        }
    }

    fn function<Params, Results>(&self, name: &str) -> TypedFunc<Params, Results>
    where
        Params: wasmi::WasmParams,
        Results: wasmi::WasmResults,
    {
        self.instance
            .get_typed_func(&self.store, name)
            .unwrap_or_else(|error| panic!("Rack runtime should export {name}: {error}"))
    }

    fn count(&mut self, name: &str) -> i32 {
        self.function::<(), i32>(name)
            .call(&mut self.store, ())
            .unwrap_or_else(|error| panic!("{name} should run: {error}"))
    }

    fn call_i32_i32(&mut self, name: &str, first: i32, second: i32) {
        self.function::<(i32, i32), ()>(name)
            .call(&mut self.store, (first, second))
            .unwrap_or_else(|error| panic!("{name} should run: {error}"));
    }

    fn set_param(&mut self, id: i32, value: f32) {
        self.function::<(i32, f32), ()>("rack_web_set_param")
            .call(&mut self.store, (id, value))
            .expect("rack_web_set_param should run");
    }

    fn set_state(&mut self, id: i32, value: f32) {
        self.function::<(i32, f32), ()>("rack_web_set_state")
            .call(&mut self.store, (id, value))
            .expect("rack_web_set_state should run");
    }

    fn process(&mut self, frames: i32, sample_rate: f32) {
        self.function::<(i32, f32), ()>("rack_web_process")
            .call(&mut self.store, (frames, sample_rate))
            .expect("rack_web_process should run");
    }

    fn buffer_pointer(&mut self, name: &str) -> usize {
        usize::try_from(
            self.function::<(), i32>(name)
                .call(&mut self.store, ())
                .unwrap_or_else(|error| panic!("{name} should run: {error}")),
        )
        .expect("buffer pointer should be non-negative")
    }

    fn write_f32(&mut self, pointer: usize, index: usize, value: f32) {
        self.memory
            .write(&mut self.store, pointer + index * 4, &value.to_le_bytes())
            .expect("sample should fit in WASM memory");
    }

    fn read_f32(&self, pointer: usize, index: usize) -> f32 {
        let mut bytes = [0_u8; 4];
        self.memory
            .read(&self.store, pointer + index * 4, &mut bytes)
            .expect("sample should fit in WASM memory");
        f32::from_le_bytes(bytes)
    }
}

#[test]
#[ignore = "the full adapter analysis is an explicit builder gate"]
fn library_scaffold_discovers_the_registered_rack_module_contract() {
    let artifact = scaffold("Simple", false);
    assert_eq!(artifact.report["key"], "FixturePlugin/Simple");
    assert_eq!(artifact.report["source"]["file"], "src/Simple.hpp");
    assert_eq!(
        artifact.report["source"]["registrationFile"],
        "src/Simple.cpp"
    );
    assert_eq!(artifact.report["source"]["moduleClass"], "FixtureModule");
    assert_eq!(
        artifact.report["detected"]["enums"]["inputs"]["identifiers"],
        serde_json::json!(["SIGNAL_INPUT", "NUM_INPUTS"])
    );
    assert_eq!(
        artifact.report["detected"]["enums"]["outputs"]["identifiers"],
        serde_json::json!(["SIGNAL_OUTPUT", "NUM_OUTPUTS"])
    );
    assert_eq!(
        artifact.report["detected"]["config"]["bypass"],
        serde_json::json!(["SIGNAL_INPUT, SIGNAL_OUTPUT"])
    );
    assert_eq!(
        artifact.report["assessment"]["strategy"],
        "direct-rack-source-adapter"
    );
    assert_eq!(artifact.report["assessment"]["compileEligible"], true);
    assert!(artifact.adapter.contains("RACK_WEB_EXPORTS(FixtureModule)"));
    assert!(!artifact
        .adapter
        .contains("static constexpr int NUM_OUTPUTS"));
    assert_eq!(
        artifact.runtime["params"],
        serde_json::json!([{
            "id": 0,
            "name": "Level",
            "min": 0,
            "max": 1,
            "default": 1,
            "position": {"x": 29.528, "y": 59.055, "centered": true, "widget": "RoundBlackKnob"}
        }])
    );
    assert_eq!(
        artifact.runtime["inputs"][0]["position"],
        serde_json::json!({"x": 12, "y": 300, "widget": "PJ301MPort"})
    );
    assert_eq!(
        artifact.runtime["outputs"][0]["position"],
        serde_json::json!({"x": 150, "y": 330, "centered": true, "widget": "PJ301MPort"})
    );
    assert_eq!(
        artifact.runtime["bypassRoutes"],
        serde_json::json!([[0, 0]])
    );
}

fn run_single_input_fixture(slug: &str, input: f32, param: Option<f32>) -> (ScaffoldArtifact, f32) {
    let artifact = scaffold(slug, true);
    let mut runtime = RackRuntime::new(
        artifact
            .wasm
            .as_deref()
            .expect("compiled scaffold should retain its WASM"),
    );
    runtime.call_i32_i32("rack_web_set_input_connected", 0, 1);
    runtime.call_i32_i32("rack_web_set_input_channels", 0, 1);
    runtime.call_i32_i32("rack_web_set_output_connected", 0, 1);
    if let Some(value) = param {
        runtime.set_param(0, value);
    }
    let input_pointer = runtime.buffer_pointer("rack_web_input_buffer");
    runtime.write_f32(input_pointer, 0, input);
    runtime.process(1, 48_000.0);
    let output_pointer = runtime.buffer_pointer("rack_web_output_buffer");
    let output = runtime.read_f32(output_pointer, 0);
    (artifact, output)
}

#[test]
#[ignore = "requires Emscripten; run with cargo test --test scaffold_contract -- --ignored"]
fn classic_no_light_module_compiles_and_executes_in_rust_wasm_runtime() {
    let (artifact, output) = run_single_input_fixture("NoLights", 2.0, Some(1.5));
    assert_eq!(artifact.report["detected"]["counts"]["lights"], 0);
    assert_eq!(artifact.runtime["lights"], 0);
    assert!(artifact
        .adapter
        .contains("static constexpr int NUM_LIGHTS = 0"));
    assert!(!artifact.adapter.contains("UiUmbrella.hpp"));
    assert_eq!(output, 6.0);
}

#[test]
#[ignore = "requires Emscripten; run with cargo test --test scaffold_contract -- --ignored"]
fn dsp_prelude_helpers_compile_without_native_widget_code() {
    let (artifact, output) = run_single_input_fixture("Prelude", 4.0, None);
    assert_eq!(artifact.report["detected"]["prelude"], true);
    assert!(artifact.adapter.contains("T preludeScale(T value)"));
    assert!(!artifact.adapter.contains("nativeUiOnly"));
    assert!(!artifact.adapter.contains("PreludeWidget"));
    assert_eq!(output, 6.0);
}

#[test]
#[ignore = "requires Emscripten; run with cargo test --test scaffold_contract -- --ignored"]
fn rack_26_enums_expand_into_a_runnable_multi_output_adapter() {
    let artifact = scaffold("Modern", true);
    assert_eq!(artifact.report["assessment"]["compileEligible"], true);
    assert_eq!(artifact.report["detected"]["panelWidth"], 75);
    assert_eq!(artifact.runtime["width"], 75);
    assert_eq!(artifact.runtime["inputs"].as_array().unwrap().len(), 1);
    assert_eq!(artifact.runtime["outputs"].as_array().unwrap().len(), 8);
    assert_eq!(
        artifact.runtime["runtime"]["expanderMode"],
        "message-buffer"
    );
    let mut runtime = RackRuntime::new(artifact.wasm.as_deref().unwrap());
    assert_eq!(runtime.count("rack_web_output_count"), 8);
    assert_eq!(runtime.count("rack_web_light_count"), 1);
    runtime.call_i32_i32("rack_web_set_input_connected", 0, 1);
    runtime.call_i32_i32("rack_web_set_input_channels", 0, 1);
    runtime
        .function::<(i32, f32), ()>("rack_web_set_state")
        .call(&mut runtime.store, (0, 2.0))
        .expect("integer state should be accepted");
    runtime
        .function::<(i32, f32), ()>("rack_web_set_state")
        .call(&mut runtime.store, (2, 1.25))
        .expect("real state should be accepted");
    runtime
        .function::<(i32, f32), ()>("rack_web_set_state")
        .call(&mut runtime.store, (8, 0.75))
        .expect("matrix state should be accepted");
    let input_pointer = runtime.buffer_pointer("rack_web_input_buffer");
    runtime.write_f32(input_pointer, 0, 2.5);
    runtime.process(1, 48_000.0);
    let output_pointer = runtime.buffer_pointer("rack_web_output_buffer");
    for port in 0..8 {
        assert_eq!(runtime.read_f32(output_pointer, port * 16 * 128), 7.0);
    }
}

#[test]
#[ignore = "requires Emscripten; run with cargo test --test scaffold_contract -- --ignored"]
fn pure_expander_compiles_the_message_buffer_abi() {
    let artifact = scaffold("ExpanderOnly", true);
    assert_eq!(
        artifact.report["detected"]["enums"]["params"]["identifiers"]
            .as_array()
            .and_then(|items| items.last()),
        Some(&Value::String("EXP_PARAMS_LEN".to_owned()))
    );
    assert_eq!(
        artifact.runtime["runtime"]["expanderMode"],
        "message-buffer"
    );
    let mut runtime = RackRuntime::new(artifact.wasm.as_deref().unwrap());
    assert_eq!(runtime.count("rack_web_message_capacity"), 32_768);
    runtime.function::<(), ()>("rack_web_process_frame");
}

#[test]
#[ignore = "requires Emscripten; run with cargo test --test scaffold_contract -- --ignored"]
fn template_registration_preserves_arguments_ports_and_runtime_output() {
    let artifact = scaffold("TemplateRoute", true);
    assert_eq!(
        artifact.report["source"]["moduleClass"],
        "TemplateRoute<std::pair<int, int>, 1, 4>"
    );
    assert_eq!(
        artifact.report["detected"]["template"]["constants"],
        serde_json::json!({"INPUTS": 1, "OUTPUTS": 4})
    );
    assert_eq!(
        artifact.runtime["inputs"]
            .as_array()
            .unwrap()
            .iter()
            .map(|port| port["name"].as_str().unwrap())
            .collect::<Vec<_>>(),
        vec!["Input 1"]
    );
    assert_eq!(
        artifact.runtime["outputs"]
            .as_array()
            .unwrap()
            .iter()
            .map(|port| port["name"].as_str().unwrap())
            .collect::<Vec<_>>(),
        vec!["Output 1", "Output 2", "Output 3", "Output 4"]
    );
    assert!(artifact
        .adapter
        .contains("using RackWebModule = TemplateRoute<std::pair<int, int>, 1, 4>"));
    let mut runtime = RackRuntime::new(artifact.wasm.as_deref().unwrap());
    runtime.call_i32_i32("rack_web_set_input_connected", 0, 1);
    runtime.call_i32_i32("rack_web_set_input_channels", 0, 1);
    let input = runtime.buffer_pointer("rack_web_input_buffer");
    runtime.write_f32(input, 0, 3.25);
    runtime.process(1, 48_000.0);
    let output = runtime.buffer_pointer("rack_web_output_buffer");
    for port in 0..4 {
        assert_eq!(runtime.read_f32(output, port * 16 * 128), 3.25);
    }
}

#[test]
#[ignore = "requires Emscripten; run with cargo test --test scaffold_contract -- --ignored"]
fn scoped_alias_registration_resolves_the_namespaced_dsp_class() {
    let (artifact, output) = run_single_input_fixture("ScopedAlias", 2.0, Some(1.5));
    assert_eq!(
        artifact.report["source"]["moduleClass"],
        "fixture::dsp::ScopedAlias"
    );
    assert_eq!(
        artifact.report["source"]["widgetClass"],
        "fixture::ui::ScopedAliasWidget<fixture::dsp::ScopedAlias>"
    );
    assert_eq!(artifact.runtime["params"].as_array().unwrap().len(), 1);
    assert_eq!(artifact.runtime["inputs"].as_array().unwrap().len(), 1);
    assert_eq!(artifact.runtime["outputs"].as_array().unwrap().len(), 1);
    assert!(artifact
        .adapter
        .contains("RACK_WEB_EXPORTS(fixture::dsp::ScopedAlias)"));
    assert_eq!(output, 3.0);
}

#[test]
#[ignore = "requires Emscripten; run with cargo test --test scaffold_contract -- --ignored"]
fn macro_configured_shared_headers_compile_as_the_concrete_module() {
    let artifact = scaffold("MacroSwitch", true);
    assert_eq!(artifact.report["source"]["moduleClass"], "MacroSwitch");
    assert_eq!(artifact.report["source"]["file"], "src/MacroSwitchSrc.hpp");
    assert_eq!(artifact.runtime["params"].as_array().unwrap().len(), 1);
    assert_eq!(artifact.runtime["inputs"].as_array().unwrap().len(), 2);
    assert_eq!(artifact.runtime["outputs"].as_array().unwrap().len(), 1);
    assert_eq!(artifact.runtime["lights"], 2);
    assert_eq!(
        artifact.runtime["stateKeys"],
        serde_json::json!([{"key": "selected", "type": "integer"}])
    );
    assert!(artifact
        .adapter
        .contains("// FIXTURE_SELECTED_MEMBER must remain a comment"));
    for removed in [
        "nativeWidgetPosition",
        "STRUCT_NAME",
        "ROUTE_TO_ONE",
        "FixtureCenteredLabel",
    ] {
        assert!(!artifact.adapter.contains(removed));
    }
    let mut runtime = RackRuntime::new(artifact.wasm.as_deref().unwrap());
    for input in 0..2 {
        runtime.call_i32_i32("rack_web_set_input_connected", input, 1);
        runtime.call_i32_i32("rack_web_set_input_channels", input, 1);
    }
    runtime.set_param(0, 1.0);
    let input = runtime.buffer_pointer("rack_web_input_buffer");
    runtime.write_f32(input, 0, 2.0);
    runtime.write_f32(input, 16 * 128, 7.0);
    runtime.process(1, 48_000.0);
    let output = runtime.buffer_pointer("rack_web_output_buffer");
    assert_eq!(runtime.read_f32(output, 0), 7.0);
}

#[test]
#[ignore = "requires Emscripten; run with cargo test --test scaffold_contract -- --ignored"]
fn custom_model_lambda_registration_executes_in_wasm() {
    let (artifact, output) = run_single_input_fixture("CustomFactory", 3.0, Some(5.0));
    assert_eq!(artifact.report["source"]["moduleClass"], "CustomFactoryDsp");
    assert_eq!(
        artifact.report["source"]["widgetClass"],
        "CustomFactoryWidget"
    );
    assert_eq!(
        artifact.runtime["params"],
        serde_json::json!([{"id": 0, "name": "Offset", "min": -5, "max": 5, "default": 1}])
    );
    assert_eq!(output, 8.0);
}

#[test]
#[ignore = "requires Emscripten; run with cargo test --test scaffold_contract -- --ignored"]
fn widget_only_assets_are_removed_without_blocking_portable_dsp() {
    let (artifact, output) = run_single_input_fixture("WidgetAssets", 3.0, None);
    assert_eq!(artifact.report["assessment"]["compileEligible"], true);
    assert_eq!(
        artifact.report["assessment"]["blockers"],
        serde_json::json!([])
    );
    assert_eq!(
        artifact.report["detected"]["features"],
        serde_json::json!(["rack-app", "sample-rate-event"])
    );
    for removed in [
        "FixtureDisplay",
        "WidgetAssetsWidget",
        "loadFont",
        "asset::",
    ] {
        assert!(!artifact.adapter.contains(removed));
    }
    assert_eq!(output, 3.0);

    let mut runtime = RackRuntime::new(artifact.wasm.as_deref().unwrap());
    runtime.call_i32_i32("rack_web_set_input_connected", 0, 1);
    runtime.call_i32_i32("rack_web_set_input_channels", 0, 1);
    let input = runtime.buffer_pointer("rack_web_input_buffer");
    runtime.write_f32(input, 0, 3.0);
    runtime.process(1, 96_000.0);
    let output = runtime.buffer_pointer("rack_web_output_buffer");
    assert_eq!(runtime.read_f32(output, 0), 6.0);
}

#[test]
#[ignore = "requires Emscripten; run with cargo test --test scaffold_contract -- --ignored"]
fn double_ring_buffer_uses_source_sized_memory_and_processes_frames() {
    let artifact = scaffold("Buffered", true);
    assert_eq!(artifact.report["detected"]["staticMemoryBytes"], 32);
    let initial_memory = artifact.runtime["runtime"]["initialMemory"]
        .as_u64()
        .unwrap();
    assert_eq!(initial_memory % 65_536, 0);
    assert!(initial_memory >= 1_048_576 + 32);
    let mut runtime = RackRuntime::new(artifact.wasm.as_deref().unwrap());
    runtime.call_i32_i32("rack_web_set_input_connected", 0, 1);
    runtime.call_i32_i32("rack_web_set_input_channels", 0, 1);
    let input = runtime.buffer_pointer("rack_web_input_buffer");
    for (index, value) in [1.0, 2.0, 3.0, 4.0].into_iter().enumerate() {
        runtime.write_f32(input, index, value);
    }
    runtime.process(4, 48_000.0);
    let output = runtime.buffer_pointer("rack_web_output_buffer");
    assert_eq!(
        (0..4)
            .map(|index| runtime.read_f32(output, index))
            .collect::<Vec<_>>(),
        vec![0.0, 0.0, 1.0, 2.0]
    );
}

#[test]
#[ignore = "requires Emscripten; run with cargo test --test scaffold_contract -- --ignored"]
fn out_of_line_dsp_keeps_large_json_state_slots_and_lights() {
    let artifact = scaffold("OutOfLine", true);
    assert_eq!(artifact.report["detected"]["outOfLineDefinitions"], 3);
    assert_eq!(
        artifact.report["detected"]["stateKeys"]
            .as_array()
            .unwrap()
            .len(),
        40
    );
    assert_eq!(artifact.runtime["lights"], 4);
    assert!(!artifact.adapter.contains("int values = 7"));
    let mut runtime = RackRuntime::new(artifact.wasm.as_deref().unwrap());
    runtime.set_state(0, 1.25);
    runtime.set_state(39, 2.5);
    runtime.call_i32_i32("rack_web_set_input_connected", 0, 1);
    runtime.call_i32_i32("rack_web_set_input_channels", 0, 1);
    let input = runtime.buffer_pointer("rack_web_input_buffer");
    runtime.write_f32(input, 0, 3.0);
    runtime.process(1, 48_000.0);
    let output = runtime.buffer_pointer("rack_web_output_buffer");
    assert_eq!(runtime.read_f32(output, 0), 13.5);
    let light = runtime.buffer_pointer("rack_web_light_buffer");
    assert_eq!(runtime.read_f32(light, 3), 0.5);
}

#[test]
#[ignore = "requires Emscripten; run with cargo test --test scaffold_contract -- --ignored"]
fn plugin_defined_dsp_bases_are_collected_transitively() {
    let artifact = scaffold("Inherited", true);
    assert_eq!(
        artifact.report["detected"]["inheritance"],
        serde_json::json!({
            "directBase": "FixtureForwardedBase",
            "secondaryBases": [],
            "chain": [
                {"name": "FixtureDspBase", "base": "Module", "missing": false},
                {"name": "FixtureForwardingBase", "base": "FixtureDspBase", "missing": false}
            ]
        })
    );
    assert_eq!(
        artifact.report["detected"]["dependencyFiles"],
        serde_json::json!([])
    );
    assert!(artifact
        .adapter
        .contains("template <class BASE>\nstruct FixtureForwardingBase : BASE"));
    let mut runtime = RackRuntime::new(artifact.wasm.as_deref().unwrap());
    runtime.call_i32_i32("rack_web_set_input_connected", 0, 1);
    runtime.call_i32_i32("rack_web_set_input_channels", 0, 1);
    runtime.set_param(0, 1.5);
    let input = runtime.buffer_pointer("rack_web_input_buffer");
    runtime.write_f32(input, 0, 2.0);
    runtime.process(1, 48_000.0);
    let output = runtime.buffer_pointer("rack_web_output_buffer");
    assert_eq!(runtime.read_f32(output, 0), 7.125);
    runtime.write_f32(input, 0, 2.0);
    runtime.process(1, 96_000.0);
    assert_eq!(runtime.read_f32(output, 0), 14.25);
}
