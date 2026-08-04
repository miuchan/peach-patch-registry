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
        .timeout(Duration::from_secs(90))
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
