mod support;

use assert_cmd::Command;
use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;
use support::TemporaryDirectory;

fn root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).to_owned()
}

fn inspect(operation: &str, arguments: Value) -> Value {
    let request = json!({"operation": operation, "arguments": arguments});
    let output = Command::new("node")
        .current_dir(root())
        .arg(root().join("scripts/inspect-scaffold.mjs"))
        .write_stdin(serde_json::to_vec(&request).expect("request should serialize"))
        .timeout(Duration::from_secs(90))
        .output()
        .expect("scaffold inspection should run");
    assert!(
        output.status.success(),
        "{operation} failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    serde_json::from_slice(&output.stdout).expect("inspection output should be JSON")
}

fn inspect_batch(requests: Value) -> Vec<Value> {
    let output = Command::new("node")
        .current_dir(root())
        .arg(root().join("scripts/inspect-scaffold.mjs"))
        .write_stdin(serde_json::to_vec(&requests).expect("requests should serialize"))
        // The complex adapter batch legitimately approaches 90 seconds on a
        // busy six-core builder. Keep enough headroom for the default parallel
        // Cargo test run so the parent does not close stdout while the Rust
        // inspector is still returning its result.
        .timeout(Duration::from_secs(180))
        .output()
        .expect("scaffold inspection batch should run");
    assert!(
        output.status.success(),
        "inspection batch failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    serde_json::from_slice(&output.stdout).expect("inspection batch output should be JSON")
}

fn inspect_text(operation: &str, arguments: Value) -> String {
    inspect(operation, arguments)
        .as_str()
        .unwrap_or_else(|| panic!("{operation} should return text"))
        .to_owned()
}

#[test]
fn generated_normalization_keeps_macros_used_by_const_initializers() {
    let normalized = inspect_text(
        "normalizeGeneratedImplementations",
        json!([concat!(
            "#define MAX_PATS 100\n",
            "struct ModuleWithPreset {\n",
            "  const int pattern = MAX_PATS - 1;\n",
            "};\n"
        )]),
    );
    assert!(normalized.contains("#define MAX_PATS 100"), "{normalized}");

    let collision = inspect_text(
        "normalizeGeneratedImplementations",
        json!([concat!(
            "#define MAX_PATS 100\n",
            "constexpr int MAX_PATS = 64;\n"
        )]),
    );
    assert!(!collision.contains("#define MAX_PATS 100"), "{collision}");
    assert!(
        collision.contains("constexpr int MAX_PATS = 64"),
        "{collision}"
    );
}

#[test]
fn voxglitch_arpseq_normalization_restores_quantizer_tables_and_dependency_order() {
    let normalized = inspect_text(
        "normalizeGeneratedImplementations",
        json!([concat!(
            "struct Quantizer {\n",
            "  static const unsigned int NUM_SCALES = 13;\n",
            "  static const bool chromaticScale[12];\n",
            "  static const bool majorScale[12];\n",
            "  static const bool minorScale[12];\n",
            "  static const bool pentatonicScale[12];\n",
            "  static const bool dorianScale[12];\n",
            "  static const bool phrygianScale[12];\n",
            "  static const bool lydianScale[12];\n",
            "  static const bool mixolydianScale[12];\n",
            "  static const bool harmonicMinorScale[12];\n",
            "  static const bool melodicMinorScale[12];\n",
            "  static const bool bluesScale[12];\n",
            "  static const bool wholeToneScale[12];\n",
            "  static const bool diminishedScale[12];\n",
            "  static const bool* scales[NUM_SCALES];\n",
            "};\n",
            "struct Page { VoltageSequencer voltage; };\n",
            "struct VoltageSequencer {};\n",
            "struct ArpSeq : Module {};\n"
        )]),
    );
    assert!(
        normalized.contains("const bool* Quantizer::scales[Quantizer::NUM_SCALES]"),
        "{normalized}"
    );
    assert_eq!(
        normalized.matches("Quantizer::chromaticScale[12]").count(),
        1,
        "{normalized}"
    );
    assert!(
        normalized.find("struct VoltageSequencer").unwrap()
            < normalized.find("struct Page").unwrap(),
        "{normalized}"
    );
    assert!(
        normalized.find("struct Page").unwrap() < normalized.find("struct ArpSeq").unwrap(),
        "{normalized}"
    );
}

#[test]
fn modllz_expander_sync_is_injected_once_into_the_native_process_method() {
    let master = inspect_text(
        "normalizeGeneratedImplementations",
        json!([concat!(
            "struct MIDIpolyMPE : Module {\n",
            "  void process(const ProcessArgs &args) override { if (!ready) return; }\n",
            "  void rackWebPullXpandPresence() {}\n",
            "  void rackWebPushXpandData() {}\n",
            "};\n"
        )]),
    );
    assert_eq!(master.matches("void process(").count(), 1, "{master}");
    assert_eq!(
        master.matches("rackWebPullXpandPresence();").count(),
        1,
        "{master}"
    );
    assert_eq!(
        master.matches("rackWebPushXpandData();").count(),
        1,
        "{master}"
    );
    assert!(
        master.find("rackWebPushXpandData();").unwrap()
            < master.find("if (!ready) return").unwrap(),
        "{master}"
    );

    let expander = inspect_text(
        "normalizeGeneratedImplementations",
        json!([concat!(
            "struct Xpand : Module {\n",
            "  void process(const ProcessArgs &args) override { render(); }\n",
            "  void rackWebPullXpandData() {}\n",
            "};\n"
        )]),
    );
    assert_eq!(expander.matches("void process(").count(), 1, "{expander}");
    assert_eq!(
        expander.matches("rackWebPullXpandData();").count(),
        1,
        "{expander}"
    );
    assert!(
        expander.find("rackWebPullXpandData();").unwrap() < expander.find("render();").unwrap(),
        "{expander}"
    );
}

#[test]
fn sort_step_publishes_live_array_events_and_guarded_drag_actions() {
    let contract = inspect_text(
        "sourceInteractionActionMethod",
        json!([{"key": "BGal256/SortStep"}, ""]),
    );
    for marker in [
        "rackWebSortStepVisual.assign(4 + size * 2, 0.f)",
        "static_cast<float>(sorterArray.currentType)",
        "rackWebSortStepVisual[4 + size + element.index] = element.elementEvent",
        "if (!active || !sorterArray.processingFinished) return",
        "const int index = encoded / 1001",
        "sorterArray.array[index] = clamp(value, 0, size)",
    ] {
        assert!(contract.contains(marker), "missing {marker}: {contract}");
    }
}

#[test]
fn jw_grids_publish_native_state_and_source_level_edit_actions() {
    let arrange = inspect_text(
        "sourceInteractionActionMethod",
        json!([{"key": "JW-Modules/Arrange"}, ""]),
    );
    for marker in [
        "std::array<float, 1056> rackWebJwGridVisual",
        "rackWebJwGridVisual[2]=static_cast<float>(resetMode?getSeqStart():seqPos)",
        "if(id>=3048&&id<3112)",
        "seqPos=clampijw(id-3048,getSeqStart(),getSeqEnd())",
        "setCellOn(index%64,index/64,(encoded%2)!=0)",
    ] {
        assert!(arrange.contains(marker), "missing {marker}: {arrange}");
    }

    let note_seq_fu = inspect_text(
        "sourceInteractionActionMethod",
        json!([{"key": "JW-Modules/NoteSeqFu"}, ""]),
    );
    for marker in [
        "std::array<float, 1056> rackWebJwGridVisual",
        "rackWebJwGridVisual[10+playhead]",
        "rackWebJwGridVisual[22+playhead]",
        "setCellOn(index%32,index/32,(encoded%2)!=0)",
    ] {
        assert!(
            note_seq_fu.contains(marker),
            "missing {marker}: {note_seq_fu}"
        );
    }

    let pres1t = inspect_text(
        "sourceInteractionActionMethod",
        json!([{"key": "JW-Modules/Pres1t"}, ""]),
    );
    for marker in [
        "rackWebJwGridVisual[5]=static_cast<float>(selectedWriteCellIdx)",
        "rackWebJwGridVisual[6]=static_cast<float>(selectedReadCellIdx)",
        "setCellOn(index%4,index/4,true,(encoded%2)==0)",
    ] {
        assert!(pres1t.contains(marker), "missing {marker}: {pres1t}");
    }

    let trigs = inspect_text(
        "sourceInteractionActionMethod",
        json!([{"key": "JW-Modules/Trigs"}, ""]),
    );
    assert!(trigs.contains("resetMode[track]?getSeqStart(track):seqPos[track]"));
    assert!(trigs.contains("setCellOn(index%16,index/16,(encoded%2)!=0)"));
}

#[test]
fn jw_generative_displays_publish_source_derived_live_geometry() {
    let divider = inspect_text(
        "sourceInteractionActionMethod",
        json!([{"key": "JW-Modules/D1v1de"}, ""]),
    );
    for marker in [
        "std::array<float, 4> rackWebD1v1deVisual",
        "rackWebD1v1deVisual[0]=static_cast<float>(ticks)",
        "rackWebD1v1deVisual[1]=static_cast<float>(getDivInt())",
        "rackWebD1v1deVisual[3]=params[COLOR_PARAM].getValue()",
    ] {
        assert!(divider.contains(marker), "missing {marker}: {divider}");
    }

    let thing = inspect_text(
        "sourceInteractionActionMethod",
        json!([{"key": "JW-Modules/ThingThing"}, ""]),
    );
    for marker in [
        "std::array<float, 12> rackWebThingThingVisual",
        "inputs[BALL_RAD_INPUT].isConnected()",
        "inputs[ZOOM_MULT_INPUT].isConnected()",
        "angle=(inputs[ANG_INPUT+index].getVoltage()+angle)*atten[index]",
        "sinf(rescale(angle,-5.f,5.f,-2.f*M_PI+M_PI/2.f,2.f*M_PI+M_PI/2.f))*zoom",
    ] {
        assert!(thing.contains(marker), "missing {marker}: {thing}");
    }

    let tree = inspect_text(
        "sourceInteractionActionMethod",
        json!([{"key": "JW-Modules/Tree"}, ""]),
    );
    for marker in [
        "std::array<float, 31> rackWebTreeVisual",
        "params[ANGLE_PARAM].getValue()/9.f+angleOffset",
        "rescale(reduceOffset,-5.f,5.f,0.05f,0.33f)",
        "params[JITTER_AMT_PARAM].getValue()+jitterOffset",
        "rackWebTreeVisual[6+index]=rnd[index]",
    ] {
        assert!(tree.contains(marker), "missing {marker}: {tree}");
    }
}

#[test]
fn flying_fader_drag_action_owns_the_native_cv_override_window() {
    let contract = inspect_text(
        "sourceInteractionActionMethod",
        json!([{"key": "Ahornberg/FlyingFader"}, ""]),
    );
    assert!(
        contract.contains("if(id==1000) faderDragged=active"),
        "{contract}"
    );
}

#[test]
fn algomorph_publishes_exact_graph_ids_aux_labels_and_randomize_actions() {
    let large = inspect_text(
        "sourceInteractionActionMethod",
        json!([{"key": "DelexanderVol1/Algomorph", "plugin": "DelexanderVol1", "model": "Algomorph"}, ""]),
    );
    for marker in [
        "std::array<float, 11> rackWebAlgomorphVisual",
        "std::bitset<16> display=algoName[scene]",
        "display.set(12+op,fullDisable)",
        "rackWebAlgomorphVisual[4]=static_cast<float>(rackWebDisplayAlgorithm(scene))",
        "auxInput[index]->activeModes",
        "auxInput[index]->lastSetMode",
        "if(id==1000)",
        "for(int scene=0; scene<3; ++scene) randomizeAlgorithm(scene)",
    ] {
        assert!(large.contains(marker), "missing {marker}: {large}");
    }

    let small = inspect_text(
        "sourceInteractionActionMethod",
        json!([{"key": "DelexanderVol1/AlgomorphSmall", "plugin": "DelexanderVol1", "model": "AlgomorphSmall"}, ""]),
    );
    assert!(small.contains("rackWebDisplayAlgorithm"), "{small}");
    assert!(!small.contains("auxInput[index]"), "{small}");

    let batch = fs::read_to_string(root().join("scripts/compile-scaffold-batch.mjs")).unwrap();
    for marker in [
        "algomorph-graphs.bin",
        "GraphData::${name}",
        "0x31474c41",
        "graphCount = 1980",
        "MiriamLibre-Regular.ttf",
    ] {
        assert!(batch.contains(marker), "missing {marker}");
    }
}

#[test]
fn biset_tree_exports_every_native_wind_deformed_branch() {
    let contract = inspect_text(
        "sourceInteractionActionMethod",
        json!([{"key": "Biset/Biset-Tree"}, ""]),
    );
    for marker in [
        "std::min(branch_count, TREE_BRANCH_MAX)",
        "branch.wpos_root.x",
        "branch.wpos_root.y",
        "branch.wpos_tail.x",
        "branch.wpos_tail.y",
        "branch.width",
    ] {
        assert!(contract.contains(marker), "missing {marker}: {contract}");
    }

    let stripped = inspect_text(
        "stripRackUiBlocks",
        json!([concat!(
            "struct TreeBranch { Vec wpos_root; Vec wpos_tail; float width; void grow(); };\n",
            "struct TreeDisplay : LedDisplay { Vec cursor; void draw(const DrawArgs& args); };"
        )]),
    );
    assert!(stripped.contains("struct TreeBranch"), "{stripped}");
    assert!(stripped.contains("Vec wpos_root"), "{stripped}");
    assert!(!stripped.contains("struct TreeDisplay"), "{stripped}");
}

#[test]
fn biset_regex_preserves_live_edits_compile_stop_and_native_status() {
    let contract = inspect_text(
        "sourceInteractionActionMethod",
        json!([{"key": "Biset/Biset-Regex"}, ""]),
    );
    for marker in [
        "std::array<float, 37> rackWebRegexVisual",
        "sequence.check_syntax()",
        "sequence.string_run==sequence.string_edit",
        "if(id>=1000&&id<1000+exp_count)",
        "else if(id==1100)",
        "sequences[id-1200].reset(true)",
    ] {
        assert!(contract.contains(marker), "missing {marker}: {contract}");
    }
    let scaffold = fs::read_to_string(root().join("scripts/scaffold-library-module.mjs")).unwrap();
    for marker in [
        "adaptBisetRegexBrowserSource",
        "const bool firstLoad=!rackWebRegexStateInitialized",
        "static bool rackWebRegexStateInitialized=false",
        "sequences[index].string_edit=next",
        "if(firstLoad&&params[PARAM_RUN_START].getValue()>0.f)",
        "kind:\"biset-regex\"",
        "FT88-Regular.ttf",
    ] {
        assert!(scaffold.contains(marker), "missing {marker}");
    }
    let condensed = inspect_text(
        "normalizeGeneratedImplementations",
        json!(["struct RegexItem {}; struct Regex : Module {}; struct RegexCondensed : Regex {}; RACK_WEB_EXPORTS(RegexCondensed)"]),
    );
    assert!(condensed.contains("struct RegexSeq {"), "{condensed}");
    assert!(condensed.contains("std::string string_edit"), "{condensed}");
}

#[test]
fn browser_sequence_assets_parse_text_and_generated_globals_remain_unique() {
    let results = inspect_batch(json!([
        {
            "operation": "browserAssetSamplerMethods",
            "arguments": [{
                "type": "text",
                "maxSamples": 1024,
                "maxSeconds": 0,
                "channels": 1,
                "mode": "sequence-text",
                "sequenceKind": "voltage"
            }]
        },
        {
            "operation": "browserAssetSamplerMethods",
            "arguments": [{
                "type": "text",
                "maxSamples": 1024,
                "maxSeconds": 0,
                "channels": 1,
                "mode": "sequence-text",
                "sequenceKind": "gate"
            }]
        },
        {
            "operation": "normalizeLegacyMidiOverrides",
            "arguments": [concat!(
                "namespace constants { extern const float gate_low_trigger { 0.1 }; }\n",
                "namespace constants { extern const float gate_low_trigger { 0.1 }; }\n"
            )]
        }
    ]));
    let voltage = results[0].as_str().unwrap();
    assert!(voltage.contains("std::strtof"));
    assert!(voltage.contains("std::vector<float> sequence"));
    assert!(voltage.contains("browser://sequence.txt"));
    let gate = results[1].as_str().unwrap();
    assert!(gate.contains("std::vector<bool> sequence"));
    assert!(gate.contains("character == '0'"));
    assert_eq!(
        results[2]
            .as_str()
            .unwrap()
            .matches("gate_low_trigger")
            .count(),
        1
    );
}

#[test]
fn native_signal_metadata_preserves_source_geometry_color_and_stroke_width() {
    let source = concat!(
        "struct EO_Display : TransparentWidget {\n",
        "  EO_Display() { box.size = Vec(120, 60); }\n",
        "  void draw(const DrawArgs& args) override {\n",
        "    nvgStrokeColor(args.vg, nvgRGBA(0x44, 0xff, 0x88, 0xff));\n",
        "    nvgStrokeWidth(args.vg, 1.75f);\n",
        "  }\n",
        "};\n",
        "struct FixtureWidget : ModuleWidget { FixtureWidget(Module* module) {\n",
        "  auto* display = new EO_Display();\n",
        "  display->box.pos = Vec(12, 34);\n",
        "  addChild(display);\n",
        "} };\n"
    );
    let results = inspect_batch(json!([
        {
            "operation": "widgetDisplayRects",
            "arguments": [source, "EO_Display", {}]
        },
        {
            "operation": "nativeSignalStyle",
            "arguments": [source, ["EO_Display"]]
        },
        {
            "operation": "nativeSignalVisual",
            "arguments": [
                {"key": "SubmarineFree/EO-102"}, source, {}, {"x": 180, "y": 380},
                [{"id": 2}], []
            ]
        }
    ]));
    assert_eq!(
        results[0],
        json!([{"x": 12, "y": 34, "width": 120, "height": 60}])
    );
    assert_eq!(
        results[1],
        json!({"colors": ["#44ff88"], "strokeWidths": [1.75]})
    );
    assert_eq!(results[2]["kind"], "native-signal");
    assert_eq!(results[2]["sources"], json!([{"kind": "input", "id": 2}]));
    assert_eq!(results[2]["x"], 12);
    assert_eq!(results[2]["strokeWidths"], json!([1.75]));
}

#[test]
fn preprocessing_and_preludes_consume_rust_ranges_without_losing_active_defines() {
    let source = concat!(
        "😀\n\n#include \"Dsp.hpp\"\n#pragma once\n#define ACTIVE_GAIN 2\n",
        "// #define COMMENTED_GAIN 9\n// #include \"Comment.hpp\"\n",
        "float apply(float value) { return value * ACTIVE_GAIN; }\n"
    );
    assert_eq!(
        inspect("sourceWithoutIncludes", json!([source])),
        json!(concat!(
            "😀\n\n\n#define ACTIVE_GAIN 2\n\n\n",
            "float apply(float value) { return value * ACTIVE_GAIN; }"
        ))
    );

    let module_source = concat!(
        "#include \"Dsp.hpp\"\n#pragma once\n#define ACTIVE_GAIN 2\n",
        "// #define COMMENTED_GAIN 9\n",
        "float helper(float value) { return value * ACTIVE_GAIN; }\n",
        "struct PreludeModule : Module {};\n"
    );
    let prelude = inspect_text("modulePrelude", json!([module_source, "PreludeModule"]));
    assert!(prelude.contains("#define ACTIVE_GAIN 2"));
    assert!(prelude.contains("float helper(float value)"));
    assert!(!prelude.contains("#include"));
    assert!(!prelude.contains("#pragma"));
    assert!(!prelude.contains("COMMENTED_GAIN"));
}

#[test]
fn rust_callable_and_registration_facts_preserve_concrete_cpp_identity() {
    let callables = inspect(
        "outOfLineCallableKeys",
        json!([concat!(
            "namespace fixture {\n",
            "struct Engine { Engine(); ~Engine(); void render(); static int count; };\n",
            "Engine::Engine() {}\nEngine::~Engine() {}\n",
            "void Engine::render() {}\nint Engine::count = 1;\n}"
        )]),
    );
    assert_eq!(
        callables,
        json!(["Engine::Engine", "Engine::~Engine", "Engine::render"])
    );

    let registration_source = concat!(
        "template <typename Circuit> struct SlothModule : Module {};\n",
        "namespace Analog { struct TorporSlothCircuit {}; }\n",
        "using SlothTorporModule = SlothModule<Analog::TorporSlothCircuit>;\n",
        "struct SlothTorporWidget {};\n",
        "Model* modelSlothTorpor = createModel<SlothTorporModule, SlothTorporWidget>(\"SlothTorpor\");"
    );
    assert_eq!(
        inspect(
            "modelRegistrations",
            json!([registration_source, "SlothTorpor.cpp"])
        ),
        json!([{
            "file": "SlothTorpor.cpp",
            "moduleClass": "SlothModule<Analog::TorporSlothCircuit>",
            "registeredModuleClass": "SlothTorporModule",
            "widgetClass": "SlothTorporWidget",
            "slug": "SlothTorpor",
            "registrationNamespace": []
        }])
    );
}

#[test]
fn native_visual_adapters_publish_browser_abi_instead_of_desktop_state() {
    let trigger = inspect_text(
        "adaptMlTrigBufBrowserSource",
        json!([concat!(
            "struct TrigBuf : Module {\n",
            "  TrigBuf() { defaults.setModule(\"TrigBuf\"); armOnLoad = defaults.getBool(\"ArmOnLoad\"); }\n",
            "  SettingsHandler defaults;\n};\nRACK_WEB_EXPORTS(TrigBuf)"
        )]),
    );
    assert!(!trigger.contains("defaults."));
    assert!(!trigger.contains("SettingsHandler defaults"));
    assert!(trigger.contains("armOnLoad = false;"));
    assert!(trigger.contains("RACK_WEB_EXPORTS(TrigBuf)"));

    let corrupter = inspect_text(
        "adaptNoSuchDeviceCorrupterBrowserSource",
        json!(["struct CorrupterModule : Module {};\nRACK_WEB_EXPORTS(CorrupterModule)"]),
    );
    for marker in [
        "std::array<float, 5 + kWaveBins> rackWebDisplay",
        "wave_peaks[bin]",
        "persistent.freeze_enabled",
        "RACK_WEB_EXPORTS(RackWebCorrupterModule)",
    ] {
        assert!(corrupter.contains(marker), "missing {marker}");
    }

    let tapestry = inspect_text(
        "adaptTapestryBrowserSource",
        json!(["struct Tapestry : Module {};\nRACK_WEB_EXPORTS(Tapestry)"]),
    );
    for marker in [
        "rackWebWaveBins = 90",
        "rackWebMaxSplices = 300",
        "getPlayheadPosition",
        "splices[index].startFrame",
        "deleteMarkerAtIndex",
        "onSpliceTrigger",
        "RACK_WEB_EXPORTS(RackWebTapestryModule)",
    ] {
        assert!(tapestry.contains(marker), "missing {marker}");
    }
}

#[test]
fn signal_function_set_adapters_publish_live_displays_and_pointer_actions() {
    let requests = json!([
        {
            "operation": "adaptSignalFunctionSetBrowserSource",
            "arguments": ["struct Band : Module {};\nRACK_WEB_EXPORTS(Band)", "Band"]
        },
        {
            "operation": "adaptSignalFunctionSetBrowserSource",
            "arguments": ["struct Beat : Module {};\nRACK_WEB_EXPORTS(Beat)", "Beat"]
        },
        {
            "operation": "adaptSignalFunctionSetBrowserSource",
            "arguments": ["struct Gravity : Module {};\nRACK_WEB_EXPORTS(Gravity)", "Gravity"]
        },
        {
            "operation": "signalFunctionSetVisuals",
            "arguments": ["Muse"]
        },
        {
            "operation": "adaptSignalFunctionSetBrowserSource",
            "arguments": ["namespace sfs {\nstatic const Scale SCALES[] = {};\n}\nnamespace sfs {\nstruct Scale { int size; };\n}\nstruct Chance : Module {};\nRACK_WEB_EXPORTS(Chance)", "Chance"]
        },
        {
            "operation": "adaptSignalFunctionSetBrowserSource",
            "arguments": ["namespace sfs { struct Bell : Module {}; }\nRACK_WEB_EXPORTS(sfs::Bell)", "Operator"]
        },
        {
            "operation": "adaptSignalFunctionSetBrowserSource",
            "arguments": ["#define N (1 << LG_N)\nstruct Shift : Module {};\nRACK_WEB_EXPORTS(Shift)", "Shift"]
        },
        {
            "operation": "adaptSignalFunctionSetBrowserSource",
            "arguments": ["#define TANH_N_SAMPLES 8\nextern int32_t tanhtab[TANH_N_SAMPLES << 1];\nstruct FmAlgorithm { int ops[6]; };\nconst FmAlgorithm algorithms[32] = {};\nstruct OpEnvEngine { struct Impl; };\nOpEnvEngine::OpEnvEngine() : p_(new Impl) {}\nstruct OpEnv : Module {};\nRACK_WEB_EXPORTS(OpEnv)", "OpEnv"]
        },
        {
            "operation": "adaptSignalFunctionSetBrowserSource",
            "arguments": ["#include \"rack_web_export.hpp\"\ntemplate<typename T> inline static T min(const T& a, const T& b) { return a < b ? a : b; }\ntemplate<typename T> inline static T max(const T& a, const T& b) { return a > b ? a : b; }\nvoid neon_fm_kernel(int);\nvoid neon_fm_kernel(int) { int neonOnly = 1; }\nint ScaleRate(int, int) { return 1; }\nint ScaleRate(int, int) { return 2; }\nint32_t tanhtab[TANH_N_SAMPLES << 1];\n#define TANH_N_SAMPLES 8\nextern int32_t tanhtab[TANH_N_SAMPLES << 1];\nstruct BellEngineImpl;\nBellEngine::BellEngine() : p_(new BellEngineImpl) {}\nstruct Operator : Module {};\nRACK_WEB_EXPORTS(Operator)", "Operator"]
        },
        {
            "operation": "adaptSignalFunctionSetBrowserSource",
            "arguments": ["#define N (1 << LG_N)\nstruct Wave : Module {};\nRACK_WEB_EXPORTS(Wave)", "Wave"]
        },
        {
            "operation": "adaptSignalFunctionSetBrowserSource",
            "arguments": ["#include \"rack_web_export.hpp\"\n#define R (1 << 29)\nDRWAV_API const char* drwav_version_string(void);\nstruct SfzRegion {};\nstruct Play : Module {};\nRACK_WEB_EXPORTS(Play)", "Play"]
        },
        {
            "operation": "adaptSignalFunctionSetBrowserSource",
            "arguments": ["#include \"rack_web_export.hpp\"\nDRWAV_API const char* drwav_version_string(void);\nusing PhaseSampleT = float;\nstruct SampleData {};\nstruct Phase : Module {};\nRACK_WEB_EXPORTS(Phase)", "Phase"]
        },
        {
            "operation": "adaptSignalFunctionSetBrowserSource",
            "arguments": ["#include \"rack_web_export.hpp\"\nDRWAV_API const char* drwav_version_string(void);\nstruct NoteParamQuantity : ParamQuantity {};\nstruct Record : Module {};\nRACK_WEB_EXPORTS(Record)", "Record"]
        }
    ]);
    let results = inspect_batch(requests);
    let band = results[0].as_str().expect("Band adapter should be text");
    assert!(band.contains("spectrum[bin]"));
    assert!(band.contains("RACK_WEB_EXPORTS(RackWebSignalFunctionSetBand)"));

    let beat = results[1].as_str().expect("Beat adapter should be text");
    for marker in [
        "rackWebPatternStride",
        "rackWebDecodeAction",
        "patterns[pattern].velocities[step]",
        "RACK_WEB_EXPORTS(RackWebSignalFunctionSetBeat)",
    ] {
        assert!(beat.contains(marker), "missing {marker}");
    }

    let gravity = results[2].as_str().expect("Gravity adapter should be text");
    for marker in [
        "billiardsLaunch",
        "dragTargetX",
        "dispGateFlash",
        "hmPassRing[node]",
        "rackWebSampleTrail",
        "sectorOut[sector]",
    ] {
        assert!(gravity.contains(marker), "missing {marker}");
    }

    let visuals = results[3]
        .as_array()
        .expect("Muse should publish display and scope visuals");
    assert_eq!(visuals.len(), 2);
    assert_eq!(visuals[0]["kind"], "signal-function-set");
    assert_eq!(visuals[0]["actionBase"], 100_000);
    assert_eq!(visuals[1]["model"], "MuseScope");

    let scale = results[4]
        .as_str()
        .expect("Scale adapter repair should be text");
    assert!(
        scale.find("struct Scale").expect("Scale type")
            < scale.find("static const Scale").expect("Scale table")
    );
    assert_eq!(scale.matches("struct Scale").count(), 1);

    let qualified = results[5]
        .as_str()
        .expect("qualified Operator adapter should be text");
    assert!(qualified.contains("RackWebSignalFunctionSetOperator : sfs::Bell"));

    let shift = results[6]
        .as_str()
        .expect("Shift macro repair should be text");
    assert!(shift.contains("#undef N\nstruct Shift"));

    let op_env = results[7]
        .as_str()
        .expect("OpEnv adapter repair should be text");
    assert!(op_env.contains("int32_t tanhtab[TANH_N_SAMPLES << 1]{};"));
    assert!(op_env.contains("static constexpr int OUT_BUS_ADD = 1 << 2;"));
    assert!(op_env.contains("struct OpEnvEngine::Impl {"));

    let operator = results[8]
        .as_str()
        .expect("Operator adapter repair should be text");
    assert!(operator.contains("class Controllers;\nstruct BellEngineImpl;"));
    assert!(operator.contains("struct BellEngineImpl {"));
    assert!(operator.contains("int32_t tanhtab[TANH_N_SAMPLES << 1]{};"));
    assert!(operator.contains("#include \"bell_patches.h\""));
    assert!(!operator.contains("inline static T min"));
    assert!(!operator.contains("inline static T max"));
    assert!(!operator.contains("neonOnly"));
    assert!(operator.contains("void neon_fm_kernel(int);"));
    assert!(operator.contains("return 1"));
    assert!(!operator.contains("return 2"));
    assert!(operator.contains("12.567f + 26.f"));

    let wave = results[9]
        .as_str()
        .expect("Wave macro repair should be text");
    let play = results[10]
        .as_str()
        .expect("Play dr_wav repair should be text");
    assert!(play.contains("#define DRWAV_API extern"));
    assert!(play.contains("#define DRWAV_PRIVATE static"));
    assert!(play.contains("#define DR_WAV_IMPLEMENTATION"));
    assert!(play.contains("#define DRWAV_MAX_SAMPLE_RATE 384000"));
    assert!(play.contains("#define DRWAV_MAX_CHANNELS 256"));
    assert!(play.contains("#define DRWAV_MAX_BITS_PER_SAMPLE 64"));
    assert!(play.contains("#undef R"));
    assert!(play.contains("struct SfzRegion"));
    assert!(play.contains("static inline int gridNoteAt"));
    let phase = results[11]
        .as_str()
        .expect("Phase constant repair should be text");
    assert!(phase.contains("MAX_SAMPLE_LENGTH = 48000 * 60 * 10"));
    assert!(phase.contains("MAX_REC_LENGTH = 48000 * 60"));
    let record = results[12]
        .as_str()
        .expect("Record grid repair should be text");
    assert!(record.contains("static const int GRID_COLS = 12, GRID_ROWS = 8"));
    assert!(record.contains("static inline int gridNoteAt"));
    assert!(wave.contains("#undef N\nstruct Wave"));
}

#[test]
fn browser_history_and_algomorph_adapters_keep_dsp_state_only() {
    let source = concat!(
        "void process() {\n",
        "  AlgorithmSceneChangeAction<Module>* h = new AlgorithmSceneChangeAction<Module>;\n",
        "  h->moduleId = id;\n  h->oldScene = baseScene;\n",
        "  baseScene = nextScene;\n  APP->history->push(h);\n}"
    );
    let stripped = inspect_text("stripHostHistoryStatements", json!([source]));
    assert!(!stripped.contains("APP->history"));
    assert!(!stripped.contains("AlgorithmSceneChangeAction"));
    assert!(!stripped.contains("h->"));
    assert!(stripped.contains("baseScene = nextScene"));

    let adapted = inspect_text(
        "adaptAlgomorphBrowserSource",
        json!([concat!(
            "static const GraphData GRAPH_DATA;\n",
            "static const std::string AuxInputModeLabels[AuxInputModes::NUM_MODES] = {\"Morph\"};\n",
            "static const std::string AuxKnobModeLabels[AuxKnobModes::NUM_MODES] = {\"Gain\"};\n",
            "struct AuxInputModes { static const int NUM_MODES = 1; };\n",
            "struct AuxKnobModes { static const int NUM_MODES = 1; };\n",
            "struct FMDelexanderSettings { FMDelexanderSettings(); };\n",
            "FMDelexanderSettings pluginSettings;\n",
            "void init() {\n",
            "  for (int i = 0; i < 1980; i++) { graphAddressTranslation[(int)GRAPH_DATA.xNodeData[i][0]] = i; }\n",
            "  enabled = pluginSettings.glowingInkDefault;\n}"
        )]),
    );
    assert!(!adapted.contains("GraphData"));
    assert!(!adapted.contains("GRAPH_DATA"));
    assert!(
        adapted.find("struct AuxInputModes").unwrap() < adapted.find("AuxInputModeLabels").unwrap()
    );
    assert!(
        adapted.find("struct AuxKnobModes").unwrap() < adapted.find("AuxKnobModeLabels").unwrap()
    );
    assert!(adapted.contains("FMDelexanderSettings() = default;"));
    assert!(adapted.contains("::pluginSettings.glowingInkDefault"));
}

#[test]
fn embedded_wave_adapters_remove_runtime_file_dependencies() {
    let wco = inspect_text(
        "adaptEdgeWcoBrowserSource",
        json!([
            concat!(
                "struct WCO_Osc {\n",
                "  std::string plug_directory = asset::plugin(pluginInstance, \"res/waves/\");\n",
                "  float wave[64][256] = {{0}};\n  bool tab_loaded = false;\n  void LoadWaves();\n};\n",
                "void WCO_Osc::LoadWaves() {\n",
                "  drwav_open_file_and_read_pcm_frames_f32((plug_directory + \"00.wav\").c_str(), nullptr, nullptr, nullptr);\n",
                "  tab_loaded = true;\n}"
            ),
            null,
            [[0, 0.5, -1]]
        ]),
    );
    assert!(wco.contains("rackWebEdgeWcoWaves[1][3]"));
    assert!(wco.contains("{0,0.5,-1}"));
    assert!(!wco.contains("asset::plugin"));
    assert!(!wco.contains("drwav_open_file"));
    assert!(wco.contains("wave[waveIndex][sampleIndex] = rackWebEdgeWcoWaves"));

    let rush = inspect_text(
        "adaptEdgeKRushBrowserSource",
        json!([
            concat!(
                "struct Diode {\n",
                "  std::string plug_directory = asset::plugin(pluginInstance, \"res/waves2/\");\n",
                "  float wave[64][256] = {{0}};\n  bool tab_loaded = false;\n",
                "  void LoadWaves() {\n",
                "    drwav_open_file_and_read_pcm_frames_f32((plug_directory + \"00.wav\").c_str(), nullptr, nullptr, nullptr);\n",
                "    tab_loaded = true;\n  }\n};"
            ),
            null,
            [[-0.5, 0, 0.25]]
        ]),
    );
    assert!(rush.contains("rackWebEdgeKRushWaves[1][3]"));
    assert!(rush.contains("{-0.5,0,0.25}"));
    assert!(!rush.contains("asset::plugin"));
    assert!(!rush.contains("drwav_open_file"));
    assert!(rush.contains("wave[waveIndex][sampleIndex] = rackWebEdgeKRushWaves"));
}

#[test]
fn code_position_detection_ignores_comments_and_literals() {
    let source = concat!(
        "int active = 1;\n",
        "// int lineComment = 2;\n",
        "const char* text = \"int stringCode = 3;\";\n",
        "/* int blockComment = 4; */\n",
        "char value = 'x';\n"
    );
    for marker in ["active", "text", "value"] {
        let index = source.find(marker).unwrap();
        assert_eq!(inspect("isCodePosition", json!([source, index])), true);
    }
    for marker in ["lineComment", "stringCode", "blockComment"] {
        let index = source.find(marker).unwrap();
        assert_eq!(inspect("isCodePosition", json!([source, index])), false);
    }
}

#[test]
fn madzine_and_ml_adapters_expose_source_specific_browser_controls() {
    let results = inspect_batch(json!([
        {
            "operation": "adaptMadzineNigoqBrowserSource",
            "arguments": [concat!(
                "struct NIGOQ {\n  static constexpr int SCOPE_BUFFER_SIZE = 256;\n",
                "  struct ScopePoint { float min; float max; };\n",
                "  ScopePoint finalBuffer[SCOPE_BUFFER_SIZE];\n",
                "  ScopePoint modBuffer[SCOPE_BUFFER_SIZE];\n};\nRACK_WEB_EXPORTS(NIGOQ)"
            )]
        },
        {
            "operation": "adaptMadzineWeiiiDocumentaBrowserSource",
            "arguments": ["struct WeiiiDocumenta {};\nRACK_WEB_EXPORTS(WeiiiDocumenta)"]
        },
        {
            "operation": "adaptMadzineUniversalRhythmBrowserSource",
            "arguments": ["struct UniversalRhythm {};\nRACK_WEB_EXPORTS(UniversalRhythm)"]
        },
        {
            "operation": "adaptMadzineUniRhythmBrowserSource",
            "arguments": ["struct UniRhythm {};\nRACK_WEB_EXPORTS(UniRhythm)"]
        },
        {
            "operation": "adaptMadzineLaunchpadBrowserSource",
            "arguments": ["struct Launchpad {};\nRACK_WEB_EXPORTS(Launchpad)"]
        },
        {
            "operation": "adaptMlArpeggiatorBrowserSource",
            "arguments": ["struct Arpeggiator {};\nRACK_WEB_EXPORTS(Arpeggiator)"]
        },
        {
            "operation": "adaptMadzineTheKickBrowserSource",
            "arguments": ["struct theKICK {};\nRACK_WEB_EXPORTS(theKICK)"]
        }
    ]));
    let texts = results
        .iter()
        .map(|value| value.as_str().expect("adapter should be text"))
        .collect::<Vec<_>>();
    for marker in [
        "struct RackWebNigoqModule : NIGOQ",
        "std::array<float, SCOPE_BUFFER_SIZE * 2> rackWebScope",
        "finalBuffer[index].max",
        "modBuffer[index].max",
        "RACK_WEB_EXPORTS(RackWebNigoqModule)",
    ] {
        assert!(texts[0].contains(marker), "missing {marker}");
    }
    assert!(!texts[0].ends_with("RACK_WEB_EXPORTS(NIGOQ)"));
    for marker in [
        "struct RackWebWeiiiDocumentaModule : WeiiiDocumenta",
        "rackWebWavePoints = 170",
        "rackWebMaxSlices = 64",
        "params[LOOP_END_PARAM].getValue()",
        "slices[index].startSample",
        "voices[index].playbackPosition",
    ] {
        assert!(texts[1].contains(marker), "missing {marker}");
    }
    for marker in [
        "struct RackWebUniversalRhythmModule : UniversalRhythm",
        "std::array<float, 12 + 8 * rackWebSteps> rackWebPattern",
        "roleLengths[role]",
        "currentSteps[role]",
        "TIMELINE_STYLE_CV_INPUT + role * 4",
    ] {
        assert!(texts[2].contains(marker), "missing {marker}");
    }
    for marker in [
        "struct RackWebUniRhythmModule : UniRhythm",
        "std::array<float, 12 + 8 * rackWebSteps> rackWebPattern",
        "pattern.hasOnsetAt(step)",
    ] {
        assert!(texts[3].contains(marker), "missing {marker}");
    }
    for marker in [
        "struct RackWebLaunchpadModule : Launchpad",
        "rackWebCells * (rackWebCellStride + rackWebWavePoints)",
        "onCellClick(cell / rackWebColumns, cell % rackWebColumns)",
        "playbackSpeed = knobToSpeed",
    ] {
        assert!(texts[4].contains(marker), "missing {marker}");
    }
    for marker in [
        "struct RackWebMlArpeggiatorModule : Arpeggiator",
        "1 + rackWebChannels * 3",
        "order_display[channel]",
        "range_display[channel]",
        "mode_display[channel]",
    ] {
        assert!(texts[5].contains(marker), "missing {marker}");
    }
    for marker in [
        "struct RackWebTheKickModule : theKICK",
        "rackWebAssetSampleCapacity = 48000 * 10 * 2",
        "sampleTable[index] = crossfade",
        "modeValue = (modeValue + 1) % 4",
        "clearSample()",
    ] {
        assert!(texts[6].contains(marker), "missing {marker}");
    }
}

#[test]
fn host_specific_adapters_retain_dsp_and_remove_filesystem_or_widget_state() {
    let results = inspect_batch(json!([
        {
            "operation": "adaptNativeUiBackedExpressionFields",
            "arguments": [concat!(
                "bool fieldsLoaded = false; std::string texts[9]; ",
                "void dataFromJson(json_t* rootJ) override { texts[0] = json_string_value(json_object_get(rootJ, \"expr0\")); } ",
                "void processStrings() { expressions[0] = te_compile(texts[0].c_str(), vars, 13, 0); }"
            ), ["fields"]]
        },
        {
            "operation": "adaptDanTSynthAocrBrowserSource",
            "arguments": [concat!(
                "namespace DANT {\n",
                "inline void saveSettings(json_t* rootJ) { auto path = rack::asset::user(\"settings.json\"); }\n",
                "inline json_t* readSettings() { auto path = rack::asset::user(\"settings.json\"); return json_object(); }\n",
                "inline void saveUserSettings() { saveSettings(json_object()); }\n",
                "inline void loadUserSettings() { readSettings(); }\n}\n",
                "struct AocrModule : Module {\n",
                "  json_t* dataToJson() override { DANT::saveUserSettings(); return json_object(); }\n",
                "  void dataFromJson(json_t* rootJ) override { DANT::loadUserSettings(); }\n",
                "  void process(const ProcessArgs&) override { auto clipped = rack::simd::clamp(inputs[0].getVoltage(), DANT::M_TEN, DANT::P_TEN); outputs[0].setVoltage(clipped[0]); }\n};"
            )]
        },
        {
            "operation": "adaptFv1EmuBrowserSource",
            "arguments": [concat!(
                "#include \"rack_web_export.hpp\"\n#include \"../fv1-emu/FV1emu.hpp\"\n",
                "#include \"FV1emu.hpp\"\n#include \"FV1.hpp\"\n",
                "struct FV1EmuModule : Module {\n",
                "  std::string programs_json = asset::plugin(pluginInstance, \"fx/programs.json\");\n",
                "  FV1EmuModule() { loadFx(asset::plugin(pluginInstance, \"fx/demo.spn\")); }\n",
                "  bool loadPrograms(const std::string &programs_json) { if (system::isFile(programs_json)) return false; return true; }\n",
                "  void loadFx(const std::string &file, bool scanDir = true) { fx.load(file); filesInPath = system::getEntries(file); }\n",
                "  int selectedProgram; std::string lastPath, display; std::vector<std::string> filesInPath; FakeFx fx; std::vector<int> categories, programs;\n};"
            ), "sof 1,0\nwrax dacl,0\n"]
        },
        {
            "operation": "adaptClonotribeBrowserBody",
            "arguments": ["DrumProcessor drumProcessor; RibbonController ribbonController; Clonotribe() : filterProcessor(ms20Filter), ribbonController(this) {}"]
        },
        {
            "operation": "adaptHoyerScanningDivisionBrowserBody",
            "arguments": ["dsp::SchmittTrigger inputs[8]; bool edge = inputs[i].isHigh(); int sync = engine.syncCheck[c+i].processEvent(0.f); engine.phase[c + i] = 0.f; float voltage = getInput(SYNC_INPUT).getVoltage();"]
        },
        {
            "operation": "adaptRackNesBrowserSource",
            "arguments": [concat!(
                "// header\n#include \"rack_web_export.hpp\"\nconst bool true = 1;\n",
                "namespace NES { static constexpr int broken = MissingType::value; }\n",
                "struct CVButtonTrigger { bool process(float, float) { return false; } };\n",
                "struct RackNES : Module {};\nRACK_WEB_EXPORTS(RackNES)"
            )]
        },
        {
            "operation": "adaptLessMessBrowserSource",
            "arguments": [concat!(
                "struct LessMess { std::string labels[9]; };\n",
                "json_t *LessMess::dataToJson() { json_t *rootJ = json_object(); std::string tmps; ",
                "json_object_set_new(rootJ, \"label0\", json_string(tmps.c_str())); return rootJ; }"
            )]
        }
    ]));
    let texts = results
        .iter()
        .map(|value| value.as_str().expect("adapter should be text"))
        .collect::<Vec<_>>();
    assert!(texts[0].contains("bool fieldsLoaded = true;"));
    assert_eq!(texts[0].matches("processStrings();").count(), 1);
    for removed in [
        "asset::user",
        "saveUserSettings",
        "loadUserSettings",
        "saveSettings",
        "readSettings",
    ] {
        assert!(!texts[1].contains(removed));
    }
    assert!(texts[1].contains("outputs[0].setVoltage"));
    for marker in [
        "rackWebFv1DemoSpn",
        "sof 1,0\\nwrax dacl,0\\n",
        "programs_json = \"builtin://programs.json\"",
        "loadFx(\"builtin://demo.spn\")",
        "fx.loadFromSPN(\"demo.spn\", rackWebFv1DemoSpn)",
    ] {
        assert!(texts[2].contains(marker), "missing {marker}");
    }
    for removed in ["asset::plugin", "system::isFile", "system::getEntries"] {
        assert!(!texts[2].contains(removed));
    }
    assert!(!texts[3].contains("RibbonController ribbonController"));
    assert!(texts[3].contains("Clonotribe() : filterProcessor(ms20Filter)"));
    assert!(texts[4].contains("dsp::SchmittTrigger rackWebRatioInputs[8]"));
    assert!(texts[4].contains("engine.syncCheck[i].processEvent"));
    assert!(!texts[4].contains("inputs["));
    assert!(texts[5].contains("#include \"nes/emulator.hpp\""));
    assert!(texts[5].contains("modelInputGenie = &rackWebHostModel0"));
    assert!(!texts[5].contains("MissingType"));
    assert!(texts[6].contains("json_string(labels[index].c_str())"));
    assert!(!texts[6].contains("std::string tmps"));
}

#[test]
fn delay_and_memory_adapters_bound_browser_wasm_memory_without_shortening_audio_ranges() {
    let results = inspect_batch(json!([
        {
            "operation": "estimatedStaticMemory",
            "arguments": ["class TapeLoop { std::vector<float> buffer; void resize() { buffer.resize(bufferLength); } };"]
        },
        {
            "operation": "adaptPortlandWeatherBrowserSource",
            "arguments": ["#define DELAY_LINE_SIZE 1<<24\n#define HISTORY_SIZE (1<<24)\nvoid process(const ProcessArgs &args) override {\n  run();\n}\n"]
        },
        {
            "operation": "estimatedStaticMemory",
            "arguments": ["MultiTapDelayLine<FloatFrame, 18> delayLine; constexpr int HISTORY_SIZE = 1 << 24; float reverseHistoryBuffer[2];"]
        },
        {
            "operation": "adaptStringTheoryBrowserSource",
            "arguments": ["#define DELAY_LINE_SIZE 1<<24\nfloat index = (delay * sampleRate) + sampleAdjust;\n"]
        }
    ]));
    assert_eq!(results[0], 64 * 1024 * 1024);
    let portland = results[1].as_str().unwrap();
    assert!(portland.contains("#define DELAY_LINE_SIZE (1 << 23)"));
    assert!(portland.contains("#define HISTORY_SIZE (1 << 23)"));
    assert!(portland.contains("sampleRate = args.sampleRate;"));
    assert_eq!(results[2], 144 * 1024 * 1024);
    let string_theory = results[3].as_str().unwrap();
    assert!(string_theory.contains("#define DELAY_LINE_SIZE (1 << 21)"));
    assert!(string_theory.contains("float(DELAY_LINE_SIZE - 4)"));
}

#[test]
fn ui_stripping_keeps_dsp_helpers_and_removes_native_surfaces() {
    let results = inspect_batch(json!([
        {
            "operation": "stripRackUiBlocks",
            "arguments": [concat!(
                "struct DPSlider { double value = 0.0; double getValue() { return value; } ",
                "void setValue(double next) { value = next; } }; ",
                "struct DPSliderDisplay : TransparentWidget { void draw(const DrawArgs&) {} };"
            )]
        },
        {
            "operation": "stripUiClassMembers",
            "arguments": [concat!(
                "std::array<LEDDisplay*, 8> displays;\nNVGcolor foreground = nvgRGBf(0.1f, 0.2f, 0.3f);\n",
                "void draw(const widget::Widget::DrawArgs& args) override;\n",
                "void process(const ProcessArgs& args) override { outputs[0].setVoltage(inputs[0].getVoltage()); }\n",
                "bool validateHost() { return APP->scene != nullptr; }\n",
                "struct Nested { bool validateHost() { return APP->scene != nullptr; } };"
            )]
        },
        {
            "operation": "stripNativeUiPointerBridges",
            "arguments": [concat!(
                "SpectrumDisplay* spectrum = nullptr;\nvoid process() {\n",
                "  float levelKnob = 0.5f; float muteFactor = 0.75f; float returnFrame = 2.f;\n",
                "  float output = levelKnob * muteFactor * returnFrame;\n",
                "  if (spectrum) spectrum->process();\n}"
            )]
        },
        {
            "operation": "stripRackUiBlocks",
            "arguments": [concat!(
                "struct ToggleGroup {\n  Module* module = nullptr;\n  GateTriggerReceiver trigger;\n",
                "  void initialize(Module* owner) { module = owner; }\n",
                "  void process(const ProcessArgs& args) { trigger.process(args.sampleTime); }\n",
                "  void addMenuItems(Menu* menu) { menu->addChild(new MenuItem); }\n};\n",
                "struct ToggleGroupWidget : ModuleWidget { ToggleGroupWidget() { addParam(createParam<Knob>()); } };"
            )]
        }
    ]));
    let texts = results
        .iter()
        .map(|value| value.as_str().expect("stripped source should be text"))
        .collect::<Vec<_>>();
    assert!(texts[0].contains("struct DPSlider"));
    assert!(!texts[0].contains("DPSliderDisplay"));
    assert!(!texts[1].contains("LEDDisplay"));
    assert!(!texts[1].contains("DrawArgs"));
    assert!(texts[1].contains("NVGcolor foreground"));
    assert!(texts[1].contains("process("));
    assert!(!texts[2].contains("spectrum"));
    assert!(texts[2].contains("levelKnob * muteFactor * returnFrame"));
    assert!(texts[3].contains("struct ToggleGroup"));
    assert!(texts[3].contains("void process"));
    assert!(!texts[3].contains("addMenuItems"));
    assert!(!texts[3].contains("ToggleGroupWidget"));
}

#[test]
fn complex_audio_and_preview_adapters_keep_browser_abi_without_desktop_services() {
    let results = inspect_batch(json!([
        {
            "operation": "adaptGpRotaryBrowserSource",
            "arguments": [concat!(
                "class MilliSampleDelayLine { float* m_pDelayLine = nullptr; mutex m_mtxIRs; ",
                "float** m_ppIRs = nullptr; mutex m_mtxOldIRs; list<pair<int, float**>> m_lstOldIRs; ",
                "mutex m_mtxTempIRs; float** m_ppTempIRs = nullptr; };\n",
                "bool MilliSampleDelayLine::BuildIRs(float fCutoffFrequency) { lock_guard<mutex> lock(m_mtxTempIRs); return false; }\n",
                "void MilliSampleDelayLine::DeleteTempIRs() { for (int nSub = 0; nSub < N_SUBSAMPLE; nSub++) delete [] m_ppTempIRs[nSub]; }\n",
                "void MilliSampleDelayLine::DeleteIRs() { for (int nSub = 0; nSub < N_SUBSAMPLE; nSub++) delete [] m_ppIRs[nSub]; }\n",
                "void MilliSampleDelayLine::UpdateIRs() { lock_guard<mutex> lock(m_mtxIRs); }\n",
                "void MilliSampleDelayLine::DeleteOldIRs() { while (!m_lstOldIRs.empty()) m_lstOldIRs.pop_front(); }\n",
                "void MilliSampleDelayLine::UpdateSamplerate(float) { delete m_pDelayLine; }"
            )]
        },
        {
            "operation": "adaptMidiRecorderBrowserBody",
            "arguments": [concat!(
                "struct MidiRecorder : Module {\n  std::ofstream midiFile;\n",
                "  std::string HexStringToByteString(std::string hex) { std::basic_string<uint8_t> bytes; ",
                "uint16_t byte = 255; bytes.push_back(static_cast<uint8_t>(byte)); return std::string(begin(bytes), end(bytes)); }\n",
                "  void loadDrumMap(std::string path) { XMLDocument doc; doc.LoadFile(path.c_str()); useDrumMap = true; }\n",
                "  void CreateMidiFile(std::string fileName) { std::ofstream output(fileName); output << \"MThd\"; }\n",
                "  json_t* dataToJson() override { json_t* rootJ = json_object(); return rootJ; }\n",
                "  void dataFromJson(json_t* rootJ) override { (void)rootJ; }\n",
                "  void process(const ProcessArgs& args) override { recording = args.sampleRate > 0; }\n};"
            )]
        },
        {
            "operation": "adaptLeviathanIntegralFluxBrowserBody",
            "arguments": [concat!(
                "ModuleTeardownTimer teardownTimer {\"IntegralFlux\"};\n",
                "~IntegralFluxImpl() override { teardownTimer.begin(id); }\n",
                "void process(const ProcessArgs&) override {\n",
                "  if (isDragonKingDebugEnabled()) perf();\n",
                "  if (!isDragonKingPreviewWidgetOptionsEnabled()) previewRenderMode = 0;\n}"
            )]
        },
        {
            "operation": "adaptLeviathanProcBrowserBody",
            "arguments": [concat!(
                "ModuleTeardownTimer teardownTimer {\"Proc\"};\n",
                "debug_terminal::BaselineModuleMetrics debugMetrics;\n",
                "Proc() { debugMetrics.assignInstanceId(gProcDebugInstanceCounter); }\n",
                "~Proc() override { teardownTimer.begin(id); }\n",
                "void process(const ProcessArgs&) override { const bool measurePerf = isDragonKingDebugEnabled(); }\n",
                "void getPreviewState(float&, float&, float&, float&, float&, bool&, bool&, uint32_t&) const {}"
            )]
        },
        {
            "operation": "browserTemporalDeckAdapterSource",
            "arguments": [
                {"key": "Leviathan/TemporalDeck"},
                {"sourceUrl": "https://example.test/Leviathan"},
                "GPL-3.0-or-later",
                "src/TemporalDeck.hpp",
                "src/TemporalDeckUI.cpp"
            ]
        },
        {
            "operation": "browserTdScopeAdapterSource",
            "arguments": [
                {"key": "Leviathan/TDScope"},
                {"sourceUrl": "https://example.test/Leviathan"},
                "GPL-3.0-or-later",
                "src/TDScope.hpp",
                "src/TDScopeWidget.cpp"
            ]
        }
    ]));
    let texts = results
        .iter()
        .map(|value| value.as_str().expect("adapter should be text"))
        .collect::<Vec<_>>();
    for marker in [
        "float* m_pIRStorage = nullptr",
        "m_pTempIRStorage = new float[N_SUBSAMPLE * N_TAPS]",
        "m_pTempIRStorage + nSub * N_TAPS",
        "rackWebRotaryFirHalf[N_SUBSAMPLE * N_TAPS / 2]",
        "delete [] m_pDelayLine",
    ] {
        assert!(texts[0].contains(marker), "missing {marker}");
    }
    for removed in ["lock_guard<mutex>", "delete [] m_ppTempIRs[nSub]"] {
        assert!(!texts[0].contains(removed));
    }
    for removed in ["basic_string<uint8_t", "XMLDocument", "std::ofstream"] {
        assert!(!texts[1].contains(removed));
    }
    assert!(texts[1].contains("std::string bytes"));
    assert!(texts[1].contains("json_object_set_new(rootJ, \"midiEvents\", eventsJ)"));
    assert!(texts[1].contains("eventCount = midiEvents.size()"));
    for removed in [
        "ModuleTeardownTimer",
        "teardownTimer",
        "isDragonKingDebugEnabled",
        "isDragonKingPreviewWidgetOptionsEnabled",
    ] {
        assert!(!texts[2].contains(removed));
    }
    assert!(texts[2].contains("~IntegralFluxImpl() override {}"));
    for removed in [
        "ModuleTeardownTimer",
        "teardownTimer",
        "debug_terminal",
        "isDragonKingDebugEnabled",
    ] {
        assert!(!texts[3].contains(removed));
    }
    assert!(texts[3].contains("rackWebVisualCount() const override"));
    for marker in [
        "#include \"TemporalDeckEngine.hpp\"",
        "rackWebAssetSampleCapacity = 960000",
        "engine.installSample",
        "configButton(FREEZE_PARAM",
        "RACK_WEB_EXPORTS(RackWebTemporalDeckModule)",
    ] {
        assert!(texts[4].contains(marker), "missing {marker}");
    }
    for marker in [
        "#include \"TemporalDeckExpanderProtocol.hpp\"",
        "config(0, 0, 0, LIGHTS_LEN)",
        "scopeDisplayRangeMode = 3",
        "scopeColorBrightness = .5f",
        "RACK_WEB_EXPORTS(RackWebTdScopeModule)",
    ] {
        assert!(texts[5].contains(marker), "missing {marker}");
    }
    for text in &texts[4..] {
        for removed in ["asset::", "system::", "APP->"] {
            assert!(!text.contains(removed));
        }
    }
}

#[test]
fn svg_and_widget_panel_geometry_is_extracted_from_real_fixture_files() {
    let temporary = TemporaryDirectory::new("scaffold-panel-geometry");
    let panel = temporary.path().join("panel.svg");
    fs::write(
        &panel,
        "<svg width=\"100%\" height=\"100%\" viewBox=\"0 0 180 380\"></svg>",
    )
    .unwrap();
    assert_eq!(
        inspect("svgPanelWidth", json!([panel.to_string_lossy()])),
        180
    );
    fs::write(&panel, "<svg width=\"30mm\" viewBox=\"0 0 90 380\"></svg>").unwrap();
    assert_eq!(
        inspect("svgPanelWidth", json!([panel.to_string_lossy()])),
        90
    );

    let source_root = temporary.path().join("src");
    let resource_root = temporary.path().join("res");
    fs::create_dir_all(&source_root).unwrap();
    fs::create_dir_all(&resource_root).unwrap();
    fs::write(
        source_root.join("Flux.cpp"),
        concat!(
            "struct FluxWidget : ModuleWidget { FluxWidget() { ",
            "visual_assets::SplitPanelRenderer panel(this, \"res/flux.panel.svg\"); } };"
        ),
    )
    .unwrap();
    fs::write(
        resource_root.join("flux.panel.svg"),
        "<svg width=\"101.6mm\" height=\"128.5mm\" viewBox=\"0 0 10160 12850\"></svg>",
    )
    .unwrap();
    assert_eq!(
        inspect(
            "widgetPanelWidth",
            json!([source_root.to_string_lossy(), "FluxWidget"])
        ),
        300
    );
}

#[test]
fn custom_model_registration_and_host_model_identity_are_kept_without_widgets() {
    let source = concat!(
        "template <class TModule, class TWidget>\n",
        "Model* createFixtureModel(std::string slug, int roles) { return createModel<TModule, TWidget>(slug); }\n",
        "Model* modelEngine = createFixtureModel<fixture::Engine, fixture::EngineWidget>(\"Engine\", 3);"
    );
    let registrations = inspect("modelRegistrations", json!([source, "fixture.cpp"]));
    let first = &registrations[0];
    assert_eq!(first["moduleClass"], "fixture::Engine");
    assert_eq!(first["widgetClass"], "fixture::EngineWidget");
    assert_eq!(first["slug"], "Engine");
    let identity = inspect_text(
        "namespaceGlobalDefinitions",
        json!([source, "return modelEngine;"]),
    );
    assert!(identity.contains("Model* modelEngine = new Model{\"Engine\"};"));
    assert!(!identity.contains("createFixtureModel"));
    assert!(!identity.contains("EngineWidget"));

    let host_source = concat!(
        "extern rack::plugin::Model* modelSapphireEcho;\n",
        "ShiftQueue<16, 4096> modelOutQueue;\nFrame<16> modelOutFrame;\n",
        "Resampler::ModelSampleRateChooser modelRateChooser;\nint modelOutFrameCount = 0;\n",
        "if (neighbor->model == modelSapphireEcho) connect(neighbor);"
    );
    assert_eq!(
        inspect("referencedHostModels", json!([host_source])),
        json!(["modelSapphireEcho"])
    );
}

#[test]
fn rust_fact_driven_normalization_keeps_cpp_semantics_and_removes_host_residue() {
    let template_source = concat!(
        "namespace fixture {\n",
        "template<int N> struct Bank { Bank(); float next(float value); };\n",
        "template<int N> Bank<N>::Bank() {}\n",
        "template<int N> float Bank<N>::next(float value) { return value + N; }\n",
        "template<int N> Bank<N>::Bank() {}\n",
        "template<int N> float Bank<N>::next(float value) { return value + N; }\n",
        "}\nRACK_WEB_EXPORTS(fixture::Bank<1>)\n"
    );
    let deferred_source = concat!(
        "const char* decoy = \"static DeferredType fake(DeferredType value) { return value; }\";\n",
        "struct Owner { static DeferredType member(DeferredType value) { return value; } };\n",
        "namespace outer::inner {\n",
        "template <typename T> static DeferredType deferTemplate(DeferredType value, T extra) { return value; }\n",
        "static int keep(int value) { return value + 1; }\n}\n",
        "namespace other { static DeferredType deferOther(DeferredType value) { return value; } }"
    );
    let out_of_line_source = concat!(
        "const char* decoy = \"float Engine::fake(float value) { return value; }\";\n",
        "namespace fixture {\n",
        "template <typename T> float Engine<T>::render(float value) { return value * 2.f; }\n",
        "float Engine<int>::Nested::read(float value) { return value + 1.f; }\n",
        "Engine<int>::Engine() {}\nEngine<int>::~Engine() {}\n",
        "Engine<int>::Engine() = default;\nconst int Engine<int>::table = 1;\n",
        "float Other::render(float value) { return value * 3.f; }\n}"
    );
    let plugin_init_source = concat!(
        "const char* decoy = \"void init(Plugin* plugin) { fake }\";\n",
        "namespace fixture { void init(rack::Plugin* plugin) { if (plugin) plugin->addModel(modelFixture); } }\n",
        "struct Owner { void init(Plugin* plugin) { member = plugin; } Plugin* member = nullptr; };\n",
        "void init(Plugin& plugin) { (void)plugin; }\n",
        "Model* modelFixture = createModel<FixtureModule, FixtureWidget>(\"Fixture\");"
    );
    let conditional_source = concat!(
        "const char* decoy = \"template<> float Bank<float>::next(float) { fake }\";\n",
        "namespace fixture {\n",
        "template<typename T> struct Bank {\n#ifdef RACK_SIMD\nT lane{};\n#endif\nfloat next(float value); };\n",
        "template<typename T> float Bank<T>::next(float value) { return value + 100.f; }\n",
        "template<> float Bank<float>::next(float value) { return value * 2.f; }\n",
        "template<typename T> struct Other { float next(float value); };\n",
        "template<typename T> float Other<T>::next(float value) { return value + 1.f; }\n",
        "template<> float Other<float>::next(float value) { return value + 2.f; }\n}"
    );
    let documentation_source = concat!(
        "CMRC_DECLARE(fixture_docs);\n",
        "const char* decoy = \"std::string Docs::fake() { cmrc::fixture_docs::get_filesystem(); }\";\n",
        "struct Docs { static std::string resource(int value); static std::string literalOnly(); static float number(); };\n",
        "std::string Docs::resource(int value) { auto fs = cmrc::fixture_docs::get_filesystem(); ",
        "return fs.is_file(\"fixture\") ? std::to_string(value) : \"\"; }\n",
        "std::string Docs::literalOnly() { return \"cmrc::fixture_docs::get_filesystem()\"; }\n",
        "float Docs::number() { auto fs = cmrc::fixture_docs::get_filesystem(); return fs.is_file(\"fixture\") ? 1.f : 0.f; }"
    );
    let results = inspect_batch(json!([
        {"operation": "dedupeOutOfLineMethodDefinitions", "arguments": [template_source]},
        {"operation": "namespaceUsingPrelude", "arguments": [concat!(
            "using namespace fixture;\nusing namespace fixture::dsp;\nusing namespace simd;\n",
            "using namespace rack;\nusing namespace dsp;\n",
            "const char* decoy = \"using namespace fake;\";\n// using namespace commented;\n",
            "void local() { using namespace local_only; }\nnamespace compact { using namespace compact_dsp; }"
        )]},
        {"operation": "standardDependencyIncludes", "arguments": ["#ifdef _WIN32\n#include <winsock2.h>\n#else\n#include <fcntl.h>\n#include <unistd.h>\n#endif"]},
        {"operation": "features", "arguments": ["OSCServer server(9000); server.start();"]},
        {"operation": "features", "arguments": ["param->send(value); output.send(value);"]},
        {"operation": "deferFreeFunctionsReferencingTypes", "arguments": [deferred_source, ["DeferredType"]]},
        {"operation": "removeOutOfLineDefinitions", "arguments": [out_of_line_source, "Engine<int>"]},
        {"operation": "stripPluginInitFunctions", "arguments": [plugin_init_source]},
        {"operation": "normalizeConditionalTemplateImplementations", "arguments": [conditional_source]},
        {"operation": "stripEmbeddedResourceDocumentation", "arguments": [documentation_source]}
    ]));
    let deduped = results[0].as_str().unwrap();
    assert_eq!(deduped.matches("Bank<N>::Bank(").count(), 1);
    assert_eq!(deduped.matches("Bank<N>::next(").count(), 1);
    assert!(deduped.contains("RACK_WEB_EXPORTS(fixture::Bank<1>)"));
    let using_prelude = results[1].as_str().unwrap();
    for marker in [
        "using namespace fixture;",
        "using namespace fixture::dsp;",
        "namespace simd = rack::simd;",
        "using namespace rack::simd;",
        "using namespace rack::dsp;",
        "using namespace compact_dsp;",
    ] {
        assert!(using_prelude.contains(marker), "missing {marker}");
    }
    for removed in ["fake", "commented", "local_only", "using namespace rack;"] {
        assert!(!using_prelude.contains(removed));
    }
    assert_eq!(
        results[2],
        json!(["#include <fcntl.h>", "#include <unistd.h>"])
    );
    assert_eq!(results[3], json!(["network"]));
    assert_eq!(results[4], json!([]));
    let deferred = &results[5];
    assert!(deferred["source"]
        .as_str()
        .unwrap()
        .contains("static int keep"));
    assert!(!deferred["source"]
        .as_str()
        .unwrap()
        .contains("deferTemplate("));
    assert_eq!(deferred["definitions"].as_array().unwrap().len(), 2);
    let removed = results[6].as_str().unwrap();
    assert!(removed.contains("const char* decoy"));
    assert!(!removed.contains("Engine<T>::render"));
    assert!(!removed.contains("Engine<int>::Nested::read"));
    assert!(removed.contains("Engine<int>::Engine() = default"));
    assert!(removed.contains("float Other::render"));
    let init = results[7].as_str().unwrap();
    assert!(!init.contains("plugin->addModel"));
    assert!(!init.contains("createModel"));
    assert!(init.contains("const char* decoy"));
    assert!(init.contains("void init(Plugin& plugin)"));
    let conditional = results[8].as_str().unwrap();
    assert!(conditional.contains("template<> float Bank<float>::next"));
    assert!(!conditional.contains("template<typename T> float Bank<T>::next"));
    assert!(conditional.contains("template<typename T> float Other<T>::next"));
    let docs = results[9].as_str().unwrap();
    assert!(!docs.contains("CMRC_DECLARE"));
    assert!(docs.contains("std::string Docs::resource(int value) { return \"\"; }"));
    assert!(docs.contains("std::string Docs::literalOnly()"));
    assert!(!docs.contains("std::to_string"));
}
