import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import {adaptAlgomorphBrowserSource,adaptChrysalisBrowserBody,adaptClonotribeBrowserBody,adaptDanTSynthAocrBrowserSource,adaptDrumKitSampleAdapter,adaptEdgeKRushBrowserSource,adaptEdgeWcoBrowserSource,adaptFundamentalWavetableBrowserBody,adaptHetrickPhasorWavetableBrowserSource,adaptFv1EmuBrowserSource,adaptGpRotaryBrowserSource,adaptHoyerScanningDivisionBrowserBody,adaptIntegralFluxBrowserSource,adaptLessMessBrowserSource,adaptLeviathanIntegralFluxBrowserBody,adaptLeviathanIntegralFluxBrowserPrelude,adaptMadzineLaunchpadBrowserSource,adaptMadzineManualBrowserSource,adaptMadzineNigoqBrowserSource,adaptMadzineTheKickBrowserSource,adaptMadzineUniRhythmBrowserSource,adaptMadzineUniversalRhythmBrowserSource,adaptMadzineWeiiiDocumentaBrowserSource,adaptMidiRecorderBrowserBody,adaptMidiRecorderBrowserPrelude,adaptMlArpeggiatorBrowserSource,adaptNativeUiBackedExpressionFields,adaptPortlandWeatherBrowserSource,adaptRackNesBrowserSource,adaptStringTheoryBrowserSource,adaptStbImagePointerBrowserBody,appendInlineMethodStatement,browserAssetSamplerContract,browserAssetSamplerMethods,browserComputerscareBlankAdapterSource,browserFundamentalWavetablePrelude,declaredDependencyNames,dedupeRepeatedTopLevelEnums,dedupeRepeatedTopLevelTypes,deferFreeFunctionsReferencingTypes,dedupeOutOfLineMethodDefinitions,enumInfoByTerminal,estimatedStaticMemory,explicitSpecializationForwardDeclarations,features,filesOutsideNestedRepositories,insertExplicitSpecializationForwardDeclarations,isCodePosition,jsonStateKeys,localPlainStructDefinitions,madzineManualHelpData,modelRegistrations,nativeUiPointerMembers,namespaceFunctionForwardDeclarations,namespaceGlobalDefinitions,namespaceUsingPrelude,normalizeConditionalTemplateImplementations,normalizeGeneratedImplementations,normalizeLegacyMidiOverrides,numericConstants,outOfLineCallableKeys,outOfLineDefinitions,outOfLineFreeFunctionDefinitions,outOfLineStaticDefinitions,paramQuantityHelpers,preferNearestTargetEnums,prependInlineMethodBody,pruneInactiveConditionalDependencies,rackWidgetPlacements,referencedDependencyBundleForAdapter,referencedDefinesWithoutPluginGlobals,referencedExternGlobalDefinitions,referencedHostModels,referencedLocalFreeFunctionDefinitions,referencedPluginGlobalParts,referencedVecDspHelpers,removeFreeFunction,removeOutOfLineDefinitions,removeQualifiedFreeFunction,replaceInlineMethodBody,replaceOutOfLineMethod,standardDependencyIncludes,stubHostOnlyModuleMethods,stubInlineVoidMethod,stripEmbeddedResourceDocumentation,stripHostHistoryStatements,stripNativeUiPointerBridges,stripPluginInitFunctions,stripRackUiBlocks,stripRackUiResidue,stripSurgeRackCustomEditor,stripUiClassMembers,surgeFxConfigSpecializations,surgeVcoSpecializations,svgPanelWidth,widgetPanelWidth} from "../scripts/scaffold-library-module.mjs";
import {adaptLeviathanProcBrowserBody,adaptLeviathanProcBrowserPrelude,adaptLeviathanUndertowBrowserBody,adaptLeviathanUndertowBrowserImplementation,adaptLeviathanUndertowBrowserPrelude,chuckEmscriptenImplementationSources} from "../scripts/scaffold-library-module.mjs";
import {adaptMlTrigBufBrowserSource,adaptNoSuchDeviceCorrupterBrowserSource,adaptTapestryBrowserSource} from "../scripts/scaffold-library-module.mjs";
import {airwinBrowserSuite,browserAssetDependencyPrelude,modulePrelude,sourceWithoutIncludes,stripUiHeaderIncludes} from "../scripts/scaffold-library-module.mjs";
import {browserTemporalDeckAdapterSource} from "../scripts/temporal-deck-browser-adapter.mjs";
import {browserTdScopeAdapterSource} from "../scripts/td-scope-browser-adapter.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),".."),source=path.join(root,"tests","fixtures","scaffold-plugin");

test("source preprocessing removal consumes Rust directive ranges while preserving active defines",()=>{
  const source='😀\n\n#include "Dsp.hpp"\n#pragma once\n#define ACTIVE_GAIN 2\n// #define COMMENTED_GAIN 9\n// #include "Comment.hpp"\nfloat apply(float value) { return value * ACTIVE_GAIN; }\n';
  assert.equal(sourceWithoutIncludes(source),'😀\n\n\n#define ACTIVE_GAIN 2\n\n\nfloat apply(float value) { return value * ACTIVE_GAIN; }');
});

test("module preludes preserve active defines while Rust ranges remove other directives",()=>{
  const source='#include "Dsp.hpp"\n#pragma once\n#define ACTIVE_GAIN 2\n// #define COMMENTED_GAIN 9\nfloat helper(float value) { return value * ACTIVE_GAIN; }\nstruct PreludeModule : Module {};\n';
  const prelude=modulePrelude(source,"PreludeModule");
  assert.match(prelude,/#define ACTIVE_GAIN 2/);
  assert.match(prelude,/float helper\(float value\)/);
  assert.doesNotMatch(prelude,/#include|#pragma|COMMENTED_GAIN/);
});

test("UI include and asset dependency policies consume Rust include facts",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-rust-include-policy-")),dsp=path.join(temporary,"Dsp.hpp"),panel=path.join(temporary,"Panel.hpp");
  try{
    fs.writeFileSync(dsp,"struct DspState { float value = 1.f; };\n");
    fs.writeFileSync(panel,"struct PanelWidget : ModuleWidget {};\n");
    const source='#include "Dsp.hpp"\n#include "Panel.hpp"\n#include <array>\n';
    const stripped=stripUiHeaderIncludes(source,[dsp,panel],temporary);
    assert.match(stripped,/#include "Dsp\.hpp"/);
    assert.doesNotMatch(stripped,/Panel\.hpp/);
    assert.match(stripped,/#include <array>/);
    const assetSource='#include <dep/resampler/Filter.hpp>\n#include "AudioFile.h"\n#include "Ignored.hpp" // trailing policy comment\n// #include "Comment.hpp"\n';
    assert.equal(browserAssetDependencyPrelude(assetSource,{mode:"audiofile-tape"}),'#include "dep/resampler/Filter.hpp"\n#include "AudioFile.h"');
  }finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("Airwindows unity aggregation consumes Rust quoted-include facts",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-airwin-directives-")),sourceDir=path.join(temporary,"plugin"),sourceRoot=path.join(sourceDir,"src"),airwinRoot=path.join(sourceRoot,"autogen_airwin"),output=path.join(temporary,"output");
  try{
    fs.mkdirSync(airwinRoot,{recursive:true});fs.mkdirSync(output,{recursive:true});
    fs.writeFileSync(path.join(sourceRoot,"Support.hpp"),"#pragma once\n");
    fs.writeFileSync(path.join(sourceRoot,"ModuleAdd.h"),'#include "Support.hpp"\n#include "Trailing.hpp" // not a complete aggregation include\n// #include "Comment.hpp"\nint ExampleRegistration = AirwinRegistry::registerAirwindow({"Example", 0, 0, 0, "Example effect", airwinconsolidated::Example::kNumParameters});\n');
    fs.writeFileSync(path.join(airwinRoot,"Example.h"),"namespace airwinconsolidated::Example { enum { kNumParameters = 2, kOther = 3 }; }\n");
    fs.writeFileSync(path.join(airwinRoot,"Example.cpp"),'#ifndef AIRWIN_EXAMPLE_UNIT\n#include "Example.h"\n#endif\nnamespace airwinconsolidated::Example {}\n');
    const result=airwinBrowserSuite(output,sourceDir,'#include "rack_web_export.hpp"\nstruct AW2RModule : Module { AW2RModule() {} };');
    assert.ok(result);assert.deepEqual(result.effectNames,["Example"]);assert.match(result.source,/rackWebEnsureAirwinRegistry\(\)/);
    const suite=fs.readFileSync(result.file,"utf8");
    assert.match(suite,new RegExp(`#include ${JSON.stringify(path.join(sourceRoot,"Support.hpp")).replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}`));
    assert.doesNotMatch(suite,/Trailing\.hpp|Comment\.hpp/);assert.match(suite,/registerAirwindow/);assert.match(suite,/#define AIRWIN_EXAMPLE_UNIT 1[\s\S]*Example\.cpp[\s\S]*#undef AIRWIN_EXAMPLE_UNIT/);
  }finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("ChucK Emscripten source selection consumes configured Rust Makefile facts",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-chuck-makefile-")),sourceDir=path.join(temporary,"plugin"),chuckRoot=path.join(sourceDir,"chuck","src"),core=path.join(chuckRoot,"core"),runtime=path.join(core,"runtime.cpp"),helper=path.join(core,"helper.cc"),ignored=path.join(core,"ignored.cpp");
  try{
    fs.mkdirSync(core,{recursive:true});for(const file of [runtime,helper,ignored])fs.writeFileSync(file,"int fixture;\n");fs.writeFileSync(path.join(sourceDir,"Makefile"),"SOURCES = unrelated.cpp\n");fs.writeFileSync(path.join(chuckRoot,"makefile"),"CORE = core/runtime.cpp\nEMSCRIPTENSRCS = $(CORE) core/helper.cc core/missing.cpp\n");
    assert.deepEqual(chuckEmscriptenImplementationSources(sourceDir),[fs.realpathSync(runtime),fs.realpathSync(helper)]);
  }finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("linker override detection consumes Rust out-of-line callable facts",()=>{
  const source=`namespace fixture {
struct Engine { Engine(); ~Engine(); void render(); static int count; };
Engine::Engine() {}
Engine::~Engine() {}
void Engine::render() {}
int Engine::count = 1;
}`;
  assert.deepEqual(outOfLineCallableKeys(source),["Engine::Engine","Engine::~Engine","Engine::render"]);
});

test("createModel registrations resolve global template module aliases",()=>{
  const source=`template <typename Circuit> struct SlothModule : Module {};
namespace Analog { struct TorporSlothCircuit {}; }
using SlothTorporModule = SlothModule<Analog::TorporSlothCircuit>;
struct SlothTorporWidget {};
Model* modelSlothTorpor = createModel<SlothTorporModule, SlothTorporWidget>("SlothTorpor");`,
    registrations=modelRegistrations(source,"SlothTorpor.cpp");
  assert.deepEqual(registrations,[{
    file:"SlothTorpor.cpp",
    moduleClass:"SlothModule<Analog::TorporSlothCircuit>",
    registeredModuleClass:"SlothTorporModule",
    widgetClass:"SlothTorporWidget",
    slug:"SlothTorpor",
    registrationNamespace:[],
  }]);
});

test("single-widget createModel factories resolve their inherited module type",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-widget-model-test-")),
    header=path.join(temporary,"Voice.hpp"),
    sourceFile=path.join(temporary,"Voice.cpp");
  try{
    fs.writeFileSync(header,`namespace fixture::voice {
struct VoiceModule : Module {};
template<class TModule> struct ModuleWidgetBase : ModuleWidget { using _ModuleType = TModule; };
struct VoiceWidget : ModuleWidgetBase<VoiceModule> {};
}`);
    const source=`# include "Voice.hpp"
namespace fixture {
Model* modelVoice = createModel<voice::VoiceWidget>("Voice");
}`;
    fs.writeFileSync(sourceFile,source);
    const expected=[{
      file:sourceFile,
      moduleClass:"fixture::voice::VoiceModule",
      registeredModuleClass:"fixture::voice::VoiceModule",
      widgetClass:"voice::VoiceWidget",
      slug:"Voice",
      registrationNamespace:["fixture"],
    }];
    assert.deepEqual(modelRegistrations(source,sourceFile),expected);
    fs.rmSync(header);
    const rustCandidate=[{index:source.indexOf("createModel"),templateSource:"voice::VoiceWidget",callSource:'"Voice"',templateArguments:["voice::VoiceWidget"],callArguments:['"Voice"'],namespace:["fixture"],registeredModuleType:"VoiceModule",widgetNamespace:["fixture","voice"],contextFiles:[sourceFile,header],rust:true}],aliases=new Map([[sourceFile,[]],[header,[]]]);
    assert.deepEqual(modelRegistrations(source,sourceFile,{},rustCandidate,aliases),expected);
  }finally{
    fs.rmSync(temporary,{recursive:true,force:true});
  }
});

test("ML Trigger Buffer uses patch state instead of a desktop defaults file",()=>{
  const adapted=adaptMlTrigBufBrowserSource(`struct TrigBuf : Module {
    TrigBuf() {
      defaults.setModule("TrigBuf");
      armOnLoad = defaults.getBool("ArmOnLoad");
    }
    SettingsHandler defaults;
  };
  RACK_WEB_EXPORTS(TrigBuf)`);
  assert.doesNotMatch(adapted,/defaults\.|SettingsHandler\s+defaults/);
  assert.match(adapted,/armOnLoad = false;/);
  assert.match(adapted,/RACK_WEB_EXPORTS\(TrigBuf\)/);
});

test("NoSuchDevice Corrupter exposes the native waveform and state display through the visual ABI",()=>{
  const adapted=adaptNoSuchDeviceCorrupterBrowserSource("struct CorrupterModule : Module {};\nRACK_WEB_EXPORTS(CorrupterModule)");
  assert.match(adapted,/std::array<float, 5 \+ kWaveBins> rackWebDisplay/);
  assert.match(adapted,/wave_peaks\[bin\]/);
  assert.match(adapted,/persistent\.freeze_enabled/);
  assert.match(adapted,/RACK_WEB_EXPORTS\(RackWebCorrupterModule\)/);
});

test("Tapestry exposes its native reel waveform, marker editor, and playhead through the visual ABI",()=>{
  const adapted=adaptTapestryBrowserSource("struct Tapestry : Module {};\nRACK_WEB_EXPORTS(Tapestry)");
  assert.match(adapted,/rackWebWaveBins = 90/);
  assert.match(adapted,/rackWebMaxSplices = 300/);
  assert.match(adapted,/getPlayheadPosition/);
  assert.match(adapted,/splices\[index\]\.startFrame/);
  assert.match(adapted,/deleteMarkerAtIndex/);
  assert.match(adapted,/onSpliceTrigger/);
  assert.match(adapted,/RACK_WEB_EXPORTS\(RackWebTapestryModule\)/);
});

test("extern global dependency collection retains referenced source tables without unrelated arrays",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-extern-globals-")),
    declarations=path.join(temporary,"oscillator.hpp"),
    tables=path.join(temporary,"tables.hpp");
  try{
    fs.writeFileSync(declarations,"extern float grainTableA[4];\nextern float grainTableB[4];\n");
    fs.writeFileSync(tables,"float grainTableA[4] = {0.f, 1.f, 0.f, -1.f};\nfloat unusedTable[2] = {9.f, 9.f};\n");
    const globals=referencedExternGlobalDefinitions([declarations,tables],`${fs.readFileSync(declarations,"utf8")}\nfloat sample = grainTableA[1];`);
    assert.equal(globals.length,1);
    assert.match(globals[0],/float grainTableA\[4\] = \{0\.f, 1\.f, 0\.f, -1\.f\};/);
    assert.doesNotMatch(globals[0],/grainTableB|unusedTable/);
  }finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("vendored Eigen headers remain guarded includes outside a lib directory",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-src-eigen-")),
    sourceDir=temporary,
    sourceRoot=path.join(sourceDir,"src"),
    eigenRoot=path.join(sourceRoot,"Eigen"),
    dense=path.join(eigenRoot,"Dense"),
    model=path.join(sourceRoot,"Model.hpp");
  try{
    fs.mkdirSync(eigenRoot,{recursive:true});
    fs.writeFileSync(path.join(sourceDir,"plugin.json"),JSON.stringify({slug:"EigenFixture"}));
    fs.writeFileSync(dense,"#pragma once\n#define EIGEN_INTERNAL_SENTINEL 1\nnamespace Eigen { template<typename T, int N, int M> struct Array {}; }\n");
    fs.writeFileSync(model,'#pragma once\n#include "Eigen/Dense"\nstruct EigenConsumer { Eigen::Array<float, 4, 1> values; };\n');
    const bundle=referencedDependencyBundleForAdapter(
      [model,dense],
      "EigenConsumer consumer;",
      new Set(),
      sourceDir,
    );
    assert.match(bundle.source,/#include <Eigen\/Dense>/);
    assert.match(bundle.source,/struct EigenConsumer/);
    assert.doesNotMatch(bundle.source,/EIGEN_INTERNAL_SENTINEL|namespace Eigen \{/);
  }finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("browser history adaptation keeps state changes while removing desktop-only undo records",()=>{
  const adapted=stripHostHistoryStatements(`void process() {
    AlgorithmSceneChangeAction<Module>* h = new AlgorithmSceneChangeAction<Module>;
    h->moduleId = id;
    h->oldScene = baseScene;
    baseScene = nextScene;
    APP->history->push(h);
  }`);
  assert.doesNotMatch(adapted,/AlgorithmSceneChangeAction|h->|APP->history/);
  assert.match(adapted,/baseScene = nextScene;/);
});

test("Algomorph browser adaptation orders mode labels and drops graph-only desktop data",()=>{
  const adapted=adaptAlgomorphBrowserSource(`static const GraphData GRAPH_DATA;
static const std::string AuxInputModeLabels[AuxInputModes::NUM_MODES] = {"Morph"};
static const std::string AuxKnobModeLabels[AuxKnobModes::NUM_MODES] = {"Gain"};
struct AuxInputModes { static const int NUM_MODES = 1; };
struct AuxKnobModes { static const int NUM_MODES = 1; };
struct FMDelexanderSettings { FMDelexanderSettings(); };
FMDelexanderSettings pluginSettings;
void init() {
  for (int i = 0; i < 1980; i++) { graphAddressTranslation[(int)GRAPH_DATA.xNodeData[i][0]] = i; }
  enabled = pluginSettings.glowingInkDefault;
}`);
  assert.doesNotMatch(adapted,/GraphData|GRAPH_DATA/);
  assert.ok(adapted.indexOf("struct AuxInputModes")<adapted.indexOf("AuxInputModeLabels"));
  assert.ok(adapted.indexOf("struct AuxKnobModes")<adapted.indexOf("AuxKnobModeLabels"));
  assert.match(adapted,/FMDelexanderSettings\(\) = default;/);
  assert.match(adapted,/::pluginSettings\.glowingInkDefault/);
});

test("Algomorph Pocket browser adaptation preserves its already ordered mode labels",()=>{
  const source=`static const GraphData GRAPH_DATA;
struct AuxInputModes { static const int NUM_MODES = 1; };
static const std::string AuxInputModeLabels[AuxInputModes::NUM_MODES] = {"Morph"};
struct FMDelexanderSettings { FMDelexanderSettings(); };
FMDelexanderSettings pluginSettings;`;
  const adapted=adaptAlgomorphBrowserSource(source,false);
  assert.doesNotMatch(adapted,/GraphData|GRAPH_DATA/);
  assert.ok(adapted.indexOf("struct AuxInputModes")<adapted.indexOf("AuxInputModeLabels"));
  assert.match(adapted,/FMDelexanderSettings\(\) = default;/);
});

test("Edge WCO browser adaptation embeds its factory waves without runtime files",()=>{
  const adapted=adaptEdgeWcoBrowserSource(`struct WCO_Osc {
  std::string plug_directory = asset::plugin(pluginInstance, "res/waves/");
  float wave[64][256] = {{0}};
  bool tab_loaded = false;
  void LoadWaves();
};
void WCO_Osc::LoadWaves() {
  drwav_open_file_and_read_pcm_frames_f32((plug_directory + "00.wav").c_str(), nullptr, nullptr, nullptr);
  tab_loaded = true;
}`,null,[[0,.5,-1]]);
  assert.match(adapted,/rackWebEdgeWcoWaves\[1\]\[3\]/);
  assert.match(adapted,/\{0,0\.5,-1\}/);
  assert.doesNotMatch(adapted,/drwav_open_file|asset::plugin/);
  assert.match(adapted,/wave\[waveIndex\]\[sampleIndex\] = rackWebEdgeWcoWaves/);
});

test("Edge K_Rush browser adaptation preserves PCM amplitude and removes runtime wave files",()=>{
  const adapted=adaptEdgeKRushBrowserSource(`struct Diode {
  std::string plug_directory = asset::plugin(pluginInstance, "res/waves2/");
  float wave[64][256] = {{0}};
  bool tab_loaded = false;
  void LoadWaves() {
    drwav_open_file_and_read_pcm_frames_f32((plug_directory + "00.wav").c_str(), nullptr, nullptr, nullptr);
    tab_loaded = true;
  }
};`,null,[[-.5,0,.25]]);
  assert.match(adapted,/rackWebEdgeKRushWaves\[1\]\[3\]/);
  assert.match(adapted,/\{-0\.5,0,0\.25\}/);
  assert.doesNotMatch(adapted,/drwav_open_file|asset::plugin/);
  assert.match(adapted,/wave\[waveIndex\]\[sampleIndex\] = rackWebEdgeKRushWaves/);
  const hardened=adaptEdgeKRushBrowserSource(`struct Diode {
  float wave[64][256] = {{0}};
  bool tab_loaded = false;
  bool first_alg = true;
  void LoadWaves() {}
  float process(float in, float type) { int index = in*255; return wave[(int)type][index]; }
};
void restore(json_t* first_algJ, Diode& d_pos) { if (d_pos.first_alg) d_pos.first_alg = json_integer_value(first_algJ); }`,null,[[0]]);
  assert.match(hardened,/std::abs\(in\) \* 255\.0f/);
  assert.match(hardened,/type = clamp\(type, 0\.0f, 15\.0f\)/);
  assert.match(hardened,/if \(first_algJ\) d_pos\.first_alg/);
});

test("MADZINE NIGOQ browser adaptation exposes both exact-source scope traces",()=>{
  const adapted=adaptMadzineNigoqBrowserSource(`struct NIGOQ {
  static constexpr int SCOPE_BUFFER_SIZE = 256;
  struct ScopePoint { float min; float max; };
  ScopePoint finalBuffer[SCOPE_BUFFER_SIZE];
  ScopePoint modBuffer[SCOPE_BUFFER_SIZE];
};
RACK_WEB_EXPORTS(NIGOQ)`);
  assert.match(adapted,/struct RackWebNigoqModule : NIGOQ/);
  assert.match(adapted,/std::array<float, SCOPE_BUFFER_SIZE \* 2> rackWebScope/);
  assert.match(adapted,/const float finalValue = finalBuffer\[index\]\.max/);
  assert.match(adapted,/const float modValue = modBuffer\[index\]\.max/);
  assert.match(adapted,/std::isfinite\(finalValue\) \? finalValue : 0\.f/);
  assert.match(adapted,/RACK_WEB_EXPORTS\(RackWebNigoqModule\)/);
  assert.doesNotMatch(adapted,/RACK_WEB_EXPORTS\(NIGOQ\)\s*$/);
});

test("MADZINE Weiii Documenta browser adaptation exposes recording, slice, loop, and voice display state",()=>{
  const adapted=adaptMadzineWeiiiDocumentaBrowserSource(`struct WeiiiDocumenta {};
RACK_WEB_EXPORTS(WeiiiDocumenta)`);
  assert.match(adapted,/struct RackWebWeiiiDocumentaModule : WeiiiDocumenta/);
  assert.match(adapted,/rackWebWavePoints = 170/);
  assert.match(adapted,/rackWebMaxSlices = 64/);
  assert.match(adapted,/rackWebWaveform\[2\] = \(isRecording \? 1\.f : 0\.f\)/);
  assert.match(adapted,/params\[LOOP_END_PARAM\]\.getValue\(\)/);
  assert.match(adapted,/slices\[index\]\.startSample/);
  assert.match(adapted,/voices\[index\]\.playbackPosition/);
  assert.match(adapted,/RACK_WEB_EXPORTS\(RackWebWeiiiDocumentaModule\)/);
});

test("MADZINE Universal Rhythm browser adaptation exposes exact pattern velocities, steps, lengths, and CV-modulated styles",()=>{
  const adapted=adaptMadzineUniversalRhythmBrowserSource(`struct UniversalRhythm {};
RACK_WEB_EXPORTS(UniversalRhythm)`);
  assert.match(adapted,/struct RackWebUniversalRhythmModule : UniversalRhythm/);
  assert.match(adapted,/std::array<float, 12 \+ 8 \* rackWebSteps> rackWebPattern/);
  assert.match(adapted,/roleLengths\[role\]/);
  assert.match(adapted,/currentSteps\[role\]/);
  assert.match(adapted,/TIMELINE_STYLE_CV_INPUT \+ role \* 4/);
  assert.match(adapted,/pattern\.hasOnsetAt\(step\) \? clamp\(pattern\.getVelocity\(step\)/);
  assert.match(adapted,/RACK_WEB_EXPORTS\(RackWebUniversalRhythmModule\)/);
});

test("MADZINE Uni Rhythm browser adaptation exposes the compact module's pattern state",()=>{
  const adapted=adaptMadzineUniRhythmBrowserSource(`struct UniRhythm {};
RACK_WEB_EXPORTS(UniRhythm)`);
  assert.match(adapted,/struct RackWebUniRhythmModule : UniRhythm/);
  assert.match(adapted,/std::array<float, 12 \+ 8 \* rackWebSteps> rackWebPattern/);
  assert.match(adapted,/roleLengths\[role\]/);
  assert.match(adapted,/currentSteps\[role\]/);
  assert.match(adapted,/pattern\.hasOnsetAt\(step\)/);
  assert.match(adapted,/RACK_WEB_EXPORTS\(RackWebUniRhythmModule\)/);
});

test("MADZINE Launchpad browser adaptation exposes every cell state, waveform, gesture, and speed action",()=>{
  const adapted=adaptMadzineLaunchpadBrowserSource(`struct Launchpad {};
RACK_WEB_EXPORTS(Launchpad)`);
  assert.match(adapted,/struct RackWebLaunchpadModule : Launchpad/);
  assert.match(adapted,/rackWebCells \* \(rackWebCellStride \+ rackWebWavePoints\)/);
  assert.match(adapted,/onCellClick\(cell \/ rackWebColumns, cell % rackWebColumns\)/);
  assert.match(adapted,/moveCell\(source \/ rackWebColumns/);
  assert.match(adapted,/copyCell\(source \/ rackWebColumns/);
  assert.match(adapted,/playbackSpeed = knobToSpeed/);
  assert.match(adapted,/RACK_WEB_EXPORTS\(RackWebLaunchpadModule\)/);
});

test("MADZINE Manual adaptation keeps DSP state light and restores the missing help initializer",()=>{
  const adapted=adaptMadzineManualBrowserSource(`struct ModuleHelpData {};
static std::map<std::string, ModuleHelpData>& getHelpData() {
  static std::map<std::string, ModuleHelpData> data = initHelpData();
  return data;
}`);
  assert.match(adapted,/initHelpData\(\) \{ return \{\}; \}/);
  assert.ok(adapted.indexOf("initHelpData()")<adapted.indexOf("getHelpData()"));
  assert.equal(adaptMadzineManualBrowserSource(adapted),adapted);
});

test("MADZINE Manual help parser preserves all localized module and control text",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"madzine-manual-help-"));
  try{
    fs.mkdirSync(path.join(temporary,"src"));
    fs.writeFileSync(path.join(temporary,"src","ManualHelpData.hpp"),`inline std::map<std::string, ModuleHelpData> initHelpData() {
      std::map<std::string, ModuleHelpData> data;
      {
        ModuleHelpData m;
        m.name = "AD Generator";
        m.description = {"Envelope", "三軌 Envelope", "エンベロープ"};
        m.entries.push_back({"Attack All", {"Global \\\\u00b1 offset", "全域偏移", "全体オフセット"}});
        data["ADGenerator"] = std::move(m);
      }
      return data;
    }`);
    assert.deepEqual(madzineManualHelpData(temporary),{
      ADGenerator:{
        name:"AD Generator",
        description:{en:"Envelope",zh:"三軌 Envelope",ja:"エンベロープ"},
        entries:[{name:"Attack All",text:{en:"Global ± offset",zh:"全域偏移",ja:"全体オフセット"}}],
      },
    });
  }finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("ML Arpeggiator browser adaptation exposes its exact dynamic order, range, and mode grid",()=>{
  const adapted=adaptMlArpeggiatorBrowserSource(`struct Arpeggiator {};
RACK_WEB_EXPORTS(Arpeggiator)`);
  assert.match(adapted,/struct RackWebMlArpeggiatorModule : Arpeggiator/);
  assert.match(adapted,/1 \+ rackWebChannels \* 3/);
  assert.match(adapted,/clamp\(channels_trigger, 1, rackWebChannels\)/);
  assert.match(adapted,/order_display\[channel\]/);
  assert.match(adapted,/range_display\[channel\]/);
  assert.match(adapted,/mode_display\[channel\]/);
  assert.match(adapted,/RACK_WEB_EXPORTS\(RackWebMlArpeggiatorModule\)/);
});

test("MADZINE theKICK browser adaptation loads its transfer sample and preserves mode controls",()=>{
  const adapted=adaptMadzineTheKickBrowserSource(`struct theKICK {};
RACK_WEB_EXPORTS(theKICK)`);
  assert.match(adapted,/struct RackWebTheKickModule : theKICK/);
  assert.match(adapted,/rackWebAssetSampleCapacity = 48000 \* 10 \* 2/);
  assert.match(adapted,/sampleTable\[index\] = crossfade/);
  assert.match(adapted,/modeValue = \(modeValue \+ 1\) % 4/);
  assert.match(adapted,/clearSample\(\)/);
  assert.match(adapted,/RACK_WEB_EXPORTS\(RackWebTheKickModule\)/);
});

test("Rack SIMD scalar fallbacks do not make ordinary math calls ambiguous",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-math-overload-test-")),fixture=path.join(temporary,"fixture.cpp"),object=path.join(temporary,"fixture.o");
  try{
    fs.writeFileSync(fixture,'#include "rack_web.hpp"\nusing namespace rack;\nusing namespace rack::simd;\nfloat exercise(float value) { int32_4 lanes{1, 2, 3, 4}; return sqrt(value) + tan(value) + abs(value) + floor(value) + pow(value, 2.f) + fmod(value, 2) + lanes[3]; }\n');
    execFileSync("em++",["-std=c++20","-c",fixture,"-I",path.join(root,"web-runtime","include"),"-o",object],{encoding:"utf8"});
    assert.ok(fs.statSync(object).size>0);
  }finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("Rack Web dispatches protected process overrides through the public Module interface",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-protected-process-test-")),fixture=path.join(temporary,"fixture.cpp"),object=path.join(temporary,"fixture.o");
  try{
    fs.writeFileSync(fixture,'#include "rack_web_export.hpp"\nstruct ProtectedProcessModule : Module { enum { NUM_PARAMS }; enum { NUM_INPUTS }; enum { SIGNAL_OUTPUT, NUM_OUTPUTS }; enum { NUM_LIGHTS }; ProtectedProcessModule() { config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS); } protected: void process(const ProcessArgs&) override { outputs[SIGNAL_OUTPUT].setVoltage(7.f); } };\nRACK_WEB_EXPORTS(ProtectedProcessModule)\n');
    execFileSync("em++",["-std=c++20","-c",fixture,"-I",path.join(root,"web-runtime","include"),"-o",object],{encoding:"utf8"});
    assert.ok(fs.statSync(object).size>0);
  }finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("Rack Web exposes GLFW modifier-key codes used by exact-source hotkey modules",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-glfw-modifier-test-")),fixture=path.join(temporary,"fixture.cpp"),object=path.join(temporary,"fixture.o");
  try{
    fs.writeFileSync(fixture,'#include "rack_web.hpp"\nstatic_assert(GLFW_KEY_LEFT_SHIFT == 340 && GLFW_KEY_LEFT_CONTROL == 341 && GLFW_KEY_LEFT_ALT == 342 && GLFW_KEY_LEFT_SUPER == 343);\nstatic_assert(GLFW_KEY_RIGHT_SHIFT == 344 && GLFW_KEY_RIGHT_CONTROL == 345 && GLFW_KEY_RIGHT_ALT == 346 && GLFW_KEY_RIGHT_SUPER == 347);\nint modifierKey(int key) { return key == GLFW_KEY_LEFT_SUPER || key == GLFW_KEY_RIGHT_SUPER || key == GLFW_KEY_LEFT_SHIFT || key == GLFW_KEY_RIGHT_SHIFT || key == GLFW_KEY_LEFT_CONTROL || key == GLFW_KEY_RIGHT_CONTROL || key == GLFW_KEY_LEFT_ALT || key == GLFW_KEY_RIGHT_ALT; }\n');
    execFileSync("em++",["-std=c++20","-c",fixture,"-I",path.join(root,"web-runtime","include"),"-o",object],{encoding:"utf8"});
    assert.ok(fs.statSync(object).size>0);
  }finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("native UI pointers are detected from their actual base classes",()=>{
  const types="struct QInfoText : LedDisplay {}; struct QDataEntry : LedDisplayTextField {}; struct XYScreen : OpaqueWidget {}; struct PointList { XYScreen* screen; void writeToParams(); };";
  const members=nativeUiPointerMembers("QInfoText* info; QDataEntry* fields[9]; XYScreen* screen; PointList* pointList; te_expr* expressions[9];",types);
  assert.deepEqual(members.map(member=>member.name).sort(),["fields","info","pointList","screen"]);
  assert.deepEqual(nativeUiPointerMembers("inline void setVULight3(rack::dsp::VuMeter2& meter, rack::engine::Light* light) { light->setBrightness(1.f); }"),[]);
  const stripped=stripNativeUiPointerBridges("struct AB4Widget* m_pWidget = nullptr;\ndsp::SchmittTrigger m_trigger;","struct AB4Widget : ModuleWidget {};");
  assert.doesNotMatch(stripped,/\b(?:struct\s+)?AB4Widget\b|m_pWidget/);
  assert.match(stripped,/dsp::SchmittTrigger m_trigger;/);
});

test("native expression fields remain active and recompile restored text without their Rack widgets",()=>{
  const source='bool fieldsLoaded = false; std::string texts[9]; void dataFromJson(json_t* rootJ) override { texts[0] = json_string_value(json_object_get(rootJ, "expr0")); } void processStrings() { expressions[0] = te_compile(texts[0].c_str(), vars, 13, 0); }';
  const adapted=adaptNativeUiBackedExpressionFields(source,["fields"]);
  assert.match(adapted,/bool fieldsLoaded = true;/);
  assert.match(adapted,/dataFromJson[^]*texts\[0\][^]*processStrings\(\);\s*\}/);
  assert.equal((adapted.match(/processStrings\(\);/g)??[]).length,1);
  assert.equal(adaptNativeUiBackedExpressionFields(source,[]),source);
});

test("DrumKit sample adapters embed and register every target sample before module construction",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-drumkit-assets-")),folder=path.join(temporary,"res","samples","bd9"),kicks=path.join(temporary,"res","samples","kick");fs.mkdirSync(folder,{recursive:true});fs.mkdirSync(kicks,{recursive:true});try{for(let index=1;index<=16;index++){const sample=Buffer.alloc(8);sample.writeFloatLE(index/16,0);sample.writeFloatLE(0,4);fs.writeFileSync(path.join(folder,`${String(index).padStart(2,"0")}.raw`),sample)}for(let index=1;index<=2;index++)fs.copyFileSync(path.join(folder,`${String(index).padStart(2,"0")}.raw`),path.join(kicks,`${String(index).padStart(2,"0")}.raw`));const source="namespace DrumKit { class SampleManager { public: static SampleManager* getInstance(); }; struct Sample {}; }\nconfigParam<Blank>(0, 0.f, 1.f, 0.f, \"Run\");\nstruct SampleController : Module {};";const adapted=adaptDrumKitSampleAdapter(temporary,{plugin:"DrumKit",model:"BassDrum9"},source);assert.match(adapted,/DrumKit::SampleManager\* sampleManager = DrumKit::SampleManager::getInstance\(\)/);assert.match(adapted,/rackWebDrumSampleData\.reserve\(16\)/);assert.match(adapted,/"bd9-01"/);assert.match(adapted,/"bd9-16"/);assert.doesNotMatch(adapted,/configParam\s*<\s*Blank\s*>/);assert.match(adapted,/configParam\(0, 0\.f, 1\.f, 0\.f, "Run"\)/);assert.ok(adapted.indexOf("rackWebDrumSamplesReady")<adapted.indexOf("struct SampleController"));const marionette=adaptDrumKitSampleAdapter(temporary,{plugin:"DrumKit",model:"MarionetteBass"},"namespace DrumKit { class SampleManager { public: static SampleManager* getInstance(); }; struct Sample {}; }\nstruct MarionetteModule : Module {};");assert.match(marionette,/rackWebDrumSampleData\.reserve\(2\)/);assert.match(marionette,/"kick01", values\.data\(\), 55/);assert.match(marionette,/"kick02", values\.data\(\), 60/);assert.ok(marionette.indexOf("rackWebDrumSamplesReady")<marionette.indexOf("struct MarionetteModule"));assert.equal(adaptDrumKitSampleAdapter(temporary,{plugin:"DrumKit",model:"Gnome"},"configParam<Blank>(2, 0.f, 1.f, 0.f, \"Run\");"),"configParam(2, 0.f, 1.f, 0.f, \"Run\");")}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("DanTSynth AOCR drops plugin-wide panel settings without changing its DSP state",()=>{
  const adapted=adaptDanTSynthAocrBrowserSource(`namespace DANT {
inline void saveSettings(json_t* rootJ) { auto path = rack::asset::user("settings.json"); }
inline json_t* readSettings() { auto path = rack::asset::user("settings.json"); return json_object(); }
inline void saveUserSettings() { saveSettings(json_object()); }
inline void loadUserSettings() { readSettings(); }
}
struct AocrModule : Module {
  json_t* dataToJson() override { DANT::saveUserSettings(); return json_object(); }
  void dataFromJson(json_t* rootJ) override { DANT::loadUserSettings(); }
  void process(const ProcessArgs&) override { auto clipped = rack::simd::clamp(inputs[0].getVoltage(), DANT::M_TEN, DANT::P_TEN); outputs[0].setVoltage(clipped[0]); }
};`);
  assert.doesNotMatch(adapted,/asset::user|saveUserSettings|loadUserSettings|saveSettings|readSettings/);
  assert.match(adapted,/dataToJson\(\) override \{\s*return json_object\(\);/);
  assert.match(adapted,/dataFromJson\(json_t\* rootJ\) override \{\s*\(void\)rootJ;/);
  assert.match(adapted,/outputs\[0\]\.setVoltage/);
  assert.match(adapted,/static const rack::simd::float_4 M_TEN\{-10\.0f\}/);
  assert.match(adapted,/static const rack::simd::float_4 P_TEN\{10\.0f\}/);
});

test("FV-1 emulator embeds its locked default SPN program without browser filesystem access",()=>{
  const source=`#include "rack_web_export.hpp"
#include "../fv1-emu/FV1emu.hpp"
#include "FV1emu.hpp"
#include "FV1.hpp"
struct FV1EmuModule : Module {
  std::string programs_json = asset::plugin(pluginInstance, "fx/programs.json");
  FV1EmuModule() { loadFx(asset::plugin(pluginInstance, "fx/demo.spn")); }
  bool loadPrograms(const std::string &programs_json) { if (system::isFile(programs_json)) return false; return true; }
  void loadFx(const std::string &file, bool scanDir = true) { fx.load(file); filesInPath = system::getEntries(file); }
  int selectedProgram; std::string lastPath, display; std::vector<std::string> filesInPath; FakeFx fx; std::vector<int> categories, programs;
};`,adapted=adaptFv1EmuBrowserSource(source,"sof 1,0\nwrax dacl,0\n");
  assert.match(adapted,/rackWebFv1DemoSpn/);
  assert.match(adapted,/sof 1,0\\nwrax dacl,0\\n/);
  assert.match(adapted,/programs_json = "builtin:\/\/programs\.json"/);
  assert.match(adapted,/loadFx\("builtin:\/\/demo\.spn"\)/);
  assert.match(adapted,/fx\.loadFromSPN\("demo\.spn", rackWebFv1DemoSpn\)/);
  assert.doesNotMatch(adapted,/asset::plugin|system::isFile|system::getEntries|fx\.load\(file\)/);
  assert.match(adapted,/#undef TEST\s*#include "\.\.\/fv1-emu\/FV1emu\.hpp"\s*#pragma pop_macro\("TEST"\)/);
  assert.equal((adapted.match(/#include "[^"]*FV1emu\.hpp"/g)??[]).length,1);
  assert.doesNotMatch(adapted,/#include "FV1\.hpp"/);
});

test("target module keeps its nearest same-named namespace enums",()=>{
  const adapted=preferNearestTargetEnums(`
namespace fixture::operators {
enum ParamId { DEPENDENCY_PARAM, PARAMS_LEN };
enum InputId { DEPENDENCY_INPUT, INPUTS_LEN };
}
namespace fixture::operators {
enum ParamId { TARGET_PARAM, PARAMS_LEN };
enum InputId { TARGET_INPUT, INPUTS_LEN };
struct TargetModule : Module {
  static constexpr int rackWebParamCount = 1;
  void process() { params[TARGET_PARAM]; inputs[TARGET_INPUT]; }
};
}
`);
  assert.doesNotMatch(adapted,/DEPENDENCY_PARAM|DEPENDENCY_INPUT/);
  assert.match(adapted,/TARGET_PARAM/);
  assert.match(adapted,/TARGET_INPUT/);
});

test("code position indexing distinguishes code from comments and literals",()=>{
  const source='int live = 1; // hidden token\nconst char* text = "hidden token";\n/* hidden token */ int visible = 2;\nauto raw = R"tag(hidden token)tag";';
  assert.equal(isCodePosition(source,source.indexOf("live")),true);
  assert.equal(isCodePosition(source,source.indexOf("hidden token")),false);
  assert.equal(isCodePosition(source,source.indexOf("hidden token",source.indexOf('"hidden token"'))),false);
  assert.equal(isCodePosition(source,source.indexOf("hidden token",source.indexOf("/*"))),false);
  assert.equal(isCodePosition(source,source.indexOf("visible")),true);
  assert.equal(isCodePosition(source,source.lastIndexOf("hidden token")),false);
});

test("polyphonic tape loops reserve fixed WASM memory for 48 kHz delay buffers",()=>{
  assert.equal(estimatedStaticMemory("class TapeLoop { std::vector<float> buffer; void resize() { buffer.resize(bufferLength); } };"),64*1024*1024);
});

test("PortlandWeather keeps its full 99 second 48 kHz delay range without 256 MiB of fixed rings",()=>{
  const adapted=adaptPortlandWeatherBrowserSource("#define DELAY_LINE_SIZE 1<<24\n#define HISTORY_SIZE (1<<24)\nvoid process(const ProcessArgs &args) override {\n  run();\n}\n");
  assert.match(adapted,/#define DELAY_LINE_SIZE \(1 << 23\)/);
  assert.match(adapted,/#define HISTORY_SIZE \(1 << 23\)/);
  assert.match(adapted,/\(1 << 23\)\n#define HISTORY_SIZE/);
  assert.match(adapted,/void process\(const ProcessArgs &args\) override \{\n\s*sampleRate = args\.sampleRate;/);
  assert.equal(estimatedStaticMemory("MultiTapDelayLine<FloatFrame, 18> delayLine; constexpr int HISTORY_SIZE = 1 << 24; float reverseHistoryBuffer[2];"),144*1024*1024);
  assert.ok((1<<23)>99*48000);
});

test("StringTheory uses its declared history size for eight browser delay lines",()=>{
  const adapted=adaptStringTheoryBrowserSource("#define DELAY_LINE_SIZE 1<<24\nfloat index = (delay * sampleRate) + sampleAdjust;\n");
  assert.match(adapted,/#define DELAY_LINE_SIZE \(1 << 21\)/);
  assert.match(adapted,/float index = std::min\(\(delay \* sampleRate\) \+ sampleAdjust, float\(DELAY_LINE_SIZE - 4\)\);/);
  assert.ok((1<<21)>(.5+.02)*48000*(2**6));
});

test("GP Rotary builds its fractional-delay FIRs in contiguous browser memory",()=>{
  const adapted=adaptGpRotaryBrowserSource(`class MilliSampleDelayLine { float* m_pDelayLine = nullptr; mutex m_mtxIRs; float** m_ppIRs = nullptr; mutex m_mtxOldIRs; list<pair<int, float**>> m_lstOldIRs; mutex m_mtxTempIRs; float** m_ppTempIRs = nullptr; };
bool MilliSampleDelayLine::BuildIRs(float fCutoffFrequency) { lock_guard<mutex> lock(m_mtxTempIRs); return false; }
void MilliSampleDelayLine::DeleteTempIRs() { for (int nSub = 0; nSub < N_SUBSAMPLE; nSub++) delete [] m_ppTempIRs[nSub]; }
void MilliSampleDelayLine::DeleteIRs() { for (int nSub = 0; nSub < N_SUBSAMPLE; nSub++) delete [] m_ppIRs[nSub]; }
void MilliSampleDelayLine::UpdateIRs() { lock_guard<mutex> lock(m_mtxIRs); }
void MilliSampleDelayLine::DeleteOldIRs() { while (!m_lstOldIRs.empty()) m_lstOldIRs.pop_front(); }
void MilliSampleDelayLine::UpdateSamplerate(float) { delete m_pDelayLine; }`);
  assert.match(adapted,/float\* m_pIRStorage = nullptr/);
  assert.match(adapted,/m_pTempIRStorage = new float\[N_SUBSAMPLE \* N_TAPS\]/);
  assert.match(adapted,/m_pTempIRStorage \+ nSub \* N_TAPS/);
  assert.match(adapted,/rackWebRotaryFirHalf\[N_SUBSAMPLE \* N_TAPS \/ 2\]/);
  assert.doesNotMatch(adapted,/lock_guard<mutex>|blackmanHarrisWindow|delete \[\] m_ppTempIRs\[nSub\]|delete m_pDelayLine/);
  assert.match(adapted,/delete \[\] m_pDelayLine/);
});

test("MidiRecorder keeps recording DSP without desktop XML and file exports",()=>{
  const source=`struct MidiRecorder : Module {
    std::ofstream midiFile;
    std::string HexStringToByteString(std::string hex) {
      std::basic_string<uint8_t> bytes;
      uint16_t byte = 255;
      bytes.push_back(static_cast<uint8_t>(byte));
      return std::string(begin(bytes), end(bytes));
    }
    void loadDrumMap(std::string path) { XMLDocument doc; doc.LoadFile(path.c_str()); useDrumMap = true; }
    void CreateMidiFile(std::string fileName) { std::ofstream output(fileName); output << "MThd"; }
    json_t* dataToJson() override { json_t* rootJ = json_object(); return rootJ; }
    void dataFromJson(json_t* rootJ) override { (void)rootJ; }
    void process(const ProcessArgs& args) override { recording = args.sampleRate > 0; }
  };`;
  const adapted=adaptMidiRecorderBrowserBody(source);
  assert.doesNotMatch(adapted,/basic_string\s*<\s*uint8_t|XMLDocument|std::ofstream/);
  assert.match(adapted,/std::string bytes/);
  assert.match(adapted,/bytes\.push_back\(static_cast<char>\(byte\)\)/);
  assert.match(adapted,/json_object_set_new\(rootJ, "midiEvents", eventsJ\)/);
  assert.match(adapted,/eventCount = midiEvents\.size\(\)/);
  assert.match(adapted,/void process\(const ProcessArgs& args\) override \{ recording = args\.sampleRate > 0; \}/);
  assert.doesNotMatch(adaptMidiRecorderBrowserPrelude("using namespace tinyxml2;\nusing namespace rack;"),/tinyxml2/);
});

test("SVG panel width rejects percentage dimensions and falls back to the viewBox",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-svg-width-test-")),panel=path.join(temporary,"panel.svg");try{fs.writeFileSync(panel,'<svg width="100%" height="100%" viewBox="0 0 180 380"></svg>');assert.equal(svgPanelWidth(panel),180);fs.writeFileSync(panel,'<svg width="30mm" viewBox="0 0 90 380"></svg>');assert.equal(svgPanelWidth(panel),90)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("stb RGB pointer images use the browser image asset ABI",()=>{
  const source="unsigned char* imageData = nullptr; int imageWidth = 0; int imageHeight = 0; bool requestLoadDialog = false; float currentRed, currentGreen, currentBlue; void readPixelAtPlayhead() {} void loadImage(const std::string& filename) { int w, h, channels; imageData = stbi_load(filename.c_str(), &w, &h, &channels, 3); } void loadImageDialog() { osdialog_file(0, nullptr, nullptr, nullptr); } void reset() { stbi_image_free(imageData); }";
  const adapted=adaptStbImagePointerBrowserBody(source),contract=browserAssetSamplerContract(adapted),methods=browserAssetSamplerMethods(contract);
  assert.deepEqual(contract,{type:"image",maxSamples:4194304,maxSeconds:0,channels:4,mode:"rgba-image",storage:"rgb-pointer"});
  assert.doesNotMatch(adapted,/stbi_load|stbi_image_free|osdialog_file/);
  assert.match(methods,/browser:\/\/rgb/);
  assert.match(methods,/imageData\[pixel \* 3 \+ 2\]/)
});

test("custom Rack model factories preserve the module contract and browser model identity",()=>{
  const source=`
template <class TModule, class TWidget>
Model* createFixtureModel(std::string slug, int roles) {
  return createModel<TModule, TWidget>(slug);
}
Model* modelEngine = createFixtureModel<fixture::Engine, fixture::EngineWidget>(
  "Engine",
  3
);`;
  assert.deepEqual(modelRegistrations(source,"fixture.cpp").map(({moduleClass,widgetClass,slug})=>({moduleClass,widgetClass,slug})),[
    {moduleClass:"fixture::Engine",widgetClass:"fixture::EngineWidget",slug:"Engine"}
  ]);
  const customFactory=`struct FluxModel : plugin::Model {
    engine::Module* createModule() override { return new FluxImpl; }
    app::ModuleWidget* createModuleWidget(engine::Module* module) override { return createFluxWidget(static_cast<Flux*>(module)); }
  };
  Model* modelFlux = []() { plugin::Model* model = new FluxModel; model->slug = "Flux"; return model; }();`;
  assert.deepEqual(modelRegistrations(customFactory,"flux.cpp").map(({moduleClass,widgetClass,slug,customModelFactory})=>({moduleClass,widgetClass,slug,customModelFactory})),[
    {moduleClass:"FluxImpl",widgetClass:"FluxWidget",slug:"Flux",customModelFactory:"FluxModel"}
  ]);
  const rustCustom=[{index:customFactory.indexOf("Model* modelFlux"),variableSlug:"Flux",slugSource:'"Flux"',modelType:"FluxModel",moduleType:"FluxImpl",widgetClass:"FluxWidget",namespace:[],rust:true}];
  assert.deepEqual(modelRegistrations(customFactory,"flux.cpp",{},[],null,rustCustom).map(({moduleClass,widgetClass,slug,customModelFactory})=>({moduleClass,widgetClass,slug,customModelFactory})),[
    {moduleClass:"FluxImpl",widgetClass:"FluxWidget",slug:"Flux",customModelFactory:"FluxModel"}
  ]);
  const identity=namespaceGlobalDefinitions(source,"return modelEngine;");
  assert.match(identity,/Model\* modelEngine = new Model\{"Engine"\};/);
  assert.doesNotMatch(identity,/createFixtureModel|EngineWidget/);
});

test("Integral Flux browser isolation keeps DSP and preview ABI while removing desktop debug and native tracer surfaces",()=>{
  const body=adaptLeviathanIntegralFluxBrowserBody(`ModuleTeardownTimer teardownTimer {"IntegralFlux"};
  ~IntegralFluxImpl() override { teardownTimer.begin(id); }
  void process(const ProcessArgs&) override {
    if (isDragonKingDebugEnabled()) perf();
    if (!isDragonKingPreviewWidgetOptionsEnabled()) previewRenderMode = 0;
  }`);
  assert.doesNotMatch(body,/ModuleTeardownTimer|teardownTimer|isDragonKingDebugEnabled|isDragonKingPreviewWidgetOptionsEnabled/);
  assert.match(body,/~IntegralFluxImpl\(\) override \{\}/);
  const prelude=adaptLeviathanIntegralFluxBrowserPrelude(`template <size_t N> struct WavePreviewBufferedTracer { void* imageVg; };
  struct RequiredDspType {};`);
  assert.doesNotMatch(prelude,/WavePreviewBufferedTracer|imageVg/);
  assert.match(prelude,/WavePreviewTracerCaptureStats/);
  assert.match(prelude,/WAVE_PREVIEW_TRACER_CURVE_CACHE/);
  const adapter=adaptIntegralFluxBrowserSource("struct IntegralFluxImpl {}; RACK_WEB_EXPORTS(IntegralFluxImpl)");
  assert.match(adapter,/struct RackWebIntegralFluxModule : IntegralFluxImpl/);
  assert.match(adapter,/rackWebVisualCount\(\) const override/);
  assert.match(adapter,/getPreviewState\(channel/);
  assert.match(adapter,/RACK_WEB_EXPORTS\(RackWebIntegralFluxModule\)/);
});

test("Proc browser isolation preserves its live preview ABI while removing desktop metrics and filesystem visuals",()=>{
  const body=adaptLeviathanProcBrowserBody(`ModuleTeardownTimer teardownTimer {"Proc"};
  debug_terminal::BaselineModuleMetrics debugMetrics;
  Proc() { debugMetrics.assignInstanceId(gProcDebugInstanceCounter); }
  ~Proc() override { teardownTimer.begin(id); }
  void process(const ProcessArgs&) override {
    const bool measurePerf = isDragonKingDebugEnabled();
    const auto processStart = debug_terminal::debugTimerStart(measurePerf);
    if (measurePerf) { debugMetrics.recordProcess(debug_terminal::elapsedNsSince(processStart)); }
  }
  void getPreviewState(float&, float&, float&, float&, float&, bool&, bool&, uint32_t&) const {}`);
  assert.doesNotMatch(body,/ModuleTeardownTimer|teardownTimer|debug_terminal|isDragonKingDebugEnabled/);
  assert.match(body,/~Proc\(\) override \{\}/);
  assert.match(body,/rackWebVisualCount\(\) const override/);
  assert.match(body,/getPreviewState\(riseTime, fallTime, curveSigned/);
  assert.match(body,/rackWebPreview = \{riseTime, fallTime/);
  const prelude=adaptLeviathanProcBrowserPrelude(`template <size_t N> struct WavePreviewBufferedTracer { void* imageVg; };
  struct RequiredDspType {};`);
  assert.doesNotMatch(prelude,/WavePreviewBufferedTracer|imageVg/);
  assert.match(prelude,/WAVE_PREVIEW_TRACER_CURVE_CACHE/);
});

test("Undertow browser isolation preserves source oscillator state and 256-point preview while removing desktop logging",()=>{
  const body=adaptLeviathanUndertowBrowserBody(`ModuleTeardownTimer teardownTimer {"Undertow"};
  debug_terminal::BaselineModuleMetrics debugMetrics;
  enum { PARAMS_LEN=6, INPUTS_LEN=6, OUTPUTS_LEN=3, LIGHTS_LEN=3, EDGE_HARDNESS_PARAM=5, COARSE_PARAM=0 };
  std::atomic<float> displayFrequencyHz {0.f}, displayShapeAmount {0.f};
  std::atomic<bool> shapeEntryAsymmetry {false}, shapeEntryAsymmetryOnRight {false};
  std::atomic<bool> previewTracerEnabled {true}, analogCharacterEnabled {true};
  std::atomic<int> previewTracerCacheMode {0};`);
  assert.doesNotMatch(body,/ModuleTeardownTimer|debug_terminal/);
  assert.match(body,/static constexpr int NUM_PARAMS = PARAMS_LEN/);
  assert.match(body,/float rackWebPreview\[264\]/);
  assert.match(body,/undertow_shape::thresholdFold/);
  assert.match(body,/rackWebPreview\[8 \+ index\]/);
  const prelude=adaptLeviathanUndertowBrowserPrelude("struct RequiredUndertowShape {};");
  assert.match(prelude,/WAVE_PREVIEW_TRACER_CURVE_CACHE/);
  const adapter=adaptLeviathanUndertowBrowserImplementation(`struct ModuleTeardownTimer {};
bool isDragonKingDebugEnabled();
bool isDragonKingPreviewWidgetOptionsEnabled();
struct UndertowFreqQuantity : ParamQuantity { float getDisplayValue() override; };
struct Undertow final : Module {
  ModuleTeardownTimer teardownTimer {"Undertow"};
  enum { COARSE_PARAM, EDGE_HARDNESS_PARAM=5, PARAMS_LEN=6, INPUTS_LEN=6, OUTPUTS_LEN=3, LIGHTS_LEN=3 };
  std::atomic<float> displayFrequencyHz {0.f}, displayShapeAmount {0.f};
  std::atomic<bool> shapeEntryAsymmetry {false}, shapeEntryAsymmetryOnRight {false};
  std::atomic<bool> previewTracerEnabled {true}, analogCharacterEnabled {true};
  std::atomic<int> previewTracerCacheMode {0};
  debug_terminal::BaselineModuleMetrics debugMetrics;
  ~Undertow() override;
};
Undertow::~Undertow() { teardownTimer.begin(id); }
void configure(Undertow* module) { module->configParam<UndertowFreqQuantity>(0, 0.f, 1.f, .5f, "Frequency"); }`);
  assert.doesNotMatch(adapter,/ModuleTeardownTimer|UndertowFreqQuantity|debug_terminal/);
  assert.match(adapter,/rackWebVisualCount\(\) const override/);
  assert.match(adapter,/configParam\(0, 0\.f, 1\.f/);
  assert.match(adapter,/Undertow::~Undertow\(\) \{\}/);
});

test("Temporal Deck browser adapter preserves the source engine, in-memory audio asset, transport, lights, state, and reset ABI",()=>{
  const adapter=browserTemporalDeckAdapterSource(
    {key:"Leviathan/TemporalDeck"},
    {sourceUrl:"https://example.test/Leviathan"},
    "GPL-3.0-or-later",
    "src/TemporalDeck.hpp",
    "src/TemporalDeckUI.cpp",
  );
  assert.match(adapter,/#include "TemporalDeckEngine\.hpp"/);
  assert.match(adapter,/rackWebAssetSampleCapacity = 960000/);
  assert.match(adapter,/engine\.installSample/);
  assert.match(adapter,/configButton\(FREEZE_PARAM/);
  assert.match(adapter,/rackWebVisual = \{engine\.platterPhase/);
  assert.match(adapter,/temporaldeck_expander::populateHostMessage/);
  assert.match(adapter,/scope->leftExpander\.messageFlipRequested = true/);
  assert.match(adapter,/json_object_set_new\(root, "sampleLoopEnabled"/);
  assert.match(adapter,/RACK_WEB_EXPORTS\(RackWebTemporalDeckModule\)/);
  assert.doesNotMatch(adapter,/asset::|system::|osdialog|APP->|ifstream|ofstream/);
});

test("TD.Scope browser adapter preserves the source message protocol, scope settings, two lights, and dynamic waveform ABI",()=>{
  const adapter=browserTdScopeAdapterSource(
    {key:"Leviathan/TDScope"},
    {sourceUrl:"https://example.test/Leviathan"},
    "GPL-3.0-or-later",
    "src/TDScope.hpp",
    "src/TDScopeWidget.cpp",
  );
  assert.match(adapter,/#include "TemporalDeckExpanderProtocol\.hpp"/);
  assert.match(adapter,/config\(0, 0, 0, LIGHTS_LEN\)/);
  assert.match(adapter,/std::array<float, kVisualHeader \+ kRows \* 4>/);
  assert.match(adapter,/scopeDisplayRangeMode = 3/);
  assert.match(adapter,/scopeColorBrightness = \.5f/);
  assert.match(adapter,/populateDisplayRequest/);
  assert.match(adapter,/RACK_WEB_EXPORTS\(RackWebTdScopeModule\)/);
  assert.doesNotMatch(adapter,/asset::|system::|APP->|nanovg|OpenGL/);
});

test("split-panel renderer SVGs provide source-accurate Rack panel widths",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-split-panel-width-")),sourceRoot=path.join(temporary,"src"),resourceRoot=path.join(temporary,"res");
  fs.mkdirSync(sourceRoot,{recursive:true});fs.mkdirSync(resourceRoot,{recursive:true});
  try{
    fs.writeFileSync(path.join(sourceRoot,"Flux.cpp"),'struct FluxWidget : ModuleWidget { FluxWidget() { visual_assets::SplitPanelRenderer panel(this, "res/flux.panel.svg"); } };');
    fs.writeFileSync(path.join(resourceRoot,"flux.panel.svg"),'<svg width="101.6mm" height="128.5mm" viewBox="0 0 10160 12850"></svg>');
    assert.equal(widgetPanelWidth(sourceRoot,"FluxWidget"),300);
  }finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("custom loadPanel helpers provide source-accurate Rack panel widths",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-load-panel-width-")),sourceRoot=path.join(temporary,"src"),resourceRoot=path.join(temporary,"res");
  fs.mkdirSync(sourceRoot,{recursive:true});fs.mkdirSync(resourceRoot,{recursive:true});
  try{
    fs.writeFileSync(path.join(sourceRoot,"Lab.cpp"),'struct LabWidget : ModuleWidget { LabWidget() { loadPanel("res/Lab.svg"); } };');
    fs.writeFileSync(path.join(resourceRoot,"Lab.svg"),'<svg width="137" height="380" viewBox="0 0 137 380"></svg>');
    assert.equal(widgetPanelWidth(sourceRoot,"LabWidget"),137);
  }finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("host model discovery ignores DSP members whose names start with model",()=>{
  const source=`
extern rack::plugin::Model* modelSapphireEcho;
ShiftQueue<16, 4096> modelOutQueue;
Frame<16> modelOutFrame;
Resampler::ModelSampleRateChooser modelRateChooser;
int modelOutFrameCount = 0;
if (neighbor->model == modelSapphireEcho) connect(neighbor);
`;
  assert.deepEqual(referencedHostModels(source),["modelSapphireEcho"]);
});

test("dependency discovery ignores primitive declarations and constants already provided by macros",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-symbol-collision-test-"));
  try{
    const sourceDir=path.join(temporary,"plugin"),src=path.join(sourceDir,"src");
    fs.mkdirSync(src,{recursive:true});
    const target=path.join(src,"target.h");
    fs.writeFileSync(target,"#define NUMBER_OF_STEPS 16\n");
    fs.writeFileSync(path.join(src,"decoder.h"),"DECODER_API void decoder_open(size_t bytes);\n");
    fs.writeFileSync(path.join(src,"neighbor.h"),"namespace neighbor { const int NUMBER_OF_STEPS = 32; }\n");
    fs.writeFileSync(path.join(src,"enum-collision.h"),"const int UNIPOLAR = 0;\nconst int BIPOLAR = 1;\n");
    const result=referencedDependencyBundleForAdapter([target],"enum Polarity { UNIPOLAR, BIPOLAR }; void process(size_t index) { int steps = NUMBER_OF_STEPS; (void) index; (void) steps; }",new Set([target]),sourceDir);
    assert.deepEqual(result.files,[]);
    assert.equal(result.source,"");
    fs.writeFileSync(path.join(src,"plugin.hpp"),"#pragma once\n");
    assert.equal(referencedPluginGlobalParts(sourceDir,"int steps = NUMBER_OF_STEPS;").declarations,"");
  }finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("namespace global discovery keeps initialized extern constants but skips declarations",()=>{
  const source="namespace constants {\nextern const float gate_low_trigger;\nextern const float gate_high_trigger { 2.0f };\n}\n";
  const globals=namespaceGlobalDefinitions(source,"constants::gate_high_trigger");
  assert.match(globals,/extern const float gate_high_trigger \{ 2\.0f \}/);
  assert.doesNotMatch(globals,/gate_low_trigger/);
});

test("host-only method stubs preserve following preprocessor line boundaries",()=>{
  const adapted=stubHostOnlyModuleMethods('void loadData(std::string path) { FILE* file = fopen(path.c_str(), "r"); }\n#ifndef BROWSER\nvoid nativeOnly() {}\n#endif');
  assert.match(adapted,/loadData\s*\([^)]*\)\s*\{\}\n#ifndef BROWSER/);
  assert.doesNotMatch(adapted,/\{\}#ifndef/);
});

test("host-only clipboard interop methods are stubbed without removing DSP processing",()=>{
  const adapted=stubHostOnlyModuleMethods(`
    void interopCopySeq() {
      IoStep* steps = fillIoSteps();
      interopCopySequence(16, steps);
    }
    void interopPasteChord() {
      std::vector<IoNote>* notes = interopPasteSequenceNotes(1024, nullptr);
      applyNotes(notes);
    }
    void process(const ProcessArgs& args) override {
      outputs[0].setVoltage(inputs[0].getVoltage());
    }
  `);
  assert.match(adapted,/interopCopySeq\s*\(\s*\)\s*\{\}/);
  assert.match(adapted,/interopPasteChord\s*\(\s*\)\s*\{\}/);
  assert.doesNotMatch(adapted,/interop(?:Copy|Paste)Sequence/);
  assert.match(adapted,/process\s*\([^)]*\)\s*override\s*\{[\s\S]*outputs\[0\]\.setVoltage/);
});

test("host-only method stubs use Rust direct inline-member ranges",()=>{
  const adapted=stubHostOnlyModuleMethods(`
    void loadData(std::string path) { FILE* file = fopen(path.c_str(), "r"); }
    bool validateHost() { return APP->scene != nullptr; }
    void process(const ProcessArgs& args) override { outputs[0].setVoltage(inputs[0].getVoltage()); }
    struct Nested {
      bool validateHost() { return APP->scene != nullptr; }
    };
  `);
  assert.match(adapted,/loadData\s*\([^)]*\)\s*\{\}/);
  assert.match(adapted,/bool validateHost\(\)\{ return \{\}; \}/);
  assert.match(adapted,/process\s*\([^)]*\)\s*override\s*\{[\s\S]*outputs\[0\]\.setVoltage/);
  assert.match(adapted,/struct Nested[\s\S]*bool validateHost\(\) \{ return APP->scene != nullptr; \}/);
});

test("DSP value holders named Slider survive UI stripping",()=>{
  const source="struct DPSlider { double value = 0.0; double getValue() { return value; } void setValue(double next) { value = next; } }; struct DPSliderDisplay : TransparentWidget { void draw(const DrawArgs&) {} };";
  const stripped=stripRackUiBlocks(source);
  assert.match(stripped,/struct DPSlider\b/);
  assert.doesNotMatch(stripped,/DPSliderDisplay/);
});

test("target body UI callbacks are removed without stripping DSP methods",()=>{
  const stripped=stripUiClassMembers(`
    std::array<LEDDisplay*, 8> displays;
    NVGcolor foreground = nvgRGBf(0.1f, 0.2f, 0.3f);
    void draw(const widget::Widget::DrawArgs& args) override;
    void process(const ProcessArgs& args) override { outputs[0].setVoltage(inputs[0].getVoltage()); }
    bool validateHost() { return APP->scene != nullptr; }
    struct Nested { bool validateHost() { return APP->scene != nullptr; } };
  `);
  assert.doesNotMatch(stripped,/LEDDisplay|DrawArgs|\bdraw\s*\(/);
  assert.match(stripped,/NVGcolor foreground = nvgRGBf/);
  assert.match(stripped,/\bprocess\s*\(/);
  assert.match(stripped,/bool validateHost\(\)\{ return \{\}; \}/);
  assert.match(stripped,/struct Nested[\s\S]*return APP->scene != nullptr/);
});

test("native UI pointer stripping removes guarded and nested graph access",()=>{
  const source=`
GraphWidget* graph = nullptr;
TimeKnob* timeKnob = nullptr;
void onRemove() {
  if (graph) {
    graph->owner = nullptr;
    graph = nullptr;
  }
  if (timeKnob) timeKnob->owner = nullptr;
}
void process() {
  if (clear()) {
    if (graph)
      graph->initialize();
  }
  if (graph && ready()) {
    graph->process();
  }
}`;
  const stripped=stripNativeUiPointerBridges(source);
  assert.doesNotMatch(stripped,/\b(?:graph|timeKnob)\b/);
  assert.match(stripped,/void process/);
});

test("native UI pointer stripping preserves DSP multiplication identifiers ending in Knob",()=>{
  const source=`
SpectrumDisplay* spectrum = nullptr;
void process() {
  float levelKnob = 0.5f;
  float muteFactor = 0.75f;
  float returnFrame = 2.f;
  float output = levelKnob * muteFactor * returnFrame;
  if (spectrum) spectrum->process();
}`;
  const stripped=stripNativeUiPointerBridges(source);
  assert.doesNotMatch(stripped,/\bspectrum\b/);
  assert.match(stripped,/output\s*=\s*levelKnob\s*\*\s*muteFactor\s*\*\s*returnFrame/);
});

test("source discovery excludes native audio hosts and development-only tools",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-source-discovery-test-"));
  try{
    fs.mkdirSync(path.join(temporary,"src"),{recursive:true});
    fs.mkdirSync(path.join(temporary,"util","cmdline"),{recursive:true});
    fs.writeFileSync(path.join(temporary,"src","module.cpp"),"struct Module {};\n");
    fs.writeFileSync(path.join(temporary,"util","miniaudio.h"),"#define MINIAUDIO_IMPLEMENTATION\n");
    fs.writeFileSync(path.join(temporary,"util","cmdline","host.cpp"),"int main() {}\n");
    assert.deepEqual(filesOutsideNestedRepositories(temporary),[fs.realpathSync(path.join(temporary,"src","module.cpp"))]);
  }finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("UI stripping preserves enum classes and template static members remain extractable",()=>{
  const source=`
namespace Fixture {
enum
class Role { None, Sender };
struct Widget : ModuleWidget {};
template <typename T, std::size_t N>
struct Interpolator { static const std::array<T, N> table; };
template <typename T, std::size_t N>
const std::array<T, N> Interpolator<T, N>::table {};
}`;
  const stripped=stripRackUiBlocks(source);
  assert.match(stripped,/enum\s+class Role\s*\{\s*None,\s*Sender\s*\}/);
  assert.doesNotMatch(stripped,/struct Widget/);
  assert.deepEqual(outOfLineStaticDefinitions(source,"Interpolator"),[
    "template <typename T, std::size_t N>\nconst std::array<T, N> Interpolator<T, N>::table {};"
  ])
});

test("UI stripping preserves mixed DSP helpers while removing their menu methods",()=>{
  const source=`
struct ToggleGroup {
  Module* module = nullptr;
  GateTriggerReceiver trigger;
  void initialize(Module* owner) { module = owner; }
  void process(const ProcessArgs& args) { trigger.process(args.sampleTime); }
  void addMenuItems(Menu* menu) { menu->addChild(new MenuItem); }
};
struct ToggleGroupWidget : ModuleWidget {
  ToggleGroupWidget() { addParam(createParam<Knob>()); }
};
`;
  const stripped=stripRackUiBlocks(source);
  assert.match(stripped,/struct ToggleGroup\b/);
  assert.match(stripped,/\bvoid process\s*\(/);
  assert.doesNotMatch(stripped,/\baddMenuItems\s*\(/);
  assert.doesNotMatch(stripped,/ToggleGroupWidget/);
});

test("UI stripping preserves DSP engines and state helpers with visual-only methods",()=>{
  const source=`
template <typename T> struct SingleChannelEngine {
  T gainKnob = 0;
  FilterResult<T> process(float sampleRate, T input) { return filter.process(sampleRate, input); }
};
struct TimeKnobInfo {
  bool clockConnected = false;
  void initialize() { clockConnected = false; }
  NVGcolor color() const { return nvgRGB(1, 2, 3); }
};
`;
  const stripped=stripRackUiBlocks(source);
  assert.match(stripped,/SingleChannelEngine/);
  assert.match(stripped,/\bprocess\s*\(/);
  assert.match(stripped,/TimeKnobInfo/);
  assert.match(stripped,/\binitialize\s*\(/);
  assert.doesNotMatch(stripped,/\bNVGcolor\b|\bnvgRGB\b/);
});

test("Chrysalis browser adaptation flushes deferred shred removal before compiling replacement code",()=>{
  const source=`
struct Chrysalis : Module {
  ::ChucK *the_chuck = nullptr;
  float *inBuffer = nullptr;
  float *outBuffer = nullptr;
  bool chuckReady = false;
  std::atomic<bool> compileFailed{false};
  Chrysalis() { config(0, 0, 0, 0); initChucK(); }
  json_t *dataToJson() override { return json_object(); }
  void dataFromJson(json_t *rootJ) override {}
  void initChucK() { the_chuck = new ::ChucK(); the_chuck->setParam(CHUCK_PARAM_OUTPUT_CHANNELS, 4); }
  void loadFile(std::string path) { the_chuck->compileFile(path); }
  void reloadFile() { loadFile(currentFilePath); }
};`;
  const adapted=adaptChrysalisBrowserBody(source),removeIndex=adapted.indexOf("the_chuck->removeAllShreds()"),flushIndex=adapted.indexOf("the_chuck->run(inBuffer, outBuffer, 1)"),compileIndex=adapted.indexOf("the_chuck->compileCode");
  assert.ok(removeIndex>=0&&flushIndex>removeIndex&&compileIndex>flushIndex);
  assert.match(adapted,/for \(int channel = 0; channel < 4; channel\+\+\)/);
  assert.match(adapted,/json_object_set_new\(rootJ, "code", json_string\(currentCode\.c_str\(\)\)\)/);
  assert.doesNotMatch(adapted,/compileFile\s*\(/);
});

test("Clonotribe browser adaptation omits its Rack-only ribbon widget",()=>{
  const source="DrumProcessor drumProcessor; RibbonController ribbonController; Clonotribe() : filterProcessor(ms20Filter), ribbonController(this) {}";
  const adapted=adaptClonotribeBrowserBody(source);
  assert.doesNotMatch(adapted,/RibbonController\s+ribbonController/);
  assert.doesNotMatch(adapted,/ribbonController\s*\(\s*this\s*\)/);
  assert.match(adapted,/Clonotribe\(\) : filterProcessor\(ms20Filter\)/);
});

test("Hoyer scanning divider keeps ratio triggers without shadowing Rack input ports",()=>{
  const adapted=adaptHoyerScanningDivisionBrowserBody("dsp::SchmittTrigger inputs[8]; bool edge = inputs[i].isHigh(); int sync = engine.syncCheck[c+i].processEvent(0.f); engine.phase[c + i] = 0.f; float voltage = getInput(SYNC_INPUT).getVoltage();");
  assert.match(adapted,/dsp::SchmittTrigger rackWebRatioInputs\[8\]/);
  assert.match(adapted,/rackWebRatioInputs\[i\]\.isHigh\(\)/);
  assert.match(adapted,/engine\.syncCheck\[i\]\.processEvent/);
  assert.match(adapted,/engine\.phase\[i\]\s*=\s*0\.f/);
  assert.doesNotMatch(adapted,/engine\.[A-Za-z]+\s*\[\s*c\s*\+/);
  assert.match(adapted,/getInput\(SYNC_INPUT\)/);
  assert.doesNotMatch(adapted,/\binputs\s*\[/);
});

test("Cella loudness modules keep engine sample-rate methods and link their vendored C analyzer",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-cella-loudness-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output"),loudOutput=path.join(temporary,"loud-output"),src=path.join(plugin,"src"),ebur=path.join(plugin,"deps","ebur128"),queue=path.join(ebur,"queue","sys");fs.mkdirSync(src,{recursive:true});fs.mkdirSync(queue,{recursive:true});
  fs.writeFileSync(path.join(plugin,"plugin.json"),JSON.stringify({slug:"Cella",name:"Cella fixture",version:"2.10.0",license:"GPL-3.0-or-later",brand:"Cella",sourceUrl:"https://github.com/example/cella",modules:[{slug:"LoudnessMeter",name:"Loudness Meter",description:"EBU fixture",tags:["Visual"]},{slug:"Loud",name:"Loud",description:"Narrow EBU fixture",tags:["Visual"]}]},null,2));
  fs.writeFileSync(path.join(src,"plugin.hpp"),'#pragma once\n#include <rack.hpp>\nusing namespace rack;\nextern Model* modelLoudnessMeter;\nextern Model* modelLoud;\n');
  fs.writeFileSync(path.join(ebur,"ebur128.h"),'#pragma once\n#include <stddef.h>\n#ifdef __cplusplus\nextern "C" {\n#endif\ntypedef struct ebur128_state { float value; } ebur128_state;\nebur128_state* ebur128_init(size_t channels, size_t sample_rate, int mode);\nfloat ebur128_measure(const ebur128_state* state);\n#ifdef __cplusplus\n}\n#endif\n');
  fs.writeFileSync(path.join(queue,"queue.h"),"#pragma once\n#define FIXTURE_QUEUE_SCALE 2.f\n");
  fs.writeFileSync(path.join(ebur,"ebur128.c"),'#include "ebur128.h"\n#include <sys/queue.h>\nstatic ebur128_state fixture_state;\nebur128_state* ebur128_init(size_t channels, size_t sample_rate, int mode) { (void)channels; (void)mode; fixture_state.value = (float)sample_rate / 24000.f * FIXTURE_QUEUE_SCALE; return &fixture_state; }\nfloat ebur128_measure(const ebur128_state* state) { return state ? state->value : 0.f; }\n');
  fs.writeFileSync(path.join(src,"LoudnessMeter.cpp"),'#include "plugin.hpp"\n#include "ebur128.h"\nstruct LoudnessMeter : Module { enum OutputIds { SIGNAL_OUTPUT, NUM_OUTPUTS }; ebur128_state* handle = nullptr; LoudnessMeter() { config(0, 0, NUM_OUTPUTS, 0); configOutput(SIGNAL_OUTPUT, "Measured"); resetMeter(); } void resetMeter() { handle = ebur128_init(1, (size_t)APP->engine->getSampleRate(), 0); } void onSampleRateChange(const SampleRateChangeEvent&) override { resetMeter(); } void process(const ProcessArgs&) override { outputs[SIGNAL_OUTPUT].setVoltage(ebur128_measure(handle)); } }; struct LoudnessMeterWidget : ModuleWidget {}; struct LoudWidget : ModuleWidget {}; Model* modelLoudnessMeter = createModel<LoudnessMeter, LoudnessMeterWidget>("LoudnessMeter"); Model* modelLoud = createModel<LoudnessMeter, LoudWidget>("Loud");\n');
  try{for(const [model,destination] of [["LoudnessMeter",output],["Loud",loudOutput]]){execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),`https://library.vcvrack.com/Cella/${model}`,"--manifest-file",path.join(plugin,"plugin.json"),"--source-dir",plugin,"--output",destination,"--compile","--use-rust-analysis"],{encoding:"utf8"});const adapter=fs.readFileSync(path.join(destination,"adapter.cpp"),"utf8");assert.match(adapter,/#include "ebur128\.h"/);assert.match(adapter,/void resetMeter\(\)\s*\{\s*handle = ebur128_init/);const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(destination,"module.wasm"))),{}).exports;wasm._initialize();wasm.rack_web_set_output_connected(0,1);wasm.rack_web_process(1,44100);assert.ok(Math.abs(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0]-3.675)<1e-5)}}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("RackNES adapter keeps declarations ahead of separately linked emulator implementations",()=>{
  const adapted=adaptRackNesBrowserSource(`// header
#include "rack_web_export.hpp"
const bool true = 1;
namespace NES { static constexpr int broken = MissingType::value; }
struct CVButtonTrigger { bool process(float, float) { return false; } };
struct RackNES : Module {};
RACK_WEB_EXPORTS(RackNES)`);
  assert.match(adapted,/#include "nes\/emulator\.hpp"/);
  assert.match(adapted,/modelInputGenie = &rackWebHostModel0/);
  assert.doesNotMatch(adapted,/const bool true|MissingType/);
  assert.ok(adapted.indexOf('#include "nes/emulator.hpp"')<adapted.indexOf("struct CVButtonTrigger"));
});

test("LessMess adapter snapshots browser-backed cable labels instead of stripped Rack text fields",()=>{
  const adapted=adaptLessMessBrowserSource(`struct LessMess { std::string labels[9]; };
json_t *LessMess::dataToJson() { json_t *rootJ = json_object(); std::string tmps; json_object_set_new(rootJ, "label0", json_string(tmps.c_str())); return rootJ; }`);
  assert.match(adapted,/json_string\(labels\[index\]\.c_str\(\)\)/);
  assert.doesNotMatch(adapted,/std::string tmps/);
});

test("adapter normalization preserves one generic implementation and protects enum identifiers",()=>{
  const templateSource='namespace fixture {\ntemplate<int N> struct Bank { Bank(); float next(float value); struct OffsetQuantity : ParamQuantity { float getDisplayValue() override { return getValue(); } }; };\ntemplate<int N> Bank<N>::Bank() {}\ntemplate<int N> float Bank<N>::next(float value) { return value + N; }\ntemplate<int N> Bank<N>::Bank() {}\ntemplate<int N> float Bank<N>::next(float value) { return value + N; }\n}\nRACK_WEB_EXPORTS(fixture::Bank<1>)\n',deduped=dedupeOutOfLineMethodDefinitions(templateSource);
  assert.equal([...deduped.matchAll(/Bank<N>::Bank\s*\(/g)].length,1);assert.equal([...deduped.matchAll(/Bank<N>::next\s*\(/g)].length,1);assert.match(deduped,/RACK_WEB_EXPORTS\(fixture::Bank<1>\)/);assert.deepEqual(paramQuantityHelpers(templateSource,"OffsetQuantity"),[]);
  const macroInlineSource="namespace fixture {\nclass Engine { int output(); };\nRESID_INLINE\nint Engine::output() { return 1; }\n}\nnamespace fixture {\nint Engine::output() { return 2; }\n}\n",macroInlineDeduped=dedupeOutOfLineMethodDefinitions(macroInlineSource);assert.equal([...macroInlineDeduped.matchAll(/int Engine::output\s*\(/g)].length,1);
  const overloadSource="namespace left {\nstruct Engine { int value(int) const; int value(float) const; int value(int); };\nint Engine::value(int input) const { return input; }\nint Engine::value(int input) const /* duplicate */ { return input + 10; }\nint Engine::value(float input) const { return int(input); }\nint Engine::value(int input) { return input + 1; }\n}\nnamespace right {\nstruct Engine { int value(int) const; };\nint Engine::value(int input) const { return input + 2; }\n}\n",overloadDeduped=dedupeOutOfLineMethodDefinitions(overloadSource);assert.equal([...overloadDeduped.matchAll(/Engine::value\s*\(/g)].length,4);assert.doesNotMatch(overloadDeduped,/return input \+ 10/);assert.match(overloadDeduped,/value\(float input\) const/);assert.match(overloadDeduped,/value\(int input\) \{/);assert.match(overloadDeduped,/return input \+ 2/);
  const specialMembers="struct Engine { Engine(); ~Engine(); static const std::array<int, 2> values; };\nEngine::Engine() = default;\nEngine::~Engine() = default;\nconst std::array<int, 2> Engine::values{{1, 2}};\n";assert.deepEqual(outOfLineDefinitions(specialMembers,"Engine"),["Engine::Engine() = default;","Engine::~Engine() = default;"]);assert.deepEqual(outOfLineStaticDefinitions(specialMembers,"Engine"),["const std::array<int, 2> Engine::values{{1, 2}};"]);
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-enum-macro-test-")),macroFile=path.join(temporary,"macros.cpp");try{fs.writeFileSync(macroFile,'#if !defined(MACROS_CPP_GUARD)\n#define MACROS_CPP_GUARD 1\n#define POLY_INPUT "poly_input"\n#define SAFE_SCALE 2\n#define N 624\n#define INFINITY _INF\n#ifdef _WIN32\n#define ARCH_WIN\n#define WINDOWS_SCALE 4\n#endif\n#ifndef ARCH_WIN\n#define BROWSER_SCALE 3\n#endif\n#endif\n');const defines=referencedDefinesWithoutPluginGlobals([macroFile],"#if !defined(MACROS_CPP_GUARD)\nenum InputIds { POLY_INPUT, NUM_INPUTS }; //********************************************************* DSP values\ntemplate <typename T, int N> struct DelayLine { T values[N]; };\nfloat value = SAFE_SCALE + INFINITY; /* a real block comment */ float browser = WINDOWS_SCALE + BROWSER_SCALE;\n#endif");assert.doesNotMatch(defines,/#define MACROS_CPP_GUARD/);assert.doesNotMatch(defines,/#define POLY_INPUT/);assert.doesNotMatch(defines,/#define N 624/);assert.doesNotMatch(defines,/#define INFINITY/);assert.doesNotMatch(defines,/#define ARCH_WIN|#define WINDOWS_SCALE/);assert.match(defines,/#define SAFE_SCALE 2/);assert.match(defines,/#define BROWSER_SCALE 3/)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
  const usingPrelude=namespaceUsingPrelude('using namespace fixture;\nusing namespace fixture::dsp;\nusing namespace simd;\nusing namespace rack;\nusing namespace dsp;\nconst char* decoy = "using namespace fake;";\n// using namespace commented;\nvoid local() { using namespace local_only; }\nnamespace compact { using namespace compact_dsp; }\n');assert.match(usingPrelude,/using namespace fixture;/);assert.match(usingPrelude,/using namespace fixture::dsp;/);assert.match(usingPrelude,/namespace simd = rack::simd;/);assert.match(usingPrelude,/using namespace rack::simd;/);assert.match(usingPrelude,/using namespace rack::dsp;/);assert.match(usingPrelude,/using namespace compact_dsp;/);assert.doesNotMatch(usingPrelude,/namespace simd \{\}/);assert.doesNotMatch(usingPrelude,/namespace dsp \{\}/);assert.doesNotMatch(usingPrelude,/using namespace rack;/);assert.doesNotMatch(usingPrelude,/fake|commented|local_only/);
  const customDsp=namespaceUsingPrelude("using namespace dsp;\n");assert.match(customDsp,/namespace dsp \{\}/);assert.match(customDsp,/using namespace dsp;/);
  assert.deepEqual(standardDependencyIncludes("#ifdef _WIN32\n#include <winsock2.h>\n#else\n#include <fcntl.h>\n#include <unistd.h>\n#endif"),["#include <fcntl.h>","#include <unistd.h>"]);
  assert.deepEqual(standardDependencyIncludes("#ifdef ARCH_WIN\r\n#include <windows.h>\r\n#else\r\n#include <sys/socket.h>\r\n#endif\r\n"),["#include <sys/socket.h>"]);
  assert.deepEqual(features("OSCServer server(9000); server.start();"),["network"]);
  assert.deepEqual(features("param->send(value); output.send(value);"),[]);
  assert.deepEqual(features("virtual void send(int value); void send(int value) override; send(getValue());"),[]);
  assert.deepEqual(features("send(fd, data, size, 0);"),["network"]);
  const globals=namespaceGlobalDefinitions("namespace fixture {\nstatic unsigned int bitMasks[2] = {3u, 5u};\nstatic unsigned int selectedMask = bitMasks[1];\nstatic int unused = 7;\n}\n","return selectedMask;",["fixture"]);assert.match(globals,/bitMasks\[2\]/);assert.match(globals,/selectedMask = bitMasks\[1\]/);assert.doesNotMatch(globals,/unused/);assert.doesNotMatch(globals,/namespace fixture/);
  const modelIdentity=namespaceGlobalDefinitions('namespace fixture {\nModel* modelEngine = createModel<Engine,\n  EngineWidget>("Engine");\n}\n',"return modelEngine;",["fixture"]);assert.match(modelIdentity,/Model\* modelEngine = new Model\{"Engine"\};/);assert.doesNotMatch(modelIdentity,/createModel|EngineWidget/);
  const anonymousGlobals=namespaceGlobalDefinitions("namespace {\nconstexpr float VOLTAGE_SCALE = 5.f;\nconstexpr float OUTPUT_SCALE = VOLTAGE_SCALE * 2.f;\n}\n","return OUTPUT_SCALE;");assert.match(anonymousGlobals,/VOLTAGE_SCALE/);assert.match(anonymousGlobals,/OUTPUT_SCALE/);assert.doesNotMatch(anonymousGlobals,/namespace/);
  const functions=outOfLineFreeFunctionDefinitions("struct Filter { double render(double value) { return value + member; } double member = 1.; };\nnamespace fixture {\ndouble render(double value) { return value * 2.; }\n}\nstruct ExternalFilter { ExternalFilter(); double render(double value); };\nExternalFilter::ExternalFilter() {}\ndouble ExternalFilter::render(double value) { return value * 3.; }\nnamespace qualified { double render(double value); }\ndouble qualified::render(double value) { return value * 4.; }\n","render",true);assert.equal(functions.length,3);assert.match(functions[0],/namespace fixture/);assert.doesNotMatch(functions[0],/member/);assert.match(functions[1],/^double ExternalFilter::render/);assert.match(functions[2],/^double qualified::render/);assert.ok(functions.every(definition=>!definition.includes("ExternalFilter::ExternalFilter")));
  const localFunctions=referencedLocalFreeFunctionDefinitions("namespace fixture {\nusing word = unsigned int;\nword build(word value) { return value + 1; }\n}\n","return build(2);");assert.equal(localFunctions.length,1);assert.match(localFunctions[0],/^namespace fixture \{/);assert.match(localFunctions[0],/word build\(word value\)/);
  const localTemplates=referencedLocalFreeFunctionDefinitions("namespace fixture {\ntemplate <typename T>\nstatic T clampValue(T value, T low, T high) { return value < low ? low : (value > high ? high : value); }\n}\n","return clampValue<int>(value, 0, 10);");assert.equal(localTemplates.length,1);assert.match(localTemplates[0],/template <typename T>/);assert.match(localTemplates[0],/namespace fixture/);
  const functionPointer=referencedLocalFreeFunctionDefinitions("float ParserMax(float a, float b) { return a > b ? a : b; }\n","setFunction(\"max\", ParserMax);");assert.equal(functionPointer.length,1);assert.match(functionPointer[0],/float ParserMax/);
  const midiHelpers="constexpr int FirstKnob = 102;\nconstexpr int FirstSlider = 80;\ninline bool isKnob(int note) { return note >= FirstKnob; }\ninline int sliderIndex(int note) { return note - FirstSlider; }\n",strippedMidiHelpers=stripRackUiBlocks(midiHelpers);assert.match(strippedMidiHelpers,/inline bool isKnob/);assert.match(strippedMidiHelpers,/inline int sliderIndex/);assert.equal(referencedLocalFreeFunctionDefinitions(midiHelpers,"return isKnob(note) ? sliderIndex(note) : 0;").length,2);
  const constructorWithUiLabel='BaseModule::BaseModule() { configOutput(0, "Knob 1"); }';assert.match(stripRackUiBlocks(constructorWithUiLabel),/BaseModule::BaseModule/);
  const detachedReturn=outOfLineDefinitions("std::string\nRenderer::render(int value) { return std::to_string(value); }\n","Renderer");assert.equal(detachedReturn.length,1);assert.match(detachedReturn[0],/^std::string\s+Renderer::render/);
  const specializationSource="template <typename T>\nstruct Clamp { json_t* toJson(); };\nstruct UsesClamp { Clamp<int> clamp; json_t* save() { return clamp.toJson(); } };\ntemplate <>\njson_t* Clamp<int>::toJson() { return nullptr; }\n",specializationForwards=explicitSpecializationForwardDeclarations(outOfLineDefinitions(specializationSource,"Clamp")),forwardedSpecializations=insertExplicitSpecializationForwardDeclarations(specializationSource);assert.deepEqual(specializationForwards,["template <>\njson_t* Clamp<int>::toJson();"]);assert.ok(forwardedSpecializations.indexOf("Clamp<int>::toJson();")<forwardedSpecializations.indexOf("struct UsesClamp"));
  const anonymousEnumRoot=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-anonymous-enum-test-"));try{const header=path.join(anonymousEnumRoot,"Biquad.h");fs.writeFileSync(header,'// Legacy DSP header\n#ifndef BIQUAD_H\n#define BIQUAD_H\nenum { bq_type_lowpass = 0, bq_type_highpass };\nclass Biquad { public: float process(float value); };\n#endif\n');const dependency=referencedDependencyBundleForAdapter([header],"Biquad* filter; int type = bq_type_lowpass;",new Set(),anonymousEnumRoot);assert.match(dependency.source,/enum\s*\{\s*bq_type_lowpass\s*=\s*0,\s*bq_type_highpass\s*\};/)}finally{fs.rmSync(anonymousEnumRoot,{recursive:true,force:true})}
  const staticTables=outOfLineStaticDefinitions("namespace fixture {\nunsigned short Engine::table[2][8][1 << 12] = {{{0}}};\n}\n","Engine",true);assert.equal(staticTables.length,1);assert.match(staticTables[0],/^namespace fixture \{/);assert.match(staticTables[0],/table\[2\]\[8\]\[1 << 12\]/);
  const assignmentSource="namespace fixture {\nEngine& Engine::operator=(const Engine& other) {\n  if (this == &other) return *this;\n  value = other.value;\n  return *this;\n}\n}\n",assignmentOperators=outOfLineDefinitions(assignmentSource,"Engine",true);assert.equal(assignmentOperators.length,1);assert.match(assignmentOperators[0],/value = other\.value;[\s\S]*return \*this;/);assert.deepEqual(outOfLineStaticDefinitions(assignmentSource,"Engine",true),[]);
  const arithmeticReturn=outOfLineDefinitions("namespace fixture {\nstd::array<float, Config::COUNT + 1> Engine::edges(float sampleRate) const { return {}; }\n}\n","Engine",true);assert.equal(arithmeticReturn.length,1);assert.match(arithmeticReturn[0],/Config::COUNT \+ 1/);
  const decoratedReturn=outOfLineDefinitions("namespace fixture {\n[[nodiscard]] float Engine::render(float value) { return value; }\nauto Engine::read() -> std::tuple<float, int> { return {}; }\n}\n","Engine",true);assert.equal(decoratedReturn.length,2);assert.match(decoratedReturn[0],/\[\[nodiscard\]\] float Engine::render/);assert.match(decoratedReturn[1],/auto Engine::read\(\) -> std::tuple<float, int>/);
  const decoratedForwards=namespaceFunctionForwardDeclarations("#define FIXTURE_INLINE inline __attribute__((always_inline))\nstatic FIXTURE_INLINE int decoratedHelper() { return 1; }\n");assert.deepEqual(decoratedForwards,["static inline int decoratedHelper();"]);
  const crossHeaderForwards=namespaceFunctionForwardDeclarations("static_inline float generatedHelper(float value) { return value; }\n","#define static_inline static inline\n");assert.deepEqual(crossHeaderForwards,["static inline float generatedHelper(float value);"]);
  const defaultedForwards=namespaceFunctionForwardDeclarations('namespace fixture {\nstatic int configured(std::array<int, 2> value = std::array<int, 2>{1, 2}, const char* label = "left,right") { return value[0]; }\n}\n');assert.deepEqual(defaultedForwards,["namespace fixture {\nstatic int configured(std::array<int, 2> value, const char* label);\n}"]);
  const planarSamplerSource="void loadSample(std::string path) {} vector<vector<float>> playBuffer; drwav_uint64 totalSampleC; unsigned int sampleRate, channels; float samplePos; bool fileLoaded, loading, reload, play; float startPos; std::string lastPath;";const planarSampler=browserAssetSamplerContract(planarSamplerSource);assert.equal(planarSampler?.mode,"planar-stereo-buffer");const planarMethods=browserAssetSamplerMethods(planarSampler);assert.match(planarMethods,/playBuffer\[0\]\[frame\] = left/);assert.match(planarMethods,/fileLoaded = totalSampleC > 0/);
  assert.deepEqual(browserAssetSamplerContract("std::vector<AudioClip> clip_cache_; static const int MAX_FILES = 256; float getSamplePhase(double p); void startRec(int sampleRate); void switchRec(int sampleRate);"),{type:"audio",maxSamples:960000,maxSeconds:10,channels:2,mode:"lomas-advanced-sampler"});
  const monoPlanarSamplerSource="void loadSample(std::string path) {} vector<vector<float>> playBuffer; PLAY() { playBuffer.resize(1); } drwav_uint64 totalSampleCount; unsigned int sampleRate, channels; float samplePos; bool fileLoaded, loading, reload, run; std::string lastPath;";const monoPlanarSampler=browserAssetSamplerContract(monoPlanarSamplerSource);assert.equal(monoPlanarSampler?.planes,1);assert.equal(monoPlanarSampler?.countField,"totalSampleCount");const monoPlanarMethods=browserAssetSamplerMethods(monoPlanarSampler);assert.match(monoPlanarMethods,/run = false/);assert.doesNotMatch(monoPlanarMethods,/playBuffer\[1\]/);
  const fundamentalSource="Wavetable wavetable; void reset() { wavetable.reset(); } float getWave() { return wavetable.interpolatedAt(0, 0, 0); } void save() { if (!wavetable.samples.empty() && wavetable.waveLen > 0) {} }";const fundamentalContract=browserAssetSamplerContract(fundamentalSource);assert.equal(fundamentalContract?.mode,"fundamental-wavetable");const fundamentalMethods=browserAssetSamplerMethods(fundamentalContract);assert.match(fundamentalMethods,/wavetable\.samples\.resize/);assert.match(fundamentalMethods,/wavetable\.interpolate\(\)/);
  const earlevelSource="enum { POS_PARAM }; enum { LOADED_LIGHT }; Wavetable::Wavetable* wavetable; std::string currentTableName; void loadWavetable(std::string path, int cycleLength);";const earlevelContract=browserAssetSamplerContract(earlevelSource);assert.deepEqual(earlevelContract,{type:"audio",maxSamples:524288,maxSeconds:0,channels:2,mode:"earlevel-wavetable"});const earlevelMethods=browserAssetSamplerMethods(earlevelContract);assert.match(earlevelMethods,/nextCycleLength - 1 - frame % nextCycleLength/);assert.match(earlevelMethods,/wavetableOscillators\.push_back\(waveOsc/);assert.match(earlevelMethods,/browser:\/\/wavetable/);
  const midiPlayerSource="struct MIDIFile : smf::MidiFile {}; MIDIFile midiFile; bool fileLoaded; long playingEvent; void processMessage(int, smf::MidiMessage*);";const midiPlayerContract=browserAssetSamplerContract(midiPlayerSource);assert.deepEqual(midiPlayerContract,{type:"midi",maxSamples:4194304,maxSeconds:0,channels:1,mode:"midi-file"});const midiPlayerMethods=browserAssetSamplerMethods(midiPlayerContract);assert.match(midiPlayerMethods,/byteAt\(0\) != 'M'/);assert.match(midiPlayerMethods,/midiFile\.read\(input\)/);
  const luaModuleSource="lua_State *L; bool createLuaState(); bool scriptLoaded; static int scriptSetVoltage(lua_State*); static const int SCRIPT_PORTS = 8;";const luaModuleContract=browserAssetSamplerContract(luaModuleSource);assert.deepEqual(luaModuleContract,{type:"script",maxSamples:262144,maxSeconds:0,channels:1,mode:"lua-script"});const luaModuleMethods=browserAssetSamplerMethods(luaModuleContract);assert.match(luaModuleMethods,/rackWebScriptSource/);assert.ok(luaModuleMethods.includes('scriptPath = byteCount > 0 ? "browser://script.lua"'));
  assert.equal(browserAssetSamplerContract("Wavetable wavetable; void reset() { wavetable.reset(); } float getWave() { return wavetable.at(0, 0); } size_t length() { return wavetable.waveLen; }")?.mode,"fundamental-wavetable");
  const phasorWavetableContract=browserAssetSamplerContract("PhasorWavetableData wavetable; void reset() { wavetable.reset(); } float getWave() { return wavetable.interpolatedAt(0, 0, 0) + wavetable.at(0, 0); } size_t length() { return wavetable.waveLen; }");assert.equal(phasorWavetableContract?.structure,"PhasorWavetableData");assert.match(browserFundamentalWavetablePrelude(phasorWavetableContract.structure),/struct PhasorWavetableData/);
  const phasorBrowser=adaptHetrickPhasorWavetableBrowserSource('#include "rack_web_export.hpp"\nstatic const char WAVETABLE_LOAD_FILTERS[] = "WAV:wav";\nstatic std::string wavetableDir;\nstatic PhasorWavetableData defaultPhasorWavetable;\nstruct PhasorWavetableData {};\nstruct PhasorWavetable { float phase(float value) { return scaleAndWrapPhasor(value); } void onSampleRateChange() { gam::sampleRate(APP->engine->getSampleRate()); } };');assert.doesNotMatch(phasorBrowser,/WAVETABLE_LOAD_FILTERS|wavetableDir|defaultPhasorWavetable|gam::sampleRate/);assert.match(phasorBrowser,/phase - std::floor\(phase\)/);
  const wavetableBody="Wavetable wavetable; void onAdd(const AddEvent& e) override { wavetable.load(system::join(getPatchStorageDirectory(), \"wavetable.wav\")); } void onSave(const SaveEvent& e) override { wavetable.save(system::join(createPatchStorageDirectory(), \"wavetable.wav\")); }";const adaptedWavetableBody=adaptFundamentalWavetableBrowserBody(wavetableBody);assert.doesNotMatch(adaptedWavetableBody,/system::|wavetable\.(?:load|save)/);assert.match(adaptedWavetableBody,/Rack Web asset ABI/);
  const wavetablePrelude=browserFundamentalWavetablePrelude();assert.match(wavetablePrelude,/struct Wavetable/);assert.match(wavetablePrelude,/dsp::RealFFT/);assert.doesNotMatch(wavetablePrelude,/osdialog|system::|drwav|sleep_for/);
  const anonymousParams=enumInfoByTerminal("enum { kParamCalibrateInput = 0, kParamCalibrateOutput, kNumParams }; enum { kLightInput = 0, kLightOutput, kNumLights };","kNumParams");assert.deepEqual(anonymousParams?.identifiers,["kParamCalibrateInput","kParamCalibrateOutput","kNumParams"]);
  const nestedMacroLights=enumInfoByTerminal("static constexpr int NUM_TAPS=4; static constexpr int MAX_POLY=4; enum LightIds { WET_LIGHT, ENUMS(GATE_LIGHTS, (NUM_TAPS + 1) * MAX_POLY), NUM_LIGHTS };","NUM_LIGHTS");assert.deepEqual(nestedMacroLights?.identifiers,["WET_LIGHT",{base:"GATE_LIGHTS",count:"(NUM_TAPS + 1) * MAX_POLY"},"NUM_LIGHTS"]);
  assert.equal(numericConstants("struct StereoSample { enum : unsigned { LEFT, RIGHT, CHANNELS }; };").CHANNELS,2);assert.equal(numericConstants("struct StereoSample { enum { CHANNELS = 2 }; }; struct OtherSample { enum { CHANNELS = 4 }; };").CHANNELS,undefined);assert.equal(numericConstants("enum { osc_count = 5 }; struct APU { static constexpr std::size_t NUM_CHANNELS = Nes_Apu::osc_count; };").NUM_CHANNELS,5);assert.equal(numericConstants("#define NUM_ROWS (9)\nenum InputIds { NUM_INPUTS = NUM_ROWS };").NUM_INPUTS,9);
  assert.deepEqual(jsonStateKeys('json_object_set_new(root, "live", json_boolean(live)); // json_object_set_new(root, "removed", json_integer(removed));\n/* json_object_set_new(root, "alsoRemoved", json_real(alsoRemoved)); */'),[{key:"live",type:"boolean"}]);
  assert.deepEqual(referencedHostModels("extern Model* the_pChainMixerChannelModel;\nvoid inspect(Model* candidate) { if (candidate == the_pChainMixerChannelModel) return; }"),["the_pChainMixerChannelModel"]);
  const unbracedLoops=rackWidgetPlacements("for ( int i=0; i<6; ++i ) addInput(createInput<PJ301MPort>(Vec(17, 45+33*i), module, i));\nfor ( int i=0; i<2; ++i ) addOutput(createOutput<PJ301MPort>(Vec(17, (9+i)*33), module, i));",{params:null,inputs:null,outputs:null,lights:null});assert.deepEqual([...unbracedLoops.inputs],[0,1,2,3,4,5].map(id=>[id,{x:17,y:45+33*id}]));assert.deepEqual([...unbracedLoops.outputs],[0,1].map(id=>[id,{x:17,y:(9+id)*33}]));
  const legacyPortEnums={params:null,inputs:enumInfoByTerminal("enum InputIds { SIGNAL_INPUT, NUM_INPUTS };","NUM_INPUTS"),outputs:enumInfoByTerminal("enum OutputIds { SIGNAL_OUTPUT, NUM_OUTPUTS };","NUM_OUTPUTS"),lights:null},legacyPorts=rackWidgetPlacements("addInput(createPort<PJ301MPort>(Vec(12, 34), PortWidget::INPUT, module, SIGNAL_INPUT)); addOutput(createPort<PJ301MPort>(Vec(56, 78), PortWidget::OUTPUT, module, SIGNAL_OUTPUT));",legacyPortEnums);assert.deepEqual(legacyPorts.inputs.get(0),{x:12,y:34,widget:"PJ301MPort"});assert.deepEqual(legacyPorts.outputs.get(0),{x:56,y:78,widget:"PJ301MPort"});
  const memberSizeAssignment=rackWidgetPlacements("box.size = Vec(240, 380); TextField* field = new TextField(); field->box.size.x = box.size.x - 75; addOutput(createOutput<PJ301MPort>(Vec(box.size.x - 30, 40), module, 0));",{params:null,inputs:null,outputs:null,lights:null});assert.deepEqual(memberSizeAssignment.outputs.get(0),{x:210,y:40});
  const bottomPanelPorts=rackWidgetPlacements("float bottomRow = box.size.y - 25; addInput(createInputCentered<PJ301MPort>(Vec(25, bottomRow), module, SIGNAL_INPUT)); addOutput(createOutputCentered<PJ301MPort>(Vec(box.size.x - 25, bottomRow - 30), module, SIGNAL_OUTPUT));",legacyPortEnums,{box_size_x:315});assert.deepEqual(bottomPanelPorts.inputs.get(0),{x:25,y:355,centered:true});assert.deepEqual(bottomPanelPorts.outputs.get(0),{x:290,y:325,centered:true});
  const dynamicEnums={params:enumInfoByTerminal("enum ParamIds { GAIN_PARAM, NUM_PARAMS };","NUM_PARAMS"),inputs:enumInfoByTerminal("enum InputIds { SIGNAL_INPUT, NUM_INPUTS };","NUM_INPUTS"),outputs:enumInfoByTerminal("enum OutputIds { SIGNAL_OUTPUT, NUM_OUTPUTS };","NUM_OUTPUTS"),lights:enumInfoByTerminal("enum LightIds { ACTIVE_LIGHT, NUM_LIGHTS };","NUM_LIGHTS")},dynamicPlacements=rackWidgetPlacements("float center = box.size.x / 2.f;\naddParam(createDynamicParam<GeoKnob>(VecPx(center, 100), module, GAIN_PARAM, nullptr));\naddInput(createDynamicPort<GeoPort>(VecPx(15, 300), true, module, SIGNAL_INPUT, nullptr));\naddOutput(createDynamicPort<GeoPort>(VecPx(90, 330), false, module, SIGNAL_OUTPUT, nullptr));\naddChild(createLightCentered<SmallLight<GeoWhiteLight>>(VecPx(45, 200), module, ACTIVE_LIGHT));",dynamicEnums,{box_size_x:105});assert.deepEqual(dynamicPlacements.params.get(0),{x:52.5,y:100,centered:true,widget:"GeoKnob"});assert.deepEqual(dynamicPlacements.inputs.get(0),{x:15,y:300,centered:true,widget:"GeoPort"});assert.deepEqual(dynamicPlacements.outputs.get(0),{x:90,y:330,centered:true,widget:"GeoPort"});assert.deepEqual(dynamicPlacements.lights.get(0),{x:45,y:200,centered:true,widget:"SmallLight<GeoWhiteLight>"});
  const snappedLightParam=rackWidgetPlacements("auto gain = createLightParam<LEDLightSlider<RedGreenBlueLight>>(Vec(12, 48), module, GAIN_PARAM, ACTIVE_LIGHT); gain->snap = true; addParam(gain);",dynamicEnums);assert.deepEqual(snappedLightParam.params.get(0),{x:12,y:48,widget:"LEDLightSlider<RedGreenBlueLight>",snap:true});assert.deepEqual(snappedLightParam.lights.get(0),{x:12,y:48,widget:"LEDLightSlider<RedGreenBlueLight>",paramId:0});
  const nestedMillimeterPixels=rackWidgetPlacements("addParam(createParamCentered<GeoKnob>(mm2px(VecPx(10, 20)), module, GAIN_PARAM));",dynamicEnums);assert.deepEqual(nestedMillimeterPixels.params.get(0),{x:29.528,y:59.055,centered:true,widget:"GeoKnob"});
  const namedMillimeterPixels=rackWidgetPlacements("auto GAINpos = Vec(10, 20); addParam(createParamCentered<GeoKnob>(mm2px(GAINpos), module, GAIN_PARAM));",dynamicEnums);assert.deepEqual(namedMillimeterPixels.params.get(0),{x:29.528,y:59.055,centered:true,widget:"GeoKnob"});
  const vectorArithmetic=rackWidgetPlacements("addParam(createParam<GeoKnob>(Vec(104, 39) - Vec(1, 2) + Vec(3, 4), module, GAIN_PARAM));",dynamicEnums);assert.deepEqual(vectorArithmetic.params.get(0),{x:106,y:41,widget:"GeoKnob"});
  const dynamicCenteredPlacements=rackWidgetPlacements("static const int col = 72;\nstatic const int row = 229;\naddParam(createDynamicParamCentered<GeoKnob>(VecPx(col, row), module, GAIN_PARAM, nullptr));\naddParam(createDynamicSwitchCentered<GeoSwitch>(VecPx(col, row + 34), module, GAIN_PARAM, nullptr, panel));\naddInput(createDynamicPortCentered<GeoPort>(VecPx(30, row), true, module, SIGNAL_INPUT, nullptr));\naddOutput(createDynamicPortCentered<GeoPort>(VecPx(90, row), false, module, SIGNAL_OUTPUT, nullptr));",dynamicEnums);assert.deepEqual(dynamicCenteredPlacements.params.get(0),{x:72,y:229,centered:true,widget:"GeoKnob"});assert.deepEqual(dynamicCenteredPlacements.inputs.get(0),{x:30,y:229,centered:true,widget:"GeoPort"});assert.deepEqual(dynamicCenteredPlacements.outputs.get(0),{x:90,y:229,centered:true,widget:"GeoPort"});
  const themedPlacements=rackWidgetPlacements("addParam(createThemedParamCentered<ThemeKnob>(Vec(10, 20), module, GAIN_PARAM, nullptr));\naddInput(createThemedPortCentered<ThemePort>(Vec(30, 40), true, module, SIGNAL_INPUT, nullptr));\naddOutput(createThemedPortCentered<ThemePort>(Vec(50, 60), false, module, SIGNAL_OUTPUT, nullptr));",dynamicEnums);assert.deepEqual(themedPlacements.params.get(0),{x:10,y:20,centered:true,widget:"ThemeKnob"});assert.deepEqual(themedPlacements.inputs.get(0),{x:30,y:40,centered:true,widget:"ThemePort"});assert.deepEqual(themedPlacements.outputs.get(0),{x:50,y:60,centered:true,widget:"ThemePort"});
  const vectorKnobEnums={params:enumInfoByTerminal("enum ParamIds { FIRST_PARAM, SECOND_PARAM, THIRD_PARAM, NUM_PARAMS };","NUM_PARAMS"),inputs:null,outputs:null,lights:null},vectorKnobPlacements=rackWidgetPlacements("std::vector<Vec> Centers = { {mm2px(10), mm2px(20)}, {mm2px(30), mm2px(40)} };\naddParam(createParamCentered<Button>(Centers[0], module, FIRST_PARAM));\naddParam(createLightKnob<KnobLight, LightKnob>(Centers[1], module, SECOND_PARAM, light));\naddParam(createLightKnobCentered<KnobLight, CenteredLightKnob>(Vec(70, 80), module, THIRD_PARAM, light));",vectorKnobEnums);assert.deepEqual(vectorKnobPlacements.params.get(0),{x:29.528,y:59.055,centered:true,widget:"Button"});assert.deepEqual(vectorKnobPlacements.params.get(1),{x:88.583,y:118.11,widget:"KnobLight, LightKnob"});assert.deepEqual(vectorKnobPlacements.params.get(2),{x:70,y:80,centered:true,widget:"KnobLight, CenteredLightKnob"});
  const supportVectorEnums={params:null,inputs:null,outputs:enumInfoByTerminal("enum OutputIds { FIRST_OUTPUT, SECOND_OUTPUT, NUM_OUTPUTS };","NUM_OUTPUTS"),lights:null},supportVectorSource="#define FIXED_OUTPUT mm2px(Vec(4, 5))\nstatic const Vec ROW_OUTPUTS[2] = { mm2px(Vec(10, 20)), mm2px(Vec(30, 40)) };",supportVectorPlacements=rackWidgetPlacements("addOutput(createOutput<Port>(FIXED_OUTPUT, module, FIRST_OUTPUT)); for (int row = 0; row < 2; row++) addOutput(createOutput<Port>(ROW_OUTPUTS[row], module, FIRST_OUTPUT + row));",supportVectorEnums,{},supportVectorSource);assert.deepEqual(supportVectorPlacements.outputs.get(0),{x:11.811,y:14.764});assert.deepEqual(supportVectorPlacements.outputs.get(1),{x:88.583,y:118.11});
  const conditionalEnums={params:null,inputs:null,outputs:null,lights:enumInfoByTerminal("enum LightIds { ENUMS(METER_LIGHT, 3), NUM_LIGHTS };","NUM_LIGHTS")},conditionalPlacements=rackWidgetPlacements("for (int i = 0; i < 3; i++) { if (i < 1) { addChild(createLightCentered<SmallLight<RedLight>>(Vec(10, 20 + i), module, METER_LIGHT + i)); } else { if (i < 2) { addChild(createLightCentered<SmallLight<YellowLight>>(Vec(10, 20 + i), module, METER_LIGHT + i)); } else { addChild(createLightCentered<SmallLight<GreenLight>>(Vec(10, 20 + i), module, METER_LIGHT + i)); } } }",conditionalEnums);assert.deepEqual([...conditionalPlacements.lights],[["METER_LIGHT",0],["METER_LIGHT_1",1],["METER_LIGHT_2",2]].map(([,id])=>[id,{x:10,y:20+id,centered:true,widget:`SmallLight<${["Red","Yellow","Green"][id]}Light>`}]));
  const conditionalRoot=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-conditional-dependency-test-"));try{const definitionsFile=path.join(conditionalRoot,"defs.h"),selectorFile=path.join(conditionalRoot,"selector.h"),activeFile=path.join(conditionalRoot,"active.h"),inactiveFile=path.join(conditionalRoot,"inactive.h"),activeImplementation=path.join(conditionalRoot,"active.cc"),inactiveImplementation=path.join(conditionalRoot,"inactive.cc");fs.writeFileSync(definitionsFile,"#define USE_INACTIVE 0\n");fs.writeFileSync(selectorFile,'#include "defs.h"\n#if USE_INACTIVE\n#include "inactive.h"\n#else\n#include "active.h"\n#endif\n');for(const file of [activeFile,inactiveFile,activeImplementation,inactiveImplementation])fs.writeFileSync(file,"");const pruned=pruneInactiveConditionalDependencies([definitionsFile,selectorFile,activeFile,inactiveFile,activeImplementation,inactiveImplementation],conditionalRoot);assert.ok(pruned.includes(activeFile));assert.ok(pruned.includes(activeImplementation));assert.ok(!pruned.includes(inactiveFile));assert.ok(!pruned.includes(inactiveImplementation))}finally{fs.rmSync(conditionalRoot,{recursive:true,force:true})}
  const strippedBody=stripUiClassMembers("std::atomic<Vec*> _jumpTo;\nModuleWidget* widget;\nComputerscareSVGPanel* panelRef;\nChordDiagram* chordDiagram;\nvoid process() { Vec* target = _jumpTo; _jumpTo = target; }");assert.match(strippedBody,/std::atomic<Vec\*> _jumpTo/);assert.doesNotMatch(strippedBody,/ModuleWidget\* widget|ComputerscareSVGPanel|ChordDiagram/);
  assert.deepEqual(declaredDependencyNames("/* struct CommentedType {}; inline int commentedHelper() { int local = 1; return local; } */\nstruct RealType {};\ninline int realHelper() { int local = 1; return local; }\n"),["RealType","realHelper"]);
  assert.deepEqual(declaredDependencyNames("typedef struct { int value; } GlobalInterface;\nvoid localFactory() { typedef struct { int value; } LocalInterface; }\n"),["GlobalInterface","localFactory"]);
  assert.deepEqual(declaredDependencyNames("namespace fixture {\nstatic std::vector<std::string> labels = {\"A\", \"B\"};\n}\n"),["labels"]);
  const duplicateHelpers=normalizeGeneratedImplementations("static int helper(int value) { return value + 1; }\nstruct Engine {};\nstatic int helper(int value) { return value + 1; }\n");assert.equal([...duplicateHelpers.matchAll(/static int helper/g)].length,1);
  const freeFunctionDuplicates=normalizeGeneratedImplementations("namespace left {\ntemplate <typename T>\nstatic T convert(T value) { return value; }\ntemplate <typename T>\nstatic T convert(T value) { return value; }\nstatic int helper(int value) { return value + 1; }\nstatic int helper(int value) { return value + 2; }\n}\nnamespace right {\nstatic int helper(int value) { return value + 1; }\n}\n");assert.equal([...freeFunctionDuplicates.matchAll(/template <typename T>/g)].length,1);assert.equal([...freeFunctionDuplicates.matchAll(/static int helper/g)].length,3);assert.match(freeFunctionDuplicates,/return value \+ 2/);assert.match(freeFunctionDuplicates,/namespace right/);
  const defaultedDefinition=normalizeGeneratedImplementations("void padTo(std::string& value, const size_t count, const char padding = ' ');\nvoid padTo(std::string& value, const size_t count, const char padding = ' ') { value.insert(0, count, padding); }\n");assert.equal([...defaultedDefinition.matchAll(/padding\s*=/g)].length,1);assert.match(defaultedDefinition,/void padTo[^{]+\{ value\.insert/);
  const scopedDefaults=normalizeGeneratedImplementations('namespace left {\nvoid configure(std::array<int, 2> value = std::array<int, 2>{1, 2}, const char* label = "left,right");\nvoid configure(std::array<int, 2> value = std::array<int, 2>{1, 2}, const char* label = "left,right") { return; }\nvoid overload(int value = 1);\nvoid overload(float value = 1) {}\n}\nnamespace right {\nvoid configure(std::array<int, 2> value = std::array<int, 2>{1, 2}, const char* label = "left,right") {}\n}\n');assert.equal([...scopedDefaults.matchAll(/value\s*=\s*std::array/g)].length,2);assert.equal([...scopedDefaults.matchAll(/label\s*=/g)].length,2);assert.match(scopedDefaults,/void configure\(std::array<int, 2> value, const char\* label\) \{ return; \}/);assert.match(scopedDefaults,/void overload\(float value = 1\) \{\}/);
  const duplicateNamespaceState="std::string lookup =\n    \"abc\";\nstd::string other = \"ok\";\nstd::string lookup =\n    \"abc\";\n";const normalizedNamespaceState=normalizeLegacyMidiOverrides(duplicateNamespaceState);assert.equal([...normalizedNamespaceState.matchAll(/std::string lookup/g)].length,1);assert.match(normalizedNamespaceState,/std::string other/);
  const midiExpander=normalizeLegacyMidiOverrides("namespace smf { struct MidiMessage : std::vector<unsigned char> {}; }\nstruct ExpanderToMasterMessage { std::vector<smf::MidiMessage> msgs[NUM_TRACKS]; };\n");assert.match(midiExpander,/struct RackWebMidiExpanderMessageList/);assert.match(midiExpander,/RackWebMidiExpanderMessageList msgs\[NUM_TRACKS\]/);assert.doesNotMatch(midiExpander,/std::vector<smf::MidiMessage> msgs/);
  const blankContract=browserAssetSamplerContract("int imageFitEnum; bool hidePanel; float zoomX; enum { SLIDESHOW_ACTIVE, CROSSFADE_TIME };");assert.deepEqual(blankContract,{type:"image",maxSamples:4194304,maxSeconds:0,channels:4,mode:"rgba-image"});const blankAdapter=browserComputerscareBlankAdapterSource({key:"computerscare/computerscare-blank"},{sourceUrl:"https://example.com/computerscare"},"BSD-3-Clause","src/ComputerscareBlank.cpp","src/ComputerscareBlank.cpp");assert.match(blankAdapter,/rackWebAssetSampleCapacity = 4194304/);assert.match(blankAdapter,/configParam\(ANIMATION_SPEED, -1\.f, 1\.f, 0\.f/);assert.match(blankAdapter,/json_object_set_new\(root, "hidePanel"/);assert.doesNotMatch(blankAdapter,/APP->|osdialog|system::/);
});

test("local pre-module support types consume Rust ranges and namespace facts",()=>{
  const source=`namespace fixture {
struct Support final { float apply(float value) { return value * 2.f; } };
void localFactory() { struct LocalSupport { float value = 9.f; }; }
struct NativeView : Widget {};
struct Target : Module { Support support; };
struct AfterTarget { float value = 4.f; };
}`,
    selected=localPlainStructDefinitions(source,"fixture::Target","Support support; LocalSupport local; NativeView* view; AfterTarget after;");
  assert.match(selected,/namespace fixture \{[\s\S]*struct Support final/);
  assert.doesNotMatch(selected,/LocalSupport|NativeView|AfterTarget|struct Target/);
});

test("parameter quantity helper discovery uses Rust namespace-scope type facts",()=>{
  const source=`const char* decoy = "struct StringQuantity : ParamQuantity {};";
namespace fixture {
struct QualifiedQuantity final : public rack::engine::ParamQuantity { float getDisplayValue() override { return getValue(); } };
class ClassQuantity : ParamQuantity {};
struct MultiQuantity : ParamQuantity, Helper {};
struct Owner { struct NestedQuantity : ParamQuantity {}; };
void build() { struct LocalQuantity : ParamQuantity {}; }
}`;
  const helpers=paramQuantityHelpers(source,"QualifiedQuantity ClassQuantity MultiQuantity NestedQuantity LocalQuantity StringQuantity");
  assert.deepEqual(helpers.map(helper=>helper.name),["QualifiedQuantity"]);
  assert.match(helpers[0].source,/^struct QualifiedQuantity final : public rack::engine::ParamQuantity/);
  assert.match(helpers[0].source,/};$/);
});
test("free-function deferral consumes Rust ranges and namespaces",()=>{
  const source=`const char* decoy = "static DeferredType fake(DeferredType value) { return value; }";
struct Owner {
  static DeferredType member(DeferredType value) { return value; }
};
namespace outer::inner {
template <typename T>
static DeferredType deferTemplate(DeferredType value, T extra) { return value; }
static int keep(int value) { return value + 1; }
}
namespace other {
static DeferredType deferOther(DeferredType value) { return value; }
}`;
  const deferred=deferFreeFunctionsReferencingTypes(source,["DeferredType"]);
  assert.match(deferred.source,/const char\* decoy/);
  assert.match(deferred.source,/DeferredType member/);
  assert.match(deferred.source,/static int keep/);
  assert.doesNotMatch(deferred.source,/\bdeferTemplate\s*\(|\bdeferOther\s*\(/);
  assert.equal(deferred.definitions.length,2);
  assert.match(deferred.definitions[0],/^namespace outer \{\nnamespace inner \{\ntemplate <typename T>/);
  assert.match(deferred.definitions[0],/deferTemplate\(DeferredType value, T extra\)/);
  assert.match(deferred.definitions[1],/^namespace other \{/);
});
test("out-of-line removal consumes Rust owner-chain ranges",()=>{
  const source=`const char* decoy = "float Engine::fake(float value) { return value; }";
namespace fixture {
template <typename T>
float Engine<T>::render(float value) { return value * 2.f; }
float Engine<int>::Nested::read(float value) { return value + 1.f; }
Engine<int>::Engine() {}
Engine<int>::~Engine() {}
Engine<int>::Engine() = default;
const int Engine<int>::table = 1;
float Other::render(float value) { return value * 3.f; }
}`;
  const stripped=removeOutOfLineDefinitions(source,"Engine<int>");
  assert.match(stripped,/const char\* decoy/);
  assert.doesNotMatch(stripped,/Engine<T>::render|Engine<int>::Nested::read|Engine<int>::~?Engine\(\) \{/);
  assert.match(stripped,/Engine<int>::Engine\(\) = default/);
  assert.match(stripped,/Engine<int>::table = 1/);
  assert.match(stripped,/float Other::render/);
});
test("generated adapters deduplicate Rust member and free-function facts",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-member-dedupe-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"MemberDedupe",name:"Member dedupe",description:"Rust out-of-line signature fixture",tags:["Utility"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);
  fs.writeFileSync(path.join(plugin,"src","MemberDedupe.cpp"),'#include "plugin.hpp"\nstruct DuplicateEngine { float apply(float value) const; };\nfloat DuplicateEngine::apply(float value) const { return value * 2.f; }\nfloat DuplicateEngine::apply(float value) const /* duplicate */ { return value * 4.f; }\nstatic float duplicateOffset(float value = 1.f);\nstatic float duplicateOffset(float value = 1.f) { return value + 1.f; }\nstatic float duplicateOffset(float value = 1.f) { return value + 1.f; }\nstruct MemberDedupeModule : Module { enum InputIds { SIGNAL_INPUT, NUM_INPUTS }; enum OutputIds { SIGNAL_OUTPUT, NUM_OUTPUTS }; DuplicateEngine engine; MemberDedupeModule() { config(0, NUM_INPUTS, NUM_OUTPUTS, 0); configInput(SIGNAL_INPUT, "Signal"); configOutput(SIGNAL_OUTPUT, "Signal"); } void process(const ProcessArgs&) override { outputs[SIGNAL_OUTPUT].setVoltage(duplicateOffset(engine.apply(inputs[SIGNAL_INPUT].getVoltage()))); } };\nstruct MemberDedupeWidget : ModuleWidget {};\nModel* modelMemberDedupe = createModel<MemberDedupeModule, MemberDedupeWidget>("MemberDedupe");\n');
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/MemberDedupe","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"});const adapter=fs.readFileSync(path.join(output,"adapter.cpp"),"utf8");assert.equal([...adapter.matchAll(/DuplicateEngine::apply\s*\(/g)].length,1);assert.equal([...adapter.matchAll(/static float duplicateOffset\s*\([^)]*\)\s*\{/g)].length,1);assert.equal([...adapter.matchAll(/duplicateOffset\s*\(float value\s*=\s*1\.f/g)].length,1);assert.doesNotMatch(adapter,/return value \* 4\.f/);const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();wasm.rack_web_set_input_connected(0,1);wasm.rack_web_set_input_channels(0,1);wasm.rack_web_set_output_connected(0,1);new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),128)[0]=3;wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],7)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});
test("qualified native UI helper functions can be removed without touching DSP helpers",()=>{
  const source=`const char* decoy = "math::Rect nativeSceneRect() { fake }";
namespace ui_helpers {
static inline math::Rect
nativeSceneRect(
) { return APP->scene->box; }
}
struct NativeOwner { static math::Rect nativeSceneRect() { return {}; } };
static inline float dspScale(float value) { return value * 2.f; }
`;
  const stripped=removeQualifiedFreeFunction(source,"nativeSceneRect");
  assert.doesNotMatch(stripped,/APP->scene/);
  assert.match(stripped,/const char\* decoy/);
  assert.match(stripped,/NativeOwner \{ static math::Rect nativeSceneRect/);
  assert.match(stripped,/dspScale/);
});
test("plugin init cleanup consumes Rust namespace-scope function ranges",()=>{
  const source=`const char* decoy = "void init(Plugin* plugin) { fake }";
namespace fixture {
void init(
  rack::Plugin* plugin
) { if (plugin) plugin->addModel(modelFixture); }
}
struct Owner { void init(Plugin* plugin) { member = plugin; } Plugin* member = nullptr; };
void init(Plugin& plugin) { (void)plugin; }
Model* modelFixture = createModel<FixtureModule, FixtureWidget>("Fixture");
`;
  const stripped=stripPluginInitFunctions(source);
  assert.doesNotMatch(stripped,/plugin->addModel|createModel/);
  assert.match(stripped,/const char\* decoy/);
  assert.match(stripped,/Owner \{ void init\(Plugin\* plugin\)/);
  assert.match(stripped,/void init\(Plugin& plugin\)/);
});
test("Vec DSP helper extraction consumes Rust namespace-scope signatures and ranges",()=>{
  const source=`const char* decoy = "float scalePoint(Vec point) { fake }";
namespace fixture {
static float scalePoint(
  const Vec& point,
  float scale = 1.f
) { return point.x * scale; }
static float scalePoint(float value) { return value * 100.f; }
static Vec makePoint(float value) { return Vec(value, 0.f); }
static float unusedPoint(Vec point) { return point.y; }
}
struct Owner { static float scalePoint(Vec point) { return point.y; } };
`;
  const helpers=referencedVecDspHelpers(source,"return scalePoint(point, 2.f);");
  assert.match(helpers,/static float scalePoint\(\s*const Vec& point/);
  assert.doesNotMatch(helpers,/value \* 100|makePoint|unusedPoint|struct Owner|const char\* decoy|namespace fixture/);
});
test("ordinary free-function removal consumes Rust names, signatures, and ranges",()=>{
  const source=`const char* decoy = "bool downloadTodaysFortune() { fake }";
namespace fixture {
static math::Rect downloadTodaysFortune() { return {}; }
static bool downloadTodaysFortune(
) { return false; }
static bool downloadTodaysFortune(int retry) { return retry > 0; }
}
struct Owner { static bool downloadTodaysFortune() { return true; } };
`;
  const stripped=removeFreeFunction(source,"downloadTodaysFortune");
  assert.match(stripped,/const char\* decoy|math::Rect downloadTodaysFortune|downloadTodaysFortune\(int retry\)|Owner \{ static bool downloadTodaysFortune/);
  assert.doesNotMatch(stripped,/static bool downloadTodaysFortune\(\s*\) \{ return false/);
});
test("Rack UI residue cleanup consumes Rust function and owner facts",()=>{
  const source=`const char* decoy = "math::Vec nativePoint(float value) { fake }";
struct NativeDisplay { float paint(float value); };
float NativeDisplay::paint(float value) { return value + 100.f; }
struct DspEngine { float process(float value); };
float DspEngine::process(float value) { return value * 2.f; }
static math::Vec nativePoint(float value);
static math::Vec nativePoint(float value) { return math::Vec(value, 0.f); }
static float dspScale(float value) { return value * 3.f; }
`;
  const stripped=stripRackUiResidue(source,new Set(["NativeDisplay"]));
  assert.doesNotMatch(stripped,/^struct NativeDisplay|^float NativeDisplay::paint|^static math::Vec nativePoint/gm);
  assert.match(stripped,/const char\* decoy/);
  assert.match(stripped,/struct DspEngine|DspEngine::process|static float dspScale/);
});
test("conditional SIMD template normalization consumes Rust out-of-line facts",()=>{
  const source=`const char* decoy = "template<> float Bank<float>::next(float) { fake }";
namespace fixture {
template<typename T> struct Bank {
#ifdef RACK_SIMD
  T lane{};
#endif
  float next(float value);
};
template<typename T> float Bank<T>::next(float value) { return value + 100.f; }
template<> float Bank<float>::next(float value) { return value * 2.f; }
template<typename T> struct Other { float next(float value); };
template<typename T> float Other<T>::next(float value) { return value + 1.f; }
template<> float Other<float>::next(float value) { return value + 2.f; }
}
`;
  const normalized=normalizeConditionalTemplateImplementations(source);
  assert.match(normalized,/const char\* decoy/);
  assert.match(normalized,/template<>\s*float Bank<float>::next/);
  assert.doesNotMatch(normalized,/template<typename T>\s*float Bank<T>::next/);
  assert.match(normalized,/template<typename T>\s*float Other<T>::next/);
  assert.match(normalized,/template<>\s*float Other<float>::next/);
});
test("out-of-line method replacement consumes Rust owner, member, and range facts",()=>{
  const source=`const char* decoy = "Engine::render(float) { fake }";
struct Outer { struct Engine { float render(float value); }; };
float Outer::Engine::render(float value) { return value + 100.f; }
float Outer::Engine::render(int value) { return float(value) + 200.f; }
Outer::Engine::Engine() {}
Outer::Engine::~Engine() {}
`;
  const rendered=replaceOutOfLineMethod(source,"Engine","render","float Outer::Engine::render(float value) { return value * 2.f; }");
  const constructed=replaceOutOfLineMethod(rendered,"Engine","Engine","Outer::Engine::Engine() { ready = true; }");
  const replaced=replaceOutOfLineMethod(constructed,"Engine","~Engine","Outer::Engine::~Engine() { ready = false; }");
  assert.match(replaced,/const char\* decoy/);
  assert.match(replaced,/return value \* 2\.f/);
  assert.match(replaced,/render\(int value\) \{ return float\(value\) \+ 200\.f/);
  assert.match(replaced,/Engine\(\) \{ ready = true; \}|~Engine\(\) \{ ready = false; \}/);
  assert.doesNotMatch(replaced,/return value \+ 100\.f/);
});
test("embedded resource documentation replacement consumes Rust body ranges",()=>{
  const source=`CMRC_DECLARE(fixture_docs);
const char* decoy = "std::string Docs::fake() { cmrc::fixture_docs::get_filesystem(); }";
struct Docs { static std::string resource(int value); static std::string literalOnly(); static float number(); };
std::string Docs::resource(int value) {
  // cmrc::comment_only::get_filesystem();
  auto fs = cmrc::fixture_docs::get_filesystem();
  return fs.is_file("fixture") ? std::to_string(value) : "";
}
std::string Docs::literalOnly() { return "cmrc::fixture_docs::get_filesystem()"; }
float Docs::number() { auto fs = cmrc::fixture_docs::get_filesystem(); return fs.is_file("fixture") ? 1.f : 0.f; }
`;
  const stripped=stripEmbeddedResourceDocumentation(source);
  assert.doesNotMatch(stripped,/^CMRC_DECLARE/gm);
  assert.match(stripped,/const char\* decoy/);
  assert.match(stripped,/std::string Docs::resource\(int value\) \{ return ""; \}/);
  assert.match(stripped,/std::string Docs::literalOnly\(\) \{ return "cmrc::fixture_docs::get_filesystem\(\)"; \}/);
  assert.match(stripped,/float Docs::number\(\) \{ auto fs = cmrc::fixture_docs::get_filesystem\(\)/);
  assert.doesNotMatch(stripped,/std::to_string/);
});
test("Surge VCO and FX specialization extraction consumes Rust out-of-line facts",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-surge-specialization-test-")),sourceFile=path.join(temporary,"Specializations.hpp");
  try{
    fs.writeFileSync(sourceFile,`const char* decoy = "template<> void VCOConfig<ot_test>::fake() { fake }";
template<> int VCOConfig<ot_test>::voiceCount() { return 4; }
template<> rack::Widget* VCOConfig<ot_test>::getLayout() { return nullptr; }
template<> void VCOConfig<ot_test>::addMenuItems() {}
template<int oscType> inline void VCOConfig<oscType>::configureVCOSpecificParameters(VCO<oscType>* module) { module->configure(); }
template<> constexpr int FXConfig<fxt_test>::numParams() { return 3; }
template<> void FXConfig<fxt_test>::configSpecificParams(FX<fxt_test>* module) { module->configure(); }
template<> rack::Widget* FXConfig<fxt_test>::getLayout() { return nullptr; }
template<> void FXConfig<fxt_test>::addFXSpecificMenuItems() {}
`);
    const vco=surgeVcoSpecializations([sourceFile],"VCO<ot_test>"),fallback=surgeVcoSpecializations([sourceFile],"VCO<ot_other>"),fx=surgeFxConfigSpecializations([sourceFile],"FX<fxt_test>");
    assert.match(vco,/VCOConfig<ot_test>::voiceCount/);
    assert.match(vco,/VCOConfig<oscType>::configureVCOSpecificParameters/);
    assert.doesNotMatch(vco,/getLayout|addMenuItems|fake/);
    assert.match(fallback,/VCOConfig<oscType>::configureVCOSpecificParameters/);
    assert.doesNotMatch(fallback,/VCOConfig<ot_test>::voiceCount/);
    assert.match(fx,/FXConfig<fxt_test>::numParams/);
    assert.match(fx,/FXConfig<fxt_test>::configSpecificParams/);
    assert.doesNotMatch(fx,/getLayout|addFXSpecificMenuItems|decoy/);
  }finally{fs.rmSync(temporary,{recursive:true,force:true})}
});
test("Surge Rack custom-editor removal consumes Rust owner and range facts",()=>{
  const source=`const char* decoy = "template<> rack::Widget* VCOConfig<ot_fake>::createCustomEditorAt(int) { fake }";
template<> rack::Widget* VCOConfig<ot_test>::createCustomEditorAt(int index) { return APP->scene->rack; }
template<int oscType> rack::Widget* VCOConfig<oscType>::createCustomEditorAt(int) { return nullptr; }
template<> rack::Widget* OtherConfig<ot_test>::createCustomEditorAt(int) { return nullptr; }
`;
  const stripped=stripSurgeRackCustomEditor(source);
  assert.match(stripped,/const char\* decoy/);
  assert.doesNotMatch(stripped,/VCOConfig<ot_test>::createCustomEditorAt\(int index\)/);
  assert.match(stripped,/VCOConfig<oscType>::createCustomEditorAt/);
  assert.match(stripped,/OtherConfig<ot_test>::createCustomEditorAt/);
});
test("inline void stubbing consumes Rust member body ranges",()=>{
  const source=`const char* decoy = "void guaranteeRackUserWavetablesDir() { fake }";
struct First {
  void guaranteeRackUserWavetablesDir() override { if (ready) { desktopOnly(); } }
};
struct Second {
  void guaranteeRackUserWavetablesDir() { keepSecond(); }
};
void guaranteeRackUserWavetablesDir() { keepFreeFunction(); }
`;
  const stubbed=stubInlineVoidMethod(source,"guaranteeRackUserWavetablesDir");
  assert.match(stubbed,/const char\* decoy/);
  assert.match(stubbed,/void guaranteeRackUserWavetablesDir\(\) override \{\}/);
  assert.match(stubbed,/void guaranteeRackUserWavetablesDir\(\) \{ keepSecond\(\); \}/);
  assert.match(stubbed,/void guaranteeRackUserWavetablesDir\(\) \{ keepFreeFunction\(\); \}/);
  assert.doesNotMatch(stubbed,/desktopOnly/);
});
test("inline body transforms consume Rust ranges for functions and special callables",()=>{
  let source=`const char* decoy = "Fragment() { fake }";
struct Fragment {
  Fragment() { oldConstruct(); }
  ~Fragment() { oldDestroy(); }
  void dataFromJson(json_t* rootJ) override { restore(rootJ); }
  void process(const ProcessArgs& args) override { run(args); }
};
`;
  source=replaceInlineMethodBody(source,/\bFragment\s*\(\s*\)\s*\{/," constructBrowser(); ");
  source=replaceInlineMethodBody(source,/~Fragment\s*\(\s*\)/," destroyBrowser(); ");
  source=appendInlineMethodStatement(source,/\bvoid\s+dataFromJson\s*\([^)]*\)\s*override\s*\{/,"rebuild();");
  source=prependInlineMethodBody(source,/\bvoid\s+process\s*\([^)]*\)\s*override\s*\{/," preflight(); ");
  assert.match(source,/const char\* decoy/);
  assert.match(source,/Fragment\(\) \{ constructBrowser\(\); \}/);
  assert.match(source,/~Fragment\(\) \{ destroyBrowser\(\); \}/);
  assert.match(source,/restore\(rootJ\);[^}]*rebuild\(\);/);
  assert.match(source,/process[^}]*preflight\(\);[^}]*run\(args\);/);
  assert.doesNotMatch(source,/oldConstruct|oldDestroy/);
});
test("top-level type and enum dedupe consumes Rust declaration ranges",()=>{
  const source=`const char* decoy = "template<typename T> struct Engine { fake }; enum Mode { A };";
namespace left {
template<typename T> struct Engine { T value{}; };
template<typename T> struct Engine { T value{}; };
enum Mode { A };
enum Mode { A };
enum Mode { B };
struct Holder { struct Nested {}; struct Nested {}; };
}
namespace right {
template<typename T> struct Engine { T value{}; };
enum Mode { A };
}
`;
  const deduped=dedupeRepeatedTopLevelEnums(dedupeRepeatedTopLevelTypes(source));
  assert.match(deduped,/const char\* decoy/);
  assert.equal([...deduped.matchAll(/template<typename T> struct Engine/g)].length,3);
  assert.equal([...deduped.matchAll(/enum Mode \{ A \}/g)].length,3);
  assert.match(deduped,/enum Mode \{ B \}/);
  assert.equal([...deduped.matchAll(/struct Nested/g)].length,2);
});
test("referenced Vec DSP helpers from Rust facts survive UI stripping in real WASM",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-vec-helper-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"VecHelper",name:"Vec helper",description:"Rust Vec helper fixture",tags:["Utility"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);
  fs.writeFileSync(path.join(plugin,"src","VecHelper.cpp"),'#include "plugin.hpp"\nstatic float fixtureVecScale(Vec point, float scale = 1.f) { return point.x * scale; }\nstruct VecHelperModule : Module { enum InputIds { SIGNAL_INPUT, NUM_INPUTS }; enum OutputIds { SIGNAL_OUTPUT, NUM_OUTPUTS }; VecHelperModule() { config(0, NUM_INPUTS, NUM_OUTPUTS, 0); configInput(SIGNAL_INPUT, "Signal"); configOutput(SIGNAL_OUTPUT, "Signal"); } void process(const ProcessArgs&) override { outputs[SIGNAL_OUTPUT].setVoltage(fixtureVecScale(Vec(inputs[SIGNAL_INPUT].getVoltage(), 0.f), 2.f)); } };\nstruct VecHelperWidget : ModuleWidget {};\nModel* modelVecHelper = createModel<VecHelperModule, VecHelperWidget>("VecHelper");\n');
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/VecHelper","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"});const adapter=fs.readFileSync(path.join(output,"adapter.cpp"),"utf8"),wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;assert.equal([...adapter.matchAll(/fixtureVecScale\s*\([^)]*Vec[^)]*\)\s*\{/g)].length,1);wasm._initialize();wasm.rack_web_set_input_connected(0,1);wasm.rack_web_set_input_channels(0,1);wasm.rack_web_set_output_connected(0,1);new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),128)[0]=3;wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],6)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("Library scaffold generation discovers the registered Rack module contract",()=>{
  const output=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-scaffold-test-"));
  const stdout=execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/Simple","--manifest-file",path.join(source,"plugin.json"),"--source-dir",source,"--output",output,"--use-rust-analysis"],{encoding:"utf8",env:{...process.env,RACK_WEB_REQUIRE_RUST_CONFIG_CALLS:"1",RACK_WEB_REQUIRE_RUST_CONFIG_EXPANSION:"1",RACK_WEB_REQUIRE_RUST_CONSTANT_ANALYSIS:"1",RACK_WEB_REQUIRE_RUST_PREPROCESS:"1",RACK_WEB_REQUIRE_RUST_STRING_EVAL:"1",RACK_WEB_REQUIRE_RUST_NUMBER_EVAL:"1"}});
  const report=JSON.parse(stdout),saved=JSON.parse(fs.readFileSync(path.join(output,"adapter.json"),"utf8"));
  assert.equal(report.key,"FixturePlugin/Simple");assert.equal(saved.source.file,"src/Simple.hpp");assert.equal(saved.source.registrationFile,"src/Simple.cpp");assert.equal(saved.source.moduleClass,"FixtureModule");assert.deepEqual(saved.detected.enums.inputs.identifiers,["SIGNAL_INPUT","NUM_INPUTS"]);assert.deepEqual(saved.detected.enums.outputs.identifiers,["SIGNAL_OUTPUT","NUM_OUTPUTS"]);assert.deepEqual(saved.detected.config.bypass,["SIGNAL_INPUT, SIGNAL_OUTPUT"]);assert.equal(saved.assessment.strategy,"direct-rack-source-adapter");assert.equal(saved.assessment.compileEligible,true);const adapter=fs.readFileSync(path.join(output,"adapter.cpp"),"utf8");assert.match(adapter,/RACK_WEB_EXPORTS\(FixtureModule\)/);assert.doesNotMatch(adapter,/static constexpr int NUM_OUTPUTS/);const runtime=JSON.parse(fs.readFileSync(path.join(output,"runtime.json"),"utf8"));assert.deepEqual(runtime.params,[{id:0,name:"Level",min:0,max:1,default:1,position:{x:29.528,y:59.055,centered:true,widget:"RoundBlackKnob"}}]);assert.deepEqual(runtime.inputs[0].position,{x:12,y:300});assert.deepEqual(runtime.outputs[0].position,{x:150,y:330,centered:true});assert.deepEqual(runtime.bypassRoutes,[[0,0]]);
  fs.rmSync(output,{recursive:true,force:true});
});

test("Rust registration analysis resolves code aliases without comment or string false positives",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-registration-alias-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});
  const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"AliasRegistration",name:"Alias registration",description:"Rust alias analysis fixture",tags:["Utility"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);
  fs.writeFileSync(path.join(plugin,"src","AliasRegistration.cpp"),'#include "plugin.hpp"\nstruct ActualAliasModule : Module { enum OutputIds { SIGNAL_OUTPUT, NUM_OUTPUTS }; ActualAliasModule() { config(0, 0, NUM_OUTPUTS, 0); configOutput(SIGNAL_OUTPUT, "Signal"); } void process(const ProcessArgs&) override { outputs[SIGNAL_OUTPUT].setVoltage(7.f); } };\n// typedef WrongCommentModule AliasRegistrationModule;\nconst char* aliasText = "using AliasRegistrationModule = WrongStringModule;";\nnamespace hidden { using AliasRegistrationModule = WrongNamespaceModule; }\nusing AliasRegistrationModule = ActualAliasModule;\nstruct AliasRegistrationWidget : ModuleWidget {};\nModel* modelAliasRegistration = createModel<AliasRegistrationModule, AliasRegistrationWidget>("AliasRegistration");\n');
  try{const report=JSON.parse(execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/AliasRegistration","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile","--use-rust-analysis"],{encoding:"utf8"})),wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;assert.equal(report.source.moduleClass,"ActualAliasModule");wasm._initialize();assert.equal(wasm.rack_web_output_count(),1);wasm.rack_web_set_output_connected(0,1);wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],7)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("Rust resolves a single-widget registration across its include context in real WASM",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-single-widget-registration-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});
  const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"SingleWidget",name:"Single widget",description:"Rust widget inheritance registration fixture",tags:["Utility"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);
  fs.writeFileSync(path.join(plugin,"src","SingleWidget.hpp"),'#pragma once\nnamespace fixture::voice {\nstruct VoiceModule : Module { enum InputIds { SIGNAL_INPUT, NUM_INPUTS }; enum OutputIds { SIGNAL_OUTPUT, NUM_OUTPUTS }; VoiceModule() { config(0, NUM_INPUTS, NUM_OUTPUTS, 0); configInput(SIGNAL_INPUT, "Signal"); configOutput(SIGNAL_OUTPUT, "Signal"); } void process(const ProcessArgs&) override { outputs[SIGNAL_OUTPUT].setVoltage(inputs[SIGNAL_INPUT].getVoltage() * 3.f); } };\ntemplate<class TModule> struct VoiceWidgetBase : ModuleWidget {};\nstruct VoiceWidget : VoiceWidgetBase<VoiceModule> {};\n}\n');
  fs.writeFileSync(path.join(plugin,"src","SingleWidget.cpp"),'# include "SingleWidget.hpp"\nnamespace fixture {\nModel* modelSingleWidget = createModel<voice::VoiceWidget>("SingleWidget");\n}\n');
  try{const report=JSON.parse(execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/SingleWidget","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"})),wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;assert.equal(report.source.moduleClass,"fixture::voice::VoiceModule");assert.equal(report.source.widgetClass,"voice::VoiceWidget");wasm._initialize();wasm.rack_web_set_input_connected(0,1);wasm.rack_web_set_input_channels(0,1);wasm.rack_web_set_output_connected(0,1);new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),128)[0]=2;wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],6)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("Rust macro facts expand function-like model registrations in real WASM",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-macro-registration-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});
  const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"MacroRegistration",name:"Macro registration",description:"Rust function-like macro registration fixture",tags:["Utility"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);
  fs.writeFileSync(path.join(plugin,"src","MacroRegistration.cpp"),'#include "plugin.hpp"\nstruct MacroRegistrationModule : Module { enum OutputIds { SIGNAL_OUTPUT, NUM_OUTPUTS }; MacroRegistrationModule() { config(0, 0, NUM_OUTPUTS, 0); configOutput(SIGNAL_OUTPUT, "Signal"); } void process(const ProcessArgs&) override { outputs[SIGNAL_OUTPUT].setVoltage(11.f); } };\nstruct MacroRegistrationWidget : ModuleWidget {};\n# define REGISTER_MODEL(MODULE, WIDGET, SLUG) \\\n  Model* modelMacroRegistration = createModel<MODULE, WIDGET>(#SLUG);\nREGISTER_MODEL(MacroRegistrationModule, MacroRegistrationWidget, MacroRegistration);\n');
  try{const report=JSON.parse(execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/MacroRegistration","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"})),wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;assert.equal(report.source.moduleClass,"MacroRegistrationModule");assert.equal(report.source.widgetClass,"MacroRegistrationWidget");wasm._initialize();wasm.rack_web_set_output_connected(0,1);wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],11)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("dependency implementation globals and plugin host helpers keep their native lookup order",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-implementation-global-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});
  const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"HostGlobal",name:"Host global",description:"Dependency globals and plugin host helper fixture",tags:["Utility"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);
  fs.writeFileSync(path.join(plugin,"src","HostKernel.hpp"),'#pragma once\nfloat hostScale(float value);\nint loadDarkAsDefault();\nstruct HostKernel { float render(float value) { return hostScale(value); } };\n');
  fs.writeFileSync(path.join(plugin,"src","HostKernel.cpp"),'#include "HostKernel.hpp"\nconst float hostReferenceFrequency = 3.f;\nnamespace fixture_support {\nnamespace detail {\nfloat hostScaleBias(float value) { return value; }\n}\nusing namespace detail;\nfloat hostBias(float /* compatibility */ value) { return hostScaleBias(value); }\n}\nfloat hostScale(float value) { return value * hostReferenceFrequency + fixture_support::hostBias(1.f); }\nint loadDarkAsDefault() { return 2; }\n');
  fs.writeFileSync(path.join(plugin,"src","HostGlobal.cpp"),'#include "plugin.hpp"\n#include "HostKernel.hpp"\nstruct HostGlobal : Module { enum InputIds { SIGNAL_INPUT, NUM_INPUTS }; enum OutputIds { SIGNAL_OUTPUT, NUM_OUTPUTS }; HostKernel kernel; int panelTheme = 0; HostGlobal() { config(0, NUM_INPUTS, NUM_OUTPUTS, 0); configInput(SIGNAL_INPUT, "Signal"); configOutput(SIGNAL_OUTPUT, "Signal"); panelTheme = loadDarkAsDefault(); } void process(const ProcessArgs&) override { outputs[SIGNAL_OUTPUT].setVoltage(kernel.render(inputs[SIGNAL_INPUT].getVoltage()) + panelTheme); } }; struct HostGlobalWidget : ModuleWidget {}; Model* modelHostGlobal = createModel<HostGlobal, HostGlobalWidget>("HostGlobal");\n');
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/HostGlobal","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"});const adapter=fs.readFileSync(path.join(output,"adapter.cpp"),"utf8"),helperForward=adapter.indexOf("float hostBias(float value);"),helperDefinition=adapter.indexOf("float hostBias(float /* compatibility */ value)");assert.equal([...adapter.matchAll(/\bhostReferenceFrequency\s*=\s*3\.f/g)].length,1);assert.ok(helperForward>=0&&helperDefinition>helperForward);assert.match(adapter,/namespace fixture_support \{\s*using namespace detail;\s*\}/);assert.match(adapter,/namespace detail \{\s*float hostScaleBias\(float value\);/);assert.match(adapter,/panelTheme = ::loadDarkAsDefault\(\)/);const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();wasm.rack_web_set_input_connected(0,1);wasm.rack_web_set_input_channels(0,1);wasm.rack_web_set_output_connected(0,1);new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),128)[0]=2;wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],9)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("qualified namespace free-function implementations come from Rust callable facts",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-qualified-free-function-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"QualifiedFree",name:"Qualified free",description:"Rust qualified callable fixture",tags:["Utility"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);
  fs.writeFileSync(path.join(plugin,"src","QualifiedScale.hpp"),'#pragma once\nnamespace fixture_qualified {\nfloat qualifiedScale(float value);\n}\n');
  fs.writeFileSync(path.join(plugin,"src","QualifiedScale.cpp"),'#include "QualifiedScale.hpp"\nfloat fixture_qualified::qualifiedScale(float value) { return value * 2.f; }\n');
  fs.writeFileSync(path.join(plugin,"src","QualifiedFree.cpp"),'#include "plugin.hpp"\n#include "QualifiedScale.hpp"\nstruct QualifiedFreeModule : Module { enum InputIds { SIGNAL_INPUT, NUM_INPUTS }; enum OutputIds { SIGNAL_OUTPUT, NUM_OUTPUTS }; QualifiedFreeModule() { config(0, NUM_INPUTS, NUM_OUTPUTS, 0); configInput(SIGNAL_INPUT, "Signal"); configOutput(SIGNAL_OUTPUT, "Signal"); } void process(const ProcessArgs&) override { outputs[SIGNAL_OUTPUT].setVoltage(fixture_qualified::qualifiedScale(inputs[SIGNAL_INPUT].getVoltage())); } };\nstruct QualifiedFreeWidget : ModuleWidget {};\nModel* modelQualifiedFree = createModel<QualifiedFreeModule, QualifiedFreeWidget>("QualifiedFree");\n');
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/QualifiedFree","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"});const adapter=fs.readFileSync(path.join(output,"adapter.cpp"),"utf8");assert.equal([...adapter.matchAll(/float fixture_qualified::qualifiedScale\s*\(/g)].length,1);const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();wasm.rack_web_set_input_connected(0,1);wasm.rack_web_set_input_channels(0,1);wasm.rack_web_set_output_connected(0,1);new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),128)[0]=3;wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],6)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("plugin header support closure consumes Rust aliases, types, enums, and scope facts",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-plugin-type-facts-test-")),sourceDir=path.join(temporary,"plugin"),src=path.join(sourceDir,"src");fs.mkdirSync(src,{recursive:true});
  fs.writeFileSync(path.join(src,"plugin.hpp"),`#pragma once
namespace fixture {
using Scalar = float;
using Pair = std::array<Scalar, 2>;
enum class Mode { Off, On };
struct Message final { Pair values{}; Mode mode = Mode::On; float sum() const; };
struct NativeDisplay : Widget {};
}
void buildLocal() {
using LocalAlias = int;
enum LocalMode { LocalOff, LocalOn };
struct LocalMessage { LocalAlias value = LocalOn; };
}`);
  fs.writeFileSync(path.join(src,"plugin.cpp"),'#include "plugin.hpp"\nnamespace fixture { float Message::sum() const { return values[0] + values[1]; } }\n');
  try{
    const parts=referencedPluginGlobalParts(sourceDir,"fixture::Message message; fixture::Mode mode = fixture::Mode::On; NativeDisplay LocalAlias LocalMode LocalMessage;");
    const scalar=parts.declarations.indexOf("using Scalar = float;"),pair=parts.declarations.indexOf("using Pair = std::array<Scalar, 2>;"),mode=parts.declarations.indexOf("enum class Mode"),message=parts.declarations.indexOf("struct Message final");
    assert.ok(scalar>=0&&pair>scalar&&mode>pair&&message>mode);
    assert.match(parts.declarations,/namespace fixture \{[\s\S]*using Scalar = float;/);
    assert.match(parts.implementations,/namespace fixture \{[\s\S]*float Message::sum\(\) const/);
    assert.equal([...parts.implementations.matchAll(/namespace fixture \{/g)].length,1);
    assert.doesNotMatch(parts.declarations,/NativeDisplay|LocalAlias|LocalMode|LocalMessage/);
  }finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("plugin extern globals consume Rust declarator and linkage facts",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-plugin-extern-facts-test-")),sourceDir=path.join(temporary,"plugin"),src=path.join(sourceDir,"src");fs.mkdirSync(src,{recursive:true});
  fs.writeFileSync(path.join(src,"plugin.hpp"),`#pragma once
extern const float pluginGain;
namespace fixture_link { extern int pluginSteps; }
extern "C" {
extern unsigned char pluginBlob[4];
}
struct PluginExternOwner { void configure() { extern int localState; } };
extern Model* modelIgnored;
extern Plugin* pluginIgnored;
extern float unusedPluginValue;
`);
  try{
    const parts=referencedPluginGlobalParts(sourceDir,"float value = pluginGain + fixture_link::pluginSteps + pluginBlob[0] + localState; Model* model = modelIgnored; Plugin* plugin = pluginIgnored;");
    assert.match(parts.declarations,/inline const float pluginGain = \{\};/);
    assert.match(parts.declarations,/namespace fixture_link \{\s*inline int pluginSteps = \{\};\s*\}/);
    assert.match(parts.declarations,/extern "C" inline unsigned char pluginBlob\[4\]\{\};/);
    assert.doesNotMatch(parts.declarations,/localState|modelIgnored|pluginIgnored|unusedPluginValue/);
  }finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("plugin header helper closure consumes Rust ranges and reference edges",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-plugin-helper-facts-test-")),sourceDir=path.join(temporary,"plugin"),src=path.join(sourceDir,"src");fs.mkdirSync(src,{recursive:true});
  fs.writeFileSync(path.join(src,"plugin.hpp"),`#pragma once
namespace fixture {
inline constexpr float pluginBase = 2.f;
inline constexpr float pluginScale = pluginBase * 3.f;
float pluginLeaf(float value = 1.f);
inline float pluginBridge(float value) { return pluginLeaf(value) * pluginScale + 1.f; }
inline float pluginHeaderDecoy(float value) { return value + 9.f; }
inline NVGcolor pluginUiHelper() { return nvgRGB(255, 0, 0); }
}
void pluginLocalConstants() { constexpr float pluginLocal = 99.f; }`);
  fs.writeFileSync(path.join(src,"plugin.cpp"),`#include "plugin.hpp"
namespace fixture {
float pluginLeaf(float value) { return value * 2.f; }
float pluginImplementationDecoy(float value) { return value + 10.f; }
}`);
  try{
    const parts=referencedPluginGlobalParts(sourceDir,'float value = fixture::pluginBridge(3.f); float local = pluginLocal; const char* text = "pluginHeaderDecoy(4.f)"; // pluginImplementationDecoy(5.f)');
    const base=parts.declarations.indexOf("inline constexpr float pluginBase"),scale=parts.declarations.indexOf("inline constexpr float pluginScale");assert.ok(base>=0&&scale>base);
    assert.match(parts.declarations,/namespace fixture \{[\s\S]*float pluginLeaf\(float value = 1\.f\);/);
    assert.match(parts.implementations,/namespace fixture \{[\s\S]*float pluginBridge\(float value\)/);
    assert.match(parts.implementations,/namespace fixture \{[\s\S]*float pluginLeaf\(float value\)/);
    assert.doesNotMatch(parts.declarations,/pluginLocal/);
    assert.doesNotMatch(parts.implementations,/pluginHeaderDecoy|pluginImplementationDecoy|pluginUiHelper/);
  }finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("plugin header Rust support closure compiles transitive namespaced dependencies",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-plugin-type-wasm-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});
  fs.writeFileSync(path.join(plugin,"src","plugin.hpp"),`#pragma once
#include <rack.hpp>
#include <array>
using namespace rack;
namespace fixture {
using Scalar = float;
using Pair = std::array<Scalar, 2>;
enum class Mode { Off, On };
struct Message final { Pair values{2.f, 3.f}; Mode mode = Mode::On; float sum() const; };
struct NativeDisplay : Widget {};
}
void buildLocal() { using LocalAlias = int; enum LocalMode { LocalOff, LocalOn }; struct LocalMessage { LocalAlias value = LocalOn; }; }`);
  fs.writeFileSync(path.join(plugin,"src","plugin.cpp"),'#include "plugin.hpp"\nnamespace fixture { float Message::sum() const { return values[0] + values[1] + float(mode == Mode::On); } }\n');
  const header=path.join(plugin,"src","Simple.hpp"),simple=fs.readFileSync(header,"utf8").replace("struct FixtureModule : Module {","struct FixtureModule : Module {\n  fixture::Message message{};").replace("inputs[SIGNAL_INPUT].getVoltage() * params[LEVEL_PARAM].getValue()","inputs[SIGNAL_INPUT].getVoltage() * params[LEVEL_PARAM].getValue() + message.sum()");fs.writeFileSync(header,simple);
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/Simple","--manifest-file",path.join(plugin,"plugin.json"),"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"});const adapter=fs.readFileSync(path.join(output,"adapter.cpp"),"utf8"),scalar=adapter.indexOf("using Scalar = float;"),pair=adapter.indexOf("using Pair = std::array<Scalar, 2>;"),mode=adapter.indexOf("enum class Mode"),message=adapter.indexOf("struct Message final"),wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;assert.ok(scalar>=0&&pair>scalar&&mode>pair&&message>mode);assert.doesNotMatch(adapter,/NativeDisplay|LocalAlias|LocalMode|LocalMessage/);wasm._initialize();wasm.rack_web_set_input_connected(0,1);wasm.rack_web_set_input_channels(0,1);wasm.rack_web_set_output_connected(0,1);new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),128)[0]=2;wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],8)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("Rust extern declarator facts preserve namespace and C linkage in real WASM",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-plugin-extern-wasm-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});
  fs.writeFileSync(path.join(plugin,"src","plugin.hpp"),`#pragma once
#include <rack.hpp>
using namespace rack;
namespace fixture_link { extern volatile float pluginGain; }
extern "C" {
extern volatile unsigned char pluginBlob[4];
}
`);
  const header=path.join(plugin,"src","Simple.hpp"),simple=fs.readFileSync(header,"utf8").replace("inputs[SIGNAL_INPUT].getVoltage() * params[LEVEL_PARAM].getValue()","inputs[SIGNAL_INPUT].getVoltage() * params[LEVEL_PARAM].getValue() + fixture_link::pluginGain + pluginBlob[0]");fs.writeFileSync(header,simple);
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/Simple","--manifest-file",path.join(plugin,"plugin.json"),"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"});const adapter=fs.readFileSync(path.join(output,"adapter.cpp"),"utf8");assert.match(adapter,/namespace fixture_link \{\s*inline volatile float pluginGain = \{\};\s*\}/);assert.match(adapter,/extern "C" inline volatile unsigned char pluginBlob\[4\]\{\};/);const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();wasm.rack_web_set_input_connected(0,1);wasm.rack_web_set_input_channels(0,1);wasm.rack_web_set_output_connected(0,1);new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),128)[0]=2;wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],2)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("plugin.hpp DSP helpers are collected transitively without importing UI helpers",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-plugin-helper-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});
  fs.writeFileSync(path.join(plugin,"src","PluginConstants.hpp"),'#pragma once\nconst float fixturePluginBase = 1.f;\nconst float fixturePluginScale = fixturePluginBase + 2.f;\n');
  fs.writeFileSync(path.join(plugin,"src","plugin.hpp"),'#pragma once\n#include <rack.hpp>\n#include "PluginConstants.hpp"\nusing namespace rack;\nusing std::vector;\nusing std::list;\nusing simd::int32_4;\nenum class FixturePluginMode { Off, On };\nstruct FixturePluginMessage { float value = 0.f; };\nstruct FixturePluginQuantity : ParamQuantity { float getDisplayValue() override; std::string getDescription() override; };\nstruct FixtureDocs { static std::string documentationStringFor(int index); };\nconst int fixtureUpdateRate = 2;\nfloat fixtureOutOfLine(float value);\njson_t* json_fixtureValue(float value);\ninline float fixtureHelperLeaf(float value) { return value * 2.f; }\ninline float fixtureHelperBridge(float value) { return fixtureOutOfLine(fixtureHelperLeaf(value)) + 1.f; }\ninline NVGcolor fixtureUiColor() { return nvgRGB(255, 0, 0); }\n');
  fs.writeFileSync(path.join(plugin,"src","plugin.cpp"),'#include "plugin.hpp"\nCMRC_DECLARE(fixture_docs);\nfloat FixturePluginQuantity::getDisplayValue() { return fixtureOutOfLine(getValue()); }\nstd::string FixturePluginQuantity::getDescription() { return "fixture description"; }\nstd::string FixtureDocs::documentationStringFor(int) { auto fs = cmrc::fixture_docs::get_filesystem(); return fs.is_file("fixture") ? "fixture" : ""; }\nfloat fixtureOutOfLine(float value) { return value * fixturePluginScale + MOOG_PI - MOOG_PI; }\njson_t* json_fixtureValue(float value) { return json_real(value); }\n');
  const header=path.join(plugin,"src","Simple.hpp"),simple=fs.readFileSync(header,"utf8").replace("struct FixtureModule : Module {","struct FixtureModule : Module {\n  FixturePluginMode pluginMode = FixturePluginMode::On;\n  std::unique_ptr<float> pluginValue = make_unique<float>(2.f);\n  vector<float> pluginVector{1.f};\n  list<float> pluginList{1.f};\n  int32_4 pluginIndices{0};\n  float orderedScale = fixturePluginScale;\n  json_t* dataToJson() override { auto* root = json_object(); json_object_set_new(root, \"fixture\", json_fixtureValue(orderedScale)); return root; }").replace("configParam(LEVEL_PARAM","configParam<FixturePluginQuantity>(LEVEL_PARAM").replace("inputs[SIGNAL_INPUT].getVoltage() * params[LEVEL_PARAM].getValue()","FixturePluginMessage{fixtureHelperBridge(inputs[SIGNAL_INPUT].getVoltage() * params[LEVEL_PARAM].getValue()) * fixtureUpdateRate + *pluginValue + orderedScale - fixturePluginScale + FixtureDocs::documentationStringFor(0).size() * 0}.value");fs.writeFileSync(header,simple);
  try{const report=JSON.parse(execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/Simple","--manifest-file",path.join(plugin,"plugin.json"),"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"}));const adapter=fs.readFileSync(path.join(output,"adapter.cpp"),"utf8"),baseConstantIndex=adapter.indexOf("fixturePluginBase = 1.f"),scaleConstantIndex=adapter.indexOf("fixturePluginScale = fixturePluginBase + 2.f"),implementationIndex=adapter.indexOf("float fixtureOutOfLine(float value) {");assert.deepEqual(report.assessment.blockers,[]);assert.match(adapter,/using std::vector/);assert.match(adapter,/using std::list/);assert.match(adapter,/using rack::simd::int32_4/);assert.doesNotMatch(adapter,/using namespace std/);assert.match(adapter,/enum class FixturePluginMode/);assert.match(adapter,/struct FixturePluginMessage/);assert.match(adapter,/FixturePluginQuantity::getDisplayValue/);assert.match(adapter,/const int fixtureUpdateRate = 2;/);assert.ok(baseConstantIndex>=0&&scaleConstantIndex>baseConstantIndex&&implementationIndex>scaleConstantIndex);assert.match(adapter,/inline constexpr double MOOG_PI/);assert.match(adapter,/float fixtureHelperBridge\(float value\)/);assert.match(adapter,/float fixtureHelperLeaf\(float value\)/);assert.match(adapter,/json_t\s*\*\s*json_fixtureValue\(float value\)/);assert.match(adapter,/FixtureDocs::documentationStringFor\(int\)\s*\{\s*return "";\s*\}/);assert.doesNotMatch(adapter,/CMRC_DECLARE|cmrc::fixture_docs|fixtureUiColor/);const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();wasm.rack_web_set_input_connected(0,1);wasm.rack_web_set_input_channels(0,1);new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),128)[0]=2;wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],28)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("inherited menu helpers accept string units and replace stripped quantity types",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-menu-param-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"MenuParam",name:"Menu parameter",description:"Shared menu parameter helper fixture",tags:["Utility"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);
  fs.writeFileSync(path.join(plugin,"src","MenuBase.hpp"),'#pragma once\n#include "plugin.hpp"\nstruct StrippedMenuQuantity;\nstruct MenuBase : Module { void configMenuParam(int id, float minimum, float maximum, float initial, std::string label, int controlType, std::string unit) { configParam(id, minimum, maximum, initial, label, unit, 0.f, 1.f, 0.f); } void configMenuParam(int id, float initial, std::string label, std::vector<std::string> options) { configParam<StrippedMenuQuantity>(id, 0.f, options.size() - 1, initial, label); } };\nstruct StrippedMenuQuantity : ParamQuantity { std::string getDisplayValueString() override { return "menu"; } };\n');
  fs.writeFileSync(path.join(plugin,"src","MenuParam.cpp"),'#include "plugin.hpp"\n#include "MenuBase.hpp"\nstruct MenuParamModule : MenuBase { enum ParamIds { GAIN_PARAM, MODE_PARAM, NUM_PARAMS }; enum OutputIds { SIGNAL_OUTPUT, NUM_OUTPUTS }; MenuParamModule() { config(NUM_PARAMS, 0, NUM_OUTPUTS, 0); configMenuParam(GAIN_PARAM, -2.f, 2.f, .5f, "Gain", 2, " V"); configMenuParam(MODE_PARAM, 1.f, "Mode", {"A", "B"}); configOutput(SIGNAL_OUTPUT, "Signal"); } void process(const ProcessArgs&) override { outputs[SIGNAL_OUTPUT].setVoltage(params[GAIN_PARAM].getValue() + params[MODE_PARAM].getValue()); } }; struct MenuParamWidget : ModuleWidget {}; Model* modelMenuParam = createModel<MenuParamModule, MenuParamWidget>("MenuParam");\n');
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/MenuParam","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"});const adapter=fs.readFileSync(path.join(output,"adapter.cpp"),"utf8"),runtime=JSON.parse(fs.readFileSync(path.join(output,"runtime.json"),"utf8"));assert.match(adapter,/configParam<ParamQuantity>\(id, 0\.f/);assert.doesNotMatch(adapter,/configParam<StrippedMenuQuantity>/);assert.deepEqual(runtime.params.map(({name,min,max,default:initial})=>({name,min,max,initial})),[{name:"Gain",min:-2,max:2,initial:.5},{name:"Mode",min:0,max:1,initial:1}]);const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();assert.deepEqual([wasm.rack_web_param_count(),wasm.rack_web_output_count()],[2,1]);wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],1.5)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("GUI choice siblings are stripped and repeated dependency enums are emitted once",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-gui-choice-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"ProgressLike",name:"Progress like",description:"A stateful module sharing its header with native GUI choices",tags:["Sequencer"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);
  fs.writeFileSync(path.join(plugin,"src","ProgressState.hpp"),'#pragma once\nconstexpr auto ProgressLikeSlug {"ProgressLike"};\nnamespace ah { namespace music {\nenum Notes { NOTE_C = 0, NOTE_D, NUM_NOTES };\nstruct ProgressState { Notes note = NOTE_D; float apply(float value) const { return value + note; } };\nstruct RootChoice : gui::AHChoice { ProgressState* state = nullptr; void step() override; };\nstruct DegreeChoice : RootChoice { void step() override; };\n} }\n');
  fs.writeFileSync(path.join(plugin,"src","ProgressLike.cpp"),'#include "plugin.hpp"\n#include "ProgressState.hpp"\nusing namespace ah::music;\nstruct ProgressLike : Module { enum InputIds { SIGNAL_INPUT, NUM_INPUTS }; enum OutputIds { SIGNAL_OUTPUT, NUM_OUTPUTS }; ProgressState state; ProgressLike() { config(0, NUM_INPUTS, NUM_OUTPUTS, 0); configInput(SIGNAL_INPUT, "Signal"); configOutput(SIGNAL_OUTPUT, "Signal"); } void process(const ProcessArgs&) override { outputs[SIGNAL_OUTPUT].setVoltage(state.apply(inputs[SIGNAL_INPUT].getVoltage())); }\njson_t* dataToJson() override { json_t* rootJ = json_object();\n#ifdef PARASITES\njson_object_set_new(rootJ, "reverse", json_integer(1));\n#endif\nreturn rootJ; } };\nstruct ProgressLikeWidget : ModuleWidget { ProgressLikeWidget() { setPanel(SVG::load(asset::plugin(pluginInstance, "res/ProgressLikeLight.svg")));\n// box.size = Vec(300, 380);\nWidget* child = nullptr; child->box.size = Vec(300, 100);\n// addInput(createInputCentered<PJ301MPort>(Vec(10, 10), module, ProgressLike::SIGNAL_INPUT));\naddInput(createInputCentered<PJ301MPort>(Vec(box.size.x / 2.f, 200), module, ProgressLike::SIGNAL_INPUT)); } };\nModel* modelProgressLike = createModel<ProgressLike, ProgressLikeWidget>(ProgressLikeSlug);\n');
  fs.writeFileSync(path.join(plugin,"res","ProgressLikeLight.svg"),'<svg width="75" height="380" xmlns="http://www.w3.org/2000/svg"></svg>\n');
  try{const report=JSON.parse(execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/ProgressLike","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile","--use-rust-analysis"],{encoding:"utf8"})),adapter=fs.readFileSync(path.join(output,"adapter.cpp"),"utf8"),runtime=JSON.parse(fs.readFileSync(path.join(output,"runtime.json"),"utf8")),wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;assert.equal(report.assessment.compileEligible,true);assert.equal(runtime.width,75);assert.deepEqual(runtime.stateKeys??[],[]);assert.deepEqual(runtime.inputs[0].position,{x:37.5,y:200,centered:true});assert.equal([...adapter.matchAll(/\benum\s+Notes\b/g)].length,1);assert.doesNotMatch(adapter,/gui::AHChoice|RootChoice|DegreeChoice/);wasm._initialize();wasm.rack_web_set_input_connected(0,1);wasm.rack_web_set_input_channels(0,1);new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),128)[0]=2;wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],3)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("empty derived module classes inherit their complete Rack contract",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-empty-derived-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"EmptyDerived",name:"Empty derived",description:"An empty visual module inheriting its Rack contract",tags:["Blank"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);
  fs.writeFileSync(path.join(plugin,"src","empty_base.hh"),'#pragma once\n#include "plugin.hpp"\nstruct EmptyBase : Module { EmptyBase() { config(0, 0, 0, 0); } };\n');
  fs.writeFileSync(path.join(plugin,"src","EmptyDerived.cpp"),'#include "empty_base.hh"\nstruct EmptyDerived : EmptyBase {};\nstruct EmptyDerivedWidget : ModuleWidget { int hp = 0; EmptyDerivedWidget() { hp = 3; } };\nModel* modelEmptyDerived = createModel<EmptyDerived, EmptyDerivedWidget>("EmptyDerived");\n');
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/EmptyDerived","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile","--use-rust-analysis"],{encoding:"utf8"});const runtime=JSON.parse(fs.readFileSync(path.join(output,"runtime.json"),"utf8")),wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();assert.equal(runtime.width,45);assert.deepEqual([wasm.rack_web_param_count(),wasm.rack_web_input_count(),wasm.rack_web_output_count(),wasm.rack_web_light_count()],[0,0,0,0])}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("hh template bases resolve counts from derived static arrays",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-hh-array-base-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"ArraySized",name:"Array sized",description:"A template base sized by its concrete module",tags:["Utility"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);
  fs.writeFileSync(path.join(plugin,"src","array_base.hh"),'#pragma once\n#include "plugin.hpp"\nstruct ArrayItem { const char* name; };\nstruct ArrayLayout { size_t cols; float x[2]; };\ntemplate <typename T> struct ArrayBase : Module { enum ParamId { FIXED_PARAM, FIRST_DYNAMIC_PARAM }; enum InputId { FIRST_INPUT }; enum OutputId { FIRST_OUTPUT }; enum LightId { FIRST_LIGHT }; static constexpr unsigned PARAMS_LEN = T::values.size() + 1; static constexpr unsigned INPUTS_LEN = T::values.size(); static constexpr unsigned OUTPUTS_LEN = T::values.size(); static constexpr unsigned LIGHTS_LEN = T::values.size(); ArrayBase() { config(PARAMS_LEN, INPUTS_LEN, OUTPUTS_LEN, LIGHTS_LEN); configParam(FIXED_PARAM, 0.f, 1.f, .5f, "Fixed"); for (auto i = 0u; i < T::values.size(); ++i) { std::string name = std::string{T::values[i].name} + " level"; configParam(i + FIRST_DYNAMIC_PARAM, 0.f, 1.f, 0.f, name); getParamQuantity(i + FIRST_DYNAMIC_PARAM)->snapEnabled = true; } } };\ntemplate <typename M> struct ArrayBaseWidget : ModuleWidget { inline static constexpr ArrayLayout layout{.cols = 2, .x = {12.f, 48.f}}; ArrayBaseWidget(M* module) { box.size = Vec(60, 380); addParam(createParamCentered<RoundBlackKnob>(Vec(10, 20), module, M::FIXED_PARAM)); constexpr size_t itemCount = M::values.size(); constexpr bool compact = itemCount <= 4; constexpr float yStart = compact ? 100.f : 300.f; constexpr float rowOffsets[2] = {0.f, 100.f}; for (size_t i = 0; i < itemCount; ++i) { const size_t row = i / layout.cols; const float x = layout.x[i % layout.cols]; const float y = yStart + rowOffsets[row]; addParam(createParamCentered<RoundBlackKnob>(Vec(x, y), module, M::FIRST_DYNAMIC_PARAM + i)); addInput(createInputCentered<PJ301MPort>(Vec(x, y + 10.f), module, M::FIRST_INPUT + i)); addOutput(createOutputCentered<PJ301MPort>(Vec(x, y + 20.f), module, M::FIRST_OUTPUT + i)); addChild(createLightCentered<SmallLight<RedLight>>(Vec(x, y + 30.f), module, M::FIRST_LIGHT + i)); } } };\n');
  fs.writeFileSync(path.join(plugin,"src","ArraySized.cpp"),'#include "array_base.hh"\nstruct ArraySized : ArrayBase<ArraySized> { static constexpr auto values = std::array{ArrayItem{"One"}, ArrayItem{"Two"}, ArrayItem{"Three"}, ArrayItem{"Four"}}; };\nstruct ArraySizedWidget : ArrayBaseWidget<ArraySized> { using ArrayBaseWidget<ArraySized>::ArrayBaseWidget; };\nModel* modelArraySized = createModel<ArraySized, ArraySizedWidget>("ArraySized");\n');
  try{const report=JSON.parse(execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/ArraySized","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile","--use-rust-analysis"],{encoding:"utf8",env:{...process.env,RACK_WEB_REQUIRE_RUST_CONFIG_CALLS:"1",RACK_WEB_REQUIRE_RUST_CONFIG_EXPANSION:"1",RACK_WEB_REQUIRE_RUST_CONSTANT_ANALYSIS:"1",RACK_WEB_REQUIRE_RUST_INTEGER_EVAL:"1",RACK_WEB_REQUIRE_RUST_STRING_EVAL:"1"}})),runtime=JSON.parse(fs.readFileSync(path.join(output,"runtime.json"),"utf8")),wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;assert.deepEqual(report.detected.counts,{params:5,inputs:4,outputs:4,lights:4});assert.deepEqual(runtime.params.map(param=>param.name),["Fixed","One level","Two level","Three level","Four level"]);assert.deepEqual(runtime.params.map(param=>Boolean(param.snap)),[false,true,true,true,true]);assert.deepEqual(runtime.params.map(param=>param.position),[{x:10,y:20,centered:true,widget:"RoundBlackKnob"},{x:12,y:100,centered:true,widget:"RoundBlackKnob"},{x:48,y:100,centered:true,widget:"RoundBlackKnob"},{x:12,y:200,centered:true,widget:"RoundBlackKnob"},{x:48,y:200,centered:true,widget:"RoundBlackKnob"}]);assert.deepEqual(runtime.inputs.map(input=>input.position),[{x:12,y:110,centered:true},{x:48,y:110,centered:true},{x:12,y:210,centered:true},{x:48,y:210,centered:true}]);assert.deepEqual(runtime.outputs.map(output=>output.position),[{x:12,y:120,centered:true},{x:48,y:120,centered:true},{x:12,y:220,centered:true},{x:48,y:220,centered:true}]);assert.deepEqual(runtime.lightWidgets.map(light=>light.position),[{x:12,y:130,centered:true},{x:48,y:130,centered:true},{x:12,y:230,centered:true},{x:48,y:230,centered:true}]);assert.deepEqual(runtime.lightWidgets.map(light=>light.widget),["SmallLight<RedLight>","SmallLight<RedLight>","SmallLight<RedLight>","SmallLight<RedLight>"]);wasm._initialize();assert.deepEqual([wasm.rack_web_param_count(),wasm.rack_web_input_count(),wasm.rack_web_output_count(),wasm.rack_web_light_count()],[5,4,4,4])}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("direct Rack Module blank registrations receive a zero-port browser wrapper",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-direct-blank-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"Blank1HP",name:"Direct blank",description:"A direct Rack Module blank registration",tags:["Blank"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);
  fs.writeFileSync(path.join(plugin,"src","DirectBlank.cpp"),'#include "plugin.hpp"\ntemplate <int HP> struct DirectBlankWidget : ModuleWidget {};\nModel* modelDirectBlank = createModel<Module, DirectBlankWidget<1>>("Blank1HP");\n');
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/Blank1HP","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"});const runtime=JSON.parse(fs.readFileSync(path.join(output,"runtime.json"),"utf8")),wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();assert.equal(runtime.width,15);assert.deepEqual([wasm.rack_web_param_count(),wasm.rack_web_input_count(),wasm.rack_web_output_count(),wasm.rack_web_light_count()],[0,0,0,0])}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("a namespaced plugin class named Module is not mistaken for the Rack base",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-namespaced-module-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"NamespacedModule",name:"Namespaced module",description:"A plugin DSP class named Module",tags:["Utility"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);const moduleDirectory=path.join(plugin,"src","namespaced");fs.mkdirSync(moduleDirectory,{recursive:true});
  fs.writeFileSync(path.join(moduleDirectory,"module.hpp"),'#pragma once\n#include "rack.hpp"\nnamespace fixture { namespace namespaced {\nstruct Module : rack::engine::Module { enum ParamIds { GAIN_PARAM, NUM_PARAMS }; enum InputIds { SIGNAL_INPUT, NUM_INPUTS }; enum OutputIds { SIGNAL_OUTPUT, NUM_OUTPUTS }; enum LightIds { NUM_LIGHTS }; Module() { config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS); configParam(GAIN_PARAM, 0.f, 2.f, 1.f, "Gain"); } void process(ProcessArgs const&) override { outputs[SIGNAL_OUTPUT].setVoltage(inputs[SIGNAL_INPUT].getVoltage() * params[GAIN_PARAM].getValue()); } };\n} }\n');
  fs.writeFileSync(path.join(moduleDirectory,"init.cpp"),'#include "module.hpp"\nnamespace fixture { namespace namespaced {\nstruct Panel : ModuleWidget {};\nvoid initNamespaced(Plugin* plugin) { plugin->addModel(createModel<Module, Panel>("NamespacedModule")); }\n} }\n');
  try{const report=JSON.parse(execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/NamespacedModule","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"})),wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;assert.equal(report.source.moduleClass,"Module");assert.equal(report.source.file,"src/namespaced/module.hpp");wasm._initialize();assert.deepEqual([wasm.rack_web_param_count(),wasm.rack_web_input_count(),wasm.rack_web_output_count(),wasm.rack_web_light_count()],[1,1,1,0]);assert.equal(typeof wasm.rack_web_reset_param,"function");wasm.rack_web_reset_param(0,1.25);assert.equal(wasm.rack_web_get_param(0),1.25);wasm.rack_web_set_input_connected(0,1);wasm.rack_web_set_input_channels(0,1);new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),128)[0]=3;wasm.rack_web_set_param(0,2);wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],6)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("relative registrations preserve concrete template arguments and same-named namespace dependencies",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-relative-template-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"RelativeTemplate",name:"Relative template",description:"A relatively registered namespaced module template",tags:["Utility"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);const moduleDirectory=path.join(plugin,"src","relative");fs.mkdirSync(moduleDirectory,{recursive:true});
  fs.writeFileSync(path.join(moduleDirectory,"forward.hpp"),'#pragma once\nnamespace fixture { namespace variant { template <typename Engine> struct Processor; } }\n');
  fs.writeFileSync(path.join(moduleDirectory,"shared.hpp"),'#pragma once\nnamespace fixture { namespace shared { enum class ModeId { Add }; struct HEngine { static float apply(float value) { return value + 2.f; } }; } }\n');
  fs.writeFileSync(path.join(moduleDirectory,"module.hpp"),'#pragma once\n#include "rack.hpp"\n#include "forward.hpp"\n#include "shared.hpp"\nnamespace fixture { namespace variant { enum class ModeId { Normal }; template <typename Engine> struct Processor : rack::engine::Module { enum ParamIds { GAIN_PARAM, NUM_PARAMS }; enum InputIds { SIGNAL_INPUT, NUM_INPUTS }; enum OutputIds { SIGNAL_OUTPUT, NUM_OUTPUTS }; enum LightIds { NUM_LIGHTS }; fixture::shared::ModeId sharedMode = fixture::shared::ModeId::Add; ModeId localMode = ModeId::Normal; Processor() { config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS); configParam(GAIN_PARAM, 0.f, 2.f, 1.f, "Gain"); } void process(ProcessArgs const&) override { outputs[SIGNAL_OUTPUT].setVoltage(Engine::apply(inputs[SIGNAL_INPUT].getVoltage()) * params[GAIN_PARAM].getValue()); } }; } }\n');
  fs.writeFileSync(path.join(moduleDirectory,"init.cpp"),'#include "module.hpp"\nnamespace fixture { struct RelativePanel : ModuleWidget { RelativePanel(variant::Processor<shared::HEngine>* module) { setModule(module); box.size = Vec(75, 380); } }; void initRelative(Plugin* plugin) { plugin->addModel(createModel<variant::Processor<shared::HEngine>, RelativePanel>("RelativeTemplate")); } }\n');
  try{const report=JSON.parse(execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/RelativeTemplate","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile","--use-rust-analysis"],{encoding:"utf8"})),adapter=fs.readFileSync(path.join(output,"adapter.cpp"),"utf8"),wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;assert.equal(report.source.moduleClass,"variant::Processor<shared::HEngine>");assert.equal(report.source.file,"src/relative/module.hpp");assert.equal(report.detected.panelWidth,75);assert.match(adapter,/enum class ModeId \{ Add \}/);assert.match(adapter,/enum class ModeId \{ Normal \}/);assert.match(adapter,/struct HEngine/);assert.match(adapter,/using RackWebModule = fixture::variant::Processor<fixture::shared::HEngine>/);wasm._initialize();assert.deepEqual([wasm.rack_web_param_count(),wasm.rack_web_input_count(),wasm.rack_web_output_count(),wasm.rack_web_light_count()],[1,1,1,0]);wasm.rack_web_set_input_connected(0,1);wasm.rack_web_set_input_channels(0,1);new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),128)[0]=3;wasm.rack_web_set_param(0,2);wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],10)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("out-of-line widget constructors determine the exact Rack panel width",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-widget-width-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"OutOfLineWidth",name:"Out-of-line width",description:"A widget-sized direct blank",tags:["Blank"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);
  fs.writeFileSync(path.join(plugin,"src","OutOfLineWidth.cpp"),'#include "plugin.hpp"\nstruct SizedBlankWidget : ModuleWidget { SizedBlankWidget(Module*); };\nSizedBlankWidget::SizedBlankWidget(Module*) { box.size = Vec(15 * 6, 380); }\nModel* modelSizedBlank = createModel<Module, SizedBlankWidget>("OutOfLineWidth");\n');
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/OutOfLineWidth","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output],{encoding:"utf8"});const runtime=JSON.parse(fs.readFileSync(path.join(output,"runtime.json"),"utf8"));assert.equal(runtime.width,90)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("templated widget arguments and inherited bases determine panel width",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-template-width-test-")),plugin=path.join(temporary,"plugin"),directOutput=path.join(temporary,"direct-output"),derivedOutput=path.join(temporary,"derived-output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"DirectTemplateWidth",name:"Direct template width",description:"A directly registered templated blank",tags:["Blank"]},{slug:"DerivedTemplateWidth",name:"Derived template width",description:"A blank inheriting a templated widget",tags:["Blank"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);
  fs.writeFileSync(path.join(plugin,"src","TemplateWidths.cpp"),'#include "plugin.hpp"\ntemplate <int HP> struct TemplateWidthWidget : ModuleWidget { TemplateWidthWidget(Module*) { this->box.size = Vec(HP * 15, 380); } };\nstruct DerivedWidthWidget : TemplateWidthWidget<4> { DerivedWidthWidget(Module* module) : TemplateWidthWidget<4>(module) {} };\nModel* modelDirectTemplateWidth = createModel<Module, TemplateWidthWidget<7>>("DirectTemplateWidth");\nModel* modelDerivedTemplateWidth = createModel<Module, DerivedWidthWidget>("DerivedTemplateWidth");\n');
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/DirectTemplateWidth","--manifest-file",manifestPath,"--source-dir",plugin,"--output",directOutput],{encoding:"utf8"});execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/DerivedTemplateWidth","--manifest-file",manifestPath,"--source-dir",plugin,"--output",derivedOutput],{encoding:"utf8"});assert.equal(JSON.parse(fs.readFileSync(path.join(directOutput,"runtime.json"),"utf8")).width,105);assert.equal(JSON.parse(fs.readFileSync(path.join(derivedOutput,"runtime.json"),"utf8")).width,60)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("DHE-style template aliases resolve anonymous enum counts and Rack quantity helpers",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-dhe-alias-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"DheAlias",name:"DHE alias",description:"Anonymous enum aliases in a module template",tags:["Logic"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);
  const moduleDirectory=path.join(plugin,"src","modules","truth");fs.mkdirSync(moduleDirectory,{recursive:true});
  fs.writeFileSync(path.join(moduleDirectory,"module.h"),'#pragma once\n#include "rack.hpp"\n#define MULTIPLE(name, n) name, name##_LAST = (name) + (n)-1\n#define PER_INPUT(name) name, name##_LAST = (name) + input_count - 1\nnamespace fixture { namespace truth {\nstatic auto constexpr input_count = 2;\ntemplate <int N> struct ParamIds { enum { Mode, MULTIPLE(Choice, N), Count }; };\ntemplate <int N> struct InputIds { enum { PER_INPUT(Input), Count }; };\nstruct OutputId { enum { Out, Count }; };\nstruct ModeSwitch { using Quantity = rack::engine::SwitchQuantity; static auto config(rack::engine::Module* module, int id) -> Quantity* { auto labels = std::vector<std::string>{"Off", "On"}; return module->configSwitch(id, 0.f, 1.f, 0.f, "Mode", labels); } };\ntemplate <typename Scale> struct LinearKnob { static auto config(rack::engine::Module* module, int id, float value = Scale::default_value) -> rack::engine::ParamQuantity* { return module->configParam(id, 0.f, 1.f, value); } };\nstruct BipolarKnob : LinearKnob<BipolarKnob> { static auto constexpr default_value = 0.f; };\nstruct VoltageKnob {\n  struct Quantity : rack::engine::ParamQuantity {};\n  template <typename Panel> struct Widget : rack::app::SvgKnob {};\n  template <typename Panel> static auto install(Panel* panel, int id) -> Widget<Panel>* { return rack::createParamCentered<Widget<Panel>>(rack::math::Vec(), panel->getModule(), id); }\n  static auto config(rack::engine::Module* module, int id, float voltage = BipolarKnob::default_value) -> Quantity* { return module->configParam<Quantity>(id, 0.f, 1.f, voltage); }\n};\ninline float fixtureTruthValue(float value) { return value; }\ntemplate <int N> struct Module : rack::engine::Module {\n  using ParamId = ParamIds<N>;\n  using InputId = InputIds<N>;\n  Module() { config(ParamId::Count, InputId::Count, OutputId::Count); ModeSwitch::config(this, ParamId::Mode); }\n  void process(ProcessArgs const&) override { outputs[OutputId::Out].setVoltage(fixtureTruthValue(inputs[InputId::Input].getVoltage()) + params[ParamId::Mode].getValue()); }\n  void dataFromJson(json_t* data) override { (void)json_object_get(data, preset_version_key); }\n  json_t* dataToJson() override { auto* data = json_object(); json_object_set_new(data, preset_version_key, json_integer(1)); return data; }\n};\n} }\n#undef PER_INPUT\n#undef MULTIPLE\n');
  const modulePath=path.join(moduleDirectory,"module.h");fs.writeFileSync(modulePath,fs.readFileSync(modulePath,"utf8").replace("ModeSwitch::config(this, ParamId::Mode);","ModeSwitch::config(this, ParamId::Mode); VoltageKnob::config(this, ParamId::Choice);").replace("using InputId = InputIds<N>;","using InputId = InputIds<N>;\n  static_assert(rack::simd::float_4::size == 4);\n  float DryKnob = 0.f;"));
  fs.writeFileSync(path.join(moduleDirectory,"init.cpp"),'#include "module.h"\n#include "rack.hpp"\nnamespace fixture { namespace truth {\nstruct TruthWidget : ModuleWidget { TruthWidget(Module<2>* module) { setModule(module); box.size = Vec(90, 380); } };\nvoid initDheAlias(Plugin* plugin) { plugin->addModel(rack::createModel<Module<2>, TruthWidget>("DheAlias")); }\n} }\n');
  try{const report=JSON.parse(execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/DheAlias","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"})),adapter=fs.readFileSync(path.join(output,"adapter.cpp"),"utf8"),wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;assert.deepEqual(report.detected.template.constants,{N:2});assert.deepEqual(report.detected.enums.params.identifiers,["Mode",{base:"Choice",count:"N"},"Count"]);assert.match(adapter,/template <int N>\s*struct Module : ::Module/);assert.match(adapter,/struct ModeSwitch/);assert.match(adapter,/return module->configSwitch/);assert.match(adapter,/struct VoltageKnob/);assert.match(adapter,/float DryKnob = 0\.f/);assert.doesNotMatch(adapter,/SvgKnob|createParamCentered|static auto install/);assert.match(adapter,/preset_version_key = "preset_version"/);wasm._initialize();assert.deepEqual([wasm.rack_web_param_count(),wasm.rack_web_input_count(),wasm.rack_web_output_count(),wasm.rack_web_light_count()],[3,2,1,0]);wasm.rack_web_set_input_connected(0,1);wasm.rack_web_set_input_channels(0,1);new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),128)[0]=4;wasm.rack_web_set_param(0,1);wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],5)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("module extraction follows browser preprocessor branches before parsing braces",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-conditional-body-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"ConditionalBody",name:"Conditional body",description:"A module whose constructor differs across host branches",tags:["Utility"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);
  fs.writeFileSync(path.join(plugin,"src","ConditionalBody.cpp"),'#include "plugin.hpp"\nstruct ConditionalBody : Module {\n  enum ParamIds { NUM_PARAMS }; enum InputIds { NUM_INPUTS }; enum OutputIds { SIGNAL_OUTPUT, NUM_OUTPUTS }; enum LightIds { NUM_LIGHTS };\n#if defined(METAMODULE_BUILTIN)\n  ConditionalBody() {\n#else\n  ConditionalBody() { config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS); }\n#endif\n};\nstruct ConditionalBodyWidget : ModuleWidget {};\nModel* modelConditionalBody = createModel<ConditionalBody, ConditionalBodyWidget>("ConditionalBody");\n');
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/ConditionalBody","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile","--use-rust-analysis"],{encoding:"utf8",env:{...process.env,RACK_WEB_REQUIRE_RUST_CONFIG_CALLS:"1",RACK_WEB_REQUIRE_RUST_CONFIG_EXPANSION:"1",RACK_WEB_REQUIRE_RUST_DECLARATIONS:"1",RACK_WEB_REQUIRE_RUST_PREPROCESS:"1"}});const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();assert.equal(wasm.rack_web_output_count(),1)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("Rack 1 bypass and Rack 2 bypassed names share one module state",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-legacy-bypass-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"LegacyBypass",name:"Legacy bypass",description:"Rack 1 bypass field fixture",tags:["Utility"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);
  fs.writeFileSync(path.join(plugin,"src","LegacyBypass.cpp"),'#include "plugin.hpp"\nstruct LegacyBypassModule : Module { enum ParamIds { BYPASS_PARAM, NUM_PARAMS }; enum InputIds { NUM_INPUTS }; enum OutputIds { SIGNAL_OUTPUT, NUM_OUTPUTS }; enum LightIds { NUM_LIGHTS }; LegacyBypassModule() { config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS); configParam(BYPASS_PARAM, 0.f, 1.f, 0.f, "Bypass"); } void process(const ProcessArgs&) override { bypassed = params[BYPASS_PARAM].getValue() > .5f; outputs[SIGNAL_OUTPUT].setVoltage(bypass ? 0.f : 10.f); } }; struct LegacyBypassWidget : ModuleWidget {}; Model* modelLegacyBypass = createModel<LegacyBypassModule, LegacyBypassWidget>("LegacyBypass");\n');
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/LegacyBypass","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"});const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();const outputs=new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128);wasm.rack_web_process(1,48000);assert.equal(outputs[0],10);wasm.rack_web_set_param(0,1);wasm.rack_web_process(1,48000);assert.equal(outputs[0],0)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("orphaned qualified UI using declarations are removed after UI stripping",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-orphan-ui-using-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});
  const header=path.join(plugin,"src","Simple.hpp"),simple=fs.readFileSync(header,"utf8").replace('#include "plugin.hpp"','#include "plugin.hpp"\nnamespace AnimatekUI { struct TextLabel : ModuleWidget {}; }\nusing AnimatekUI::TextLabel;');fs.writeFileSync(header,simple);
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/Simple","--manifest-file",path.join(plugin,"plugin.json"),"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"});const adapter=fs.readFileSync(path.join(output,"adapter.cpp"),"utf8");assert.doesNotMatch(adapter,/AnimatekUI::TextLabel/);const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();assert.equal(wasm.rack_web_param_count(),1)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("Rack umbrella MIDI queues, engine frames, nested events, and geometry run in WASM",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-midi-contract-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"MidiContract",name:"MIDI contract",description:"Rack MIDI and math compatibility fixture",tags:["MIDI"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);
  fs.writeFileSync(path.join(plugin,"src","MidiContract.cpp"),'#include "plugin.hpp"\nstruct MidiContractModule : Module { enum ParamIds { NUM_PARAMS }; enum InputIds { NUM_INPUTS }; enum OutputIds { MIDI_OUTPUT, NUM_OUTPUTS }; enum LightIds { NUM_LIGHTS }; midi::InputQueue queue; midi::Output sender; MidiContractModule() { config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS); configOutput(MIDI_OUTPUT, "MIDI value"); sender.channel = 2; } void onReset(const Module::ResetEvent&) override {} void process(const ProcessArgs& args) override { midi::Message message; math::Rect bounds(math::Vec(0.f), math::Vec(2.f)); const bool geometry = bounds.contains(math::Vec(1.f, 0.f).rotate(0.f)); const bool received = geometry && queue.tryPop(&message, args.frame); outputs[MIDI_OUTPUT].setVoltage(received ? message.getValue() : 0.f); if (received) sender.sendMessage(message); } }; struct MidiContractWidget : ModuleWidget {}; Model* modelMidiContract = createModel<MidiContractModule, MidiContractWidget>("MidiContract");\n');
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/MidiContract","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"});const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();wasm.rack_web_midi_push(3,0x90,60,99);wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],99);assert.equal(wasm.rack_web_midi_output_available(),1);assert.deepEqual([...new Uint8Array(wasm.memory.buffer,wasm.rack_web_midi_output_buffer(),4)],[3,0x92,60,99]);wasm.rack_web_consume_midi_output(1);assert.equal(wasm.rack_web_midi_output_available(),0)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("Rack MidiGenerator emits state-diffed messages through the browser MIDI output ABI",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-midi-generator-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"MidiGenerate",name:"MIDI generate",description:"Rack MIDI generator fixture",tags:["MIDI"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);
  fs.writeFileSync(path.join(plugin,"src","MidiGenerate.cpp"),'#include "plugin.hpp"\nstruct MidiGenerateModule : Module { enum ParamIds { NUM_PARAMS }; enum InputIds { NUM_INPUTS }; enum OutputIds { NUM_OUTPUTS }; enum LightIds { NUM_LIGHTS }; struct Generator : dsp::MidiGenerator<1> { midi::Output* output = nullptr; void onMessage(midi::Message message) override { output->sendMessage(message); } }; midi::Output output; Generator generator; bool sent = false; MidiGenerateModule() { config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS); output.channel = 4; generator.output = &output; } void process(const ProcessArgs& args) override { if (sent) return; generator.setFrame(args.frame); generator.setVelocity(100, 0); generator.setNoteGate(64, true, 0); sent = true; } }; struct MidiGenerateWidget : ModuleWidget {}; Model* modelMidiGenerate = createModel<MidiGenerateModule, MidiGenerateWidget>("MidiGenerate");\n');
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/MidiGenerate","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"});const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();wasm.rack_web_process(1,48000);assert.equal(wasm.rack_web_midi_output_available(),1);assert.deepEqual([...new Uint8Array(wasm.memory.buffer,wasm.rack_web_midi_output_buffer(),4)],[3,0x94,64,100])}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("millimeter panel widths snap to the Rack 15 px HP grid",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-mm-panel-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});fs.writeFileSync(path.join(plugin,"res","Simple.svg"),'<svg width="30.196594mm" height="128.60052mm" viewBox="0 0 30.196594 128.60052" xmlns="http://www.w3.org/2000/svg"/>');
  try{const stdout=execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/Simple","--manifest-file",path.join(plugin,"plugin.json"),"--source-dir",plugin,"--output",output],{encoding:"utf8"}),report=JSON.parse(stdout),runtime=JSON.parse(fs.readFileSync(path.join(output,"runtime.json"),"utf8"));assert.equal(report.detected.panelWidth,90);assert.equal(runtime.width,90)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("wide Rack panel assets retain their full source width",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-wide-panel-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});fs.writeFileSync(path.join(plugin,"res","Simple.svg"),'<svg width="720px" height="380px" viewBox="0 0 720 380" xmlns="http://www.w3.org/2000/svg"/>');
  try{const stdout=execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/Simple","--manifest-file",path.join(plugin,"plugin.json"),"--source-dir",plugin,"--output",output],{encoding:"utf8"}),report=JSON.parse(stdout),runtime=JSON.parse(fs.readFileSync(path.join(output,"runtime.json"),"utf8"));assert.equal(report.detected.panelWidth,720);assert.equal(runtime.width,720)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("indirect SVG panel assets and snap parameters preserve exact Rack geometry",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-indirect-panel-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"IndirectPanel",name:"Indirect panel",description:"Indirect panel asset fixture",tags:["Utility"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);fs.writeFileSync(path.join(plugin,"res","IndirectPanel.svg"),'<svg width="480px" height="380px" viewBox="0 0 480 380" xmlns="http://www.w3.org/2000/svg"/>');fs.writeFileSync(path.join(plugin,"src","IndirectPanel.cpp"),'#include "plugin.hpp"\nstruct IndirectPanelModule : Module { enum ParamIds { VOICES_PARAM, NUM_PARAMS }; enum InputIds { NUM_INPUTS }; enum OutputIds { NUM_OUTPUTS }; enum LightIds { NUM_LIGHTS }; IndirectPanelModule(){ config(NUM_PARAMS,NUM_INPUTS,NUM_OUTPUTS,NUM_LIGHTS); configParam(VOICES_PARAM,1.f,8.f,4.f,"Active voices"); } }; struct IndirectPanelWidget : ModuleWidget { IndirectPanelWidget(IndirectPanelModule* module){ setModule(module); static constexpr auto panel = "res/IndirectPanel.svg"; setPanel(APP->window->loadSvg(asset::plugin(pluginInstance,panel))); addParam(createSnapParam<Rogan3PWhite>(Vec(156,42),module,IndirectPanelModule::VOICES_PARAM)); } }; Model* modelIndirectPanel=createModel<IndirectPanelModule,IndirectPanelWidget>("IndirectPanel");\n');
  try{const report=JSON.parse(execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/IndirectPanel","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output],{encoding:"utf8"})),runtime=JSON.parse(fs.readFileSync(path.join(output,"runtime.json"),"utf8"));assert.equal(report.detected.panelWidth,480);assert.equal(runtime.width,480);assert.deepEqual(runtime.params,[{id:0,name:"Active voices",min:1,max:8,default:4,snap:true,position:{x:156,y:42,widget:"Rogan3PWhite"}}])}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("std::size_t layout and globally qualified enum IDs expand static C string labels",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-size-t-loop-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"SizeTLoop",name:"size_t loop",description:"Qualified size_t loop fixture",tags:["Utility"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);fs.writeFileSync(path.join(plugin,"src","SizeTLoop.cpp"),'#include "plugin.hpp"\nstruct SizeTLoop : Module { enum Architecture { LANES = 3 }; enum ParamIds { ENUMS(GAIN_PARAM, LANES), NUM_PARAMS }; enum InputIds { ENUMS(SIGNAL_INPUT, LANES), NUM_INPUTS }; enum OutputIds { NUM_OUTPUTS }; enum LightIds { NUM_LIGHTS }; SizeTLoop(){ config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS); static constexpr const char* NAMES[LANES] = {"Red", "Green", "Blue"}; for(std::size_t lane=0;lane<SizeTLoop::LANES;++lane){ configParam(GAIN_PARAM+lane,0.f,1.f,.5f,std::string(NAMES[lane])+" Gain"); configInput(SIGNAL_INPUT+lane,NAMES[lane]); } } }; struct SizeTLoopWidget : ModuleWidget { SizeTLoopWidget(SizeTLoop* module){ for(std::size_t lane=0;lane<SizeTLoop::LANES;++lane){ addParam(createParam<Trimpot>(Vec(10,20+40*lane),module,::SizeTLoop::GAIN_PARAM+lane)); addInput(createInput<PJ301MPort>(Vec(30,20+40*lane),module,::SizeTLoop::SIGNAL_INPUT+lane)); } } }; Model* modelSizeTLoop=createModel<SizeTLoop,SizeTLoopWidget>("SizeTLoop");\n');
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/SizeTLoop","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output],{encoding:"utf8"});const runtime=JSON.parse(fs.readFileSync(path.join(output,"runtime.json"),"utf8"));assert.deepEqual(runtime.params.map(param=>param.name),["Red Gain","Green Gain","Blue Gain"]);assert.deepEqual(runtime.inputs.map(input=>input.name),["Red","Green","Blue"]);assert.deepEqual(runtime.params.map(param=>param.position),[{x:10,y:20,widget:"Trimpot"},{x:10,y:60,widget:"Trimpot"},{x:10,y:100,widget:"Trimpot"}]);assert.deepEqual(runtime.inputs.map(input=>input.position),[{x:30,y:20},{x:30,y:60},{x:30,y:100}])}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("Kilpatrick-style multimeters publish their live 16-channel display contract",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-multimeter-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"Multi_Meter",name:"Multi Meter",description:"Dynamic multimeter fixture",tags:["Visual"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);fs.writeFileSync(path.join(plugin,"src","Multi_Meter.cpp"),'#include "plugin.hpp"\nstruct Multi_Meter : Module { enum ParamIds { MODE_SW, CHAN_SW, PARAMS_LEN }; enum InputIds { IN_L, IN_R, MULTI_IN, INPUTS_LEN }; enum OutputIds { OUTPUTS_LEN }; enum LightIds { LIGHTS_LEN }; Multi_Meter(){ config(PARAMS_LEN, INPUTS_LEN, OUTPUTS_LEN, LIGHTS_LEN); configParam(MODE_SW,0,1,0,"Mode"); configParam(CHAN_SW,0,2,0,"Channels"); configInput(IN_L,"In L"); configInput(IN_R,"In R"); configInput(MULTI_IN,"Multi In"); } }; struct Multi_MeterDisplay {}; struct Multi_MeterWidget : ModuleWidget { Multi_MeterWidget(Multi_Meter* module){ addChild(new Multi_MeterDisplay); } }; Model* modelMultiMeter=createModel<Multi_Meter,Multi_MeterWidget>("Multi_Meter");\n');
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/Multi_Meter","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output],{encoding:"utf8"});const runtime=JSON.parse(fs.readFileSync(path.join(output,"runtime.json"),"utf8"));assert.deepEqual(runtime.runtime.visuals,[{kind:"multi-meter",inputs:[0,1,2],modeParam:0,channelsParam:1,x:29.173,y:39.862,width:271.654,height:248.031}])}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("Rack light and light-param constructors preserve exact widget geometry",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-light-layout-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"LightLayout",name:"Light layout",description:"Rack light geometry fixture",tags:["Visual"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);fs.writeFileSync(path.join(plugin,"src","LightLayout.cpp"),'#include "plugin.hpp"\nstruct LightLayoutModule : Module { enum ParamIds { LEVEL_PARAM, NUM_PARAMS }; enum InputIds { NUM_INPUTS }; enum OutputIds { NUM_OUTPUTS }; enum LightIds { STATE_LIGHTS, WHITE_LIGHT = STATE_LIGHTS + 2, NUM_LIGHTS }; LightLayoutModule() { config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS); configParam(LEVEL_PARAM, 0.f, 1.f, .5f, "Level"); lightInfos[STATE_LIGHTS]->description = "State"; } };\nstruct LightLayoutWidget : ModuleWidget { LightLayoutWidget(LightLayoutModule* module) { addChild(createLightCentered<MediumLight<GreenRedLight>>(Vec(45, 80), module, LightLayoutModule::STATE_LIGHTS)); addParam(createLightParamCentered<VCVLightLatch<MediumSimpleLight<WhiteLight>>>(Vec(60, 100), module, LightLayoutModule::LEVEL_PARAM, LightLayoutModule::WHITE_LIGHT)); } };\nModel* modelLightLayout = createModel<LightLayoutModule, LightLayoutWidget>("LightLayout");\n');
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/LightLayout","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"});const runtime=JSON.parse(fs.readFileSync(path.join(output,"runtime.json"),"utf8")),wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;assert.deepEqual(runtime.lightWidgets,[{id:0,widget:"MediumLight<GreenRedLight>",position:{x:45,y:80,centered:true}},{id:2,widget:"VCVLightLatch<MediumSimpleLight<WhiteLight>>",position:{x:60,y:100,centered:true},paramId:0}]);wasm._initialize();assert.equal(wasm.rack_web_light_count(),3)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("Rack 2.6 singular enums and ENUMS groups compile into a runnable adapter",()=>{
  const output=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-modern-scaffold-test-"));
  const stdout=execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/Modern","--manifest-file",path.join(source,"plugin.json"),"--source-dir",source,"--output",output,"--compile","--use-rust-analysis"],{encoding:"utf8",env:{...process.env,RACK_WEB_REQUIRE_RUST_CONFIG_CALLS:"1",RACK_WEB_REQUIRE_RUST_CONFIG_EXPANSION:"1",RACK_WEB_REQUIRE_RUST_INTEGER_EVAL:"1"}}),report=JSON.parse(stdout),runtime=JSON.parse(fs.readFileSync(path.join(output,"runtime.json"),"utf8"));
  assert.equal(report.assessment.compileEligible,true);assert.equal(report.detected.panelWidth,75);assert.deepEqual(report.detected.features,["custom-state","expanders","simd","rack-dsp","rack-app","json","bypass-routes"]);assert.deepEqual(report.detected.inheritance.secondaryBases,["FixtureMeterInterface"]);assert.equal(runtime.width,75);assert.deepEqual(runtime.params,[{id:0,name:"Rate",min:Math.fround(Math.log2(1e-3)),max:3,default:-3,snap:true}]);assert.equal(runtime.inputs.length,1);assert.equal(runtime.outputs.length,8);assert.equal(runtime.runtime.expanderMode,"message-buffer");assert.deepEqual(runtime.runtime.expander.models,[{key:"FixturePlugin/ExpanderOnly",symbol:"modelExpanderOnly",index:0}]);assert.equal(runtime.runtime.initialMemory,4194304);assert.deepEqual(runtime.bypassRoutes,[[0,0]]);assert.deepEqual(runtime.stateKeys,[{key:"multiplier",type:"integer"},{key:"enabled",type:"boolean"},{key:"offsets",type:"real",index:0},{key:"offsets",type:"real",index:1},{key:"offsets",type:"real",index:2},{key:"matrix",type:"real",path:[0,0]},{key:"matrix",type:"real",path:[0,1]},{key:"matrix",type:"real",path:[1,0]},{key:"matrix",type:"real",path:[1,1]}]);const adapter=fs.readFileSync(path.join(output,"adapter.cpp"),"utf8");assert.match(adapter,/using namespace rack::dsp;/);assert.match(adapter,/enum FixtureVoltageRange/);assert.ok(adapter.indexOf("inline float fixtureHeaderSaturate(float value);")<adapter.indexOf("struct FixtureDependentDsp"));assert.ok(adapter.indexOf("const float fixtureDependentTwo")<adapter.indexOf("static const float fixtureDependentScale[1][1][1]"));assert.ok(adapter.indexOf("static const float fixtureDependentScale[1][1][1]")<adapter.indexOf("static float fixtureDependentShape(float value) {"));assert.match(adapter,/#define RCFilter RackWebHostRCFilter/);assert.match(adapter,/auto localValue = begin\(localValues\)/);assert.match(adapter,/FixtureSupportOutput::FixtureSupportOutput\(\)/);assert.match(adapter,/FixtureSupportOutput::apply\(float value\)/);assert.match(adapter,/struct ModernModule : Module, FixtureMeterInterface/);assert.match(adapter,/ModernModule\(\)\s*\{/);assert.match(adapter,/configParam<EditableQuantity>\(RATE_PARAM/);assert.match(adapter,/const int configSwitch = 1/);assert.match(adapter,/rightExpander\.module/);assert.doesNotMatch(adapter,/nativeMeter\{/);assert.doesNotMatch(adapter,/plainMeter/);assert.doesNotMatch(adapter,/nativeLabel/);assert.doesNotMatch(adapter,/FixtureUnusedUiParameter/);assert.doesNotMatch(adapter,/widget\/FramebufferWidget\.hpp/);
  const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();assert.equal(wasm.rack_web_output_count(),8);assert.equal(wasm.rack_web_light_count(),1);wasm.rack_web_set_input_connected(0,1);wasm.rack_web_set_input_channels(0,1);wasm.rack_web_set_state(0,2);wasm.rack_web_set_state(2,1.25);wasm.rack_web_set_state(8,0.75);new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),128)[0]=2.5;wasm.rack_web_process(1,48000);const values=new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),8*16*128);for(let port=0;port<8;port++)assert.equal(values[port*128],7);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_light_buffer(),1)[0],0);
  wasm.rack_web_set_state(1,0);wasm.rack_web_process(1,48000);for(let port=0;port<8;port++)assert.equal(values[port*128],0);
  fs.rmSync(output,{recursive:true,force:true});
});

test("explicit static Rack port counts are not duplicated by enum aliases",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-explicit-count-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"ExplicitCount",name:"Explicit count",description:"Static input count fixture",tags:["Utility"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);
  fs.writeFileSync(path.join(plugin,"src","ExplicitCount.cpp"),'#include "plugin.hpp"\nstruct ExplicitCountModule : Module { enum ParamIds { NUM_PARAMS }; enum InputIds { SIGNAL_INPUT, INPUTS_LEN }; const static int NUM_INPUTS = 1; enum OutputIds { SIGNAL_OUTPUT, NUM_OUTPUTS }; enum LightIds { NUM_LIGHTS }; ExplicitCountModule() { config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS); } void process(const ProcessArgs&) override { outputs[SIGNAL_OUTPUT].setVoltage(inputs[SIGNAL_INPUT].getVoltage()); } }; struct ExplicitCountWidget : ModuleWidget {}; Model* modelExplicitCount = createModel<ExplicitCountModule, ExplicitCountWidget>("ExplicitCount");\n');
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/ExplicitCount","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"});const adapter=fs.readFileSync(path.join(output,"adapter.cpp"),"utf8");assert.equal((adapter.match(/\bNUM_INPUTS\s*=/g)??[]).length,1);const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();assert.equal(wasm.rack_web_input_count(),1)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("preprocessor Rack port counts are not duplicated by enum aliases",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-macro-count-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"MacroCount",name:"Macro count",description:"Preprocessor input count fixture",tags:["Utility"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);
  fs.writeFileSync(path.join(plugin,"src","MacroCount.cpp"),'#include "plugin.hpp"\n#define NUM_INPUT_ROWS 2\n#define NUM_INPUT_COLS 2\n#define NUM_INPUTS (NUM_INPUT_ROWS * NUM_INPUT_COLS)\nstruct MacroCountModule : Module { enum InputIds { SIGNAL_A_INPUT, SIGNAL_B_INPUT, SIGNAL_C_INPUT, SIGNAL_D_INPUT, INPUTS_LEN }; enum OutputIds { SIGNAL_OUTPUT, NUM_OUTPUTS }; MacroCountModule() { config(0, INPUTS_LEN, NUM_OUTPUTS, 0); } void process(const ProcessArgs&) override { outputs[SIGNAL_OUTPUT].setVoltage(inputs[SIGNAL_A_INPUT].getVoltage()); } }; struct MacroCountWidget : ModuleWidget {}; Model* modelMacroCount = createModel<MacroCountModule, MacroCountWidget>("MacroCount");\n');
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/MacroCount","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"});const adapter=fs.readFileSync(path.join(output,"adapter.cpp"),"utf8");assert.doesNotMatch(adapter,/static constexpr int NUM_INPUTS/);const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();assert.equal(wasm.rack_web_input_count(),4)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("global Rack count constants are not shadowed by generated class aliases",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-global-count-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"GlobalCount",name:"Global count",description:"Global DSP loop count fixture",tags:["Utility"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);
  fs.writeFileSync(path.join(plugin,"src","GlobalCount.cpp"),'#include "plugin.hpp"\nstatic const int NUM_OUTPUTS = 2;\nstatic const char* OUTPUT_LABELS[NUM_OUTPUTS] = {"Left", "Right"};\nstruct GlobalCountModule : Module { enum OutputIds { LEFT_OUTPUT, RIGHT_OUTPUT, AUX_1_OUTPUT, AUX_2_OUTPUT, OUTPUTS_LEN }; GlobalCountModule() { config(0, 0, OUTPUTS_LEN, 0); for (int index = 0; index < NUM_OUTPUTS; ++index) configOutput(index, OUTPUT_LABELS[index]); } void process(const ProcessArgs&) override { for (int index = 0; index < NUM_OUTPUTS; ++index) outputs[index].setVoltage(index + 1.f); } };\nstruct GlobalCountWidget : ModuleWidget {}; Model* modelGlobalCount = createModel<GlobalCountModule, GlobalCountWidget>("GlobalCount");\n');
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/GlobalCount","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"});const adapter=fs.readFileSync(path.join(output,"adapter.cpp"),"utf8");assert.equal((adapter.match(/\bNUM_OUTPUTS\s*=/g)??[]).length,1);assert.doesNotMatch(adapter,/static constexpr int NUM_OUTPUTS = OUTPUTS_LEN/);const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();assert.equal(wasm.rack_web_output_count(),4);wasm.rack_web_process(1,48000);const outputs=new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),4*16*128);assert.deepEqual([outputs[0],outputs[128],outputs[256],outputs[384]],[1,2,0,0])}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("native dynamic-library hosts are classified for a manual browser adapter",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-dynamic-host-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"DynamicHost",name:"Dynamic host",description:"Native driver fixture",tags:["External"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);
  fs.writeFileSync(path.join(plugin,"src","DynamicHost.cpp"),'#include "plugin.hpp"\nextern "C" void* dlopen(const char*, int);\nstruct DynamicHostModule : Module { enum InputIds { AUDIO_INPUT, NUM_INPUTS }; enum OutputIds { AUDIO_OUTPUT, NUM_OUTPUTS }; DynamicHostModule() { config(0, NUM_INPUTS, NUM_OUTPUTS, 0); } void process(const ProcessArgs&) override { if (dlopen("native-driver", 0)) outputs[AUDIO_OUTPUT].setVoltage(inputs[AUDIO_INPUT].getVoltage()); } };\nstruct DynamicHostWidget : ModuleWidget {}; Model* modelDynamicHost = createModel<DynamicHostModule, DynamicHostWidget>("DynamicHost");\n');
  try{const stdout=execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/DynamicHost","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output],{encoding:"utf8"}),report=JSON.parse(stdout);assert.equal(report.assessment.compileEligible,false);assert.equal(report.assessment.strategy,"manual-browser-adapter");assert.ok(report.detected.features.includes("dynamic-linking"));assert.deepEqual(report.assessment.blockers,[{kind:"host-feature",feature:"dynamic-linking"}]);assert.equal(report.runtimeDraft,null)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("json_array_set_new expands portable Rack state arrays",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-json-array-set-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"ArraySetState",name:"Array set state",description:"Indexed state array fixture",tags:["Utility"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);
  fs.writeFileSync(path.join(plugin,"src","ArraySetState.cpp"),'#include "plugin.hpp"\nstruct ArraySetStateModule : Module { enum OutputIds { SIGNAL_OUTPUT, NUM_OUTPUTS }; float value = 3.f; ArraySetStateModule() { config(0, 0, NUM_OUTPUTS, 0); } void process(const ProcessArgs&) override { outputs[SIGNAL_OUTPUT].setVoltage(value); } json_t* dataToJson() override { auto* root = json_object(); auto* values = json_array(); json_array_set_new(values, 0, json_real(value)); json_object_set_new(root, "values", values); return root; } void dataFromJson(json_t* root) override { auto* item = json_array_get(json_object_get(root, "values"), 0); if (json_is_number(item)) value = json_number_value(item); } };\nstruct ArraySetStateWidget : ModuleWidget {}; Model* modelArraySetState = createModel<ArraySetStateModule, ArraySetStateWidget>("ArraySetState");\n');
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/ArraySetState","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"});const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();const bytes=wasm.rack_web_snapshot_state_json(),snapshot=JSON.parse(new TextDecoder().decode(new Uint8Array(wasm.memory.buffer,wasm.rack_web_snapshot_state_buffer(),bytes)));assert.deepEqual(snapshot.values,[3]);const encoded=new TextEncoder().encode('{"values":[7]}'),pointer=wasm.rack_web_state_buffer(encoded.length);new Uint8Array(wasm.memory.buffer,pointer,encoded.length).set(encoded);assert.equal(wasm.rack_web_commit_state_json(encoded.length),1);wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],7)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("Rack modules can configure and address more than 256 parameters",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-large-param-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"LargeParams",name:"Large parameters",description:"Parameter capacity fixture",tags:["Utility"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);
  fs.writeFileSync(path.join(plugin,"src","LargeParams.cpp"),'#include "plugin.hpp"\nstruct LargeParamsModule : Module { static constexpr int NUM_PARAMS = 300; enum OutputIds { SIGNAL_OUTPUT, NUM_OUTPUTS }; LargeParamsModule() { config(NUM_PARAMS, 0, NUM_OUTPUTS, 0); for (int id = 0; id < NUM_PARAMS; ++id) configParam(id, -2.f, 2.f, id == 299 ? 1.f : 0.f, "Control"); configOutput(SIGNAL_OUTPUT, "Signal"); } void process(const ProcessArgs&) override { outputs[SIGNAL_OUTPUT].setVoltage(params[299].getValue()); } }; struct LargeParamsWidget : ModuleWidget {}; Model* modelLargeParams = createModel<LargeParamsModule, LargeParamsWidget>("LargeParams");\n');
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/LargeParams","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"});const runtime=JSON.parse(fs.readFileSync(path.join(output,"runtime.json"),"utf8")),wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;assert.equal(runtime.params.length,300);assert.deepEqual(runtime.params[299],{id:299,name:"Param 300",min:-2,max:2,default:1});wasm._initialize();assert.equal(wasm.rack_web_param_count(),300);assert.deepEqual([wasm.rack_web_get_param_min(299),wasm.rack_web_get_param_max(299),wasm.rack_web_get_param(299)],[-2,2,1]);wasm.rack_web_set_param(299,1.75);wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],1.75)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("directly included global port enums become a complete module ABI",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-global-enum-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"GlobalEnums",name:"Global enums",description:"Header-scoped legacy port identifiers",tags:["Utility"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);fs.writeFileSync(path.join(plugin,"src","GlobalEnums.hpp"),'#pragma once\nenum InputIds { LEFT_INPUT, RIGHT_INPUT, NUM_INPUTS };\nenum OutputIds { MIX_OUTPUT, NUM_OUTPUTS };\nenum LightIds { POSITIVE_LIGHT, NEGATIVE_LIGHT, NUM_LIGHTS };\n');fs.writeFileSync(path.join(plugin,"src","GlobalEnums.cpp"),'#include "plugin.hpp"\n#include "GlobalEnums.hpp"\nstruct GlobalEnumsModule : Module { GlobalEnumsModule() { config(0, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS); configInput(LEFT_INPUT, "Left"); configInput(RIGHT_INPUT, "Right"); configOutput(MIX_OUTPUT, "Mix"); } void process(const ProcessArgs&) override { float value = inputs[LEFT_INPUT].getVoltage() + inputs[RIGHT_INPUT].getVoltage(); outputs[MIX_OUTPUT].setVoltage(value); lights[value >= 0 ? POSITIVE_LIGHT : NEGATIVE_LIGHT].setBrightness(1); } };\nstruct GlobalEnumsWidget : ModuleWidget { GlobalEnumsWidget(GlobalEnumsModule* module) { const float xs[NUM_INPUTS] = {5, 35}; for (int index = 0; index < NUM_INPUTS; ++index) { addInput(createInput<PJ301MPort>(Vec(xs[index], 40), module, index)); } float outputPosition[1][2] = {{20, 90}}; addOutput(createOutput<PJ301MPort>(Vec(outputPosition[0][0], outputPosition[0][1]), module, MIX_OUTPUT)); } };\nModel* modelGlobalEnums = createModel<GlobalEnumsModule, GlobalEnumsWidget>("GlobalEnums");\n');
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/GlobalEnums","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"});const adapter=fs.readFileSync(path.join(output,"adapter.cpp"),"utf8"),runtime=JSON.parse(fs.readFileSync(path.join(output,"runtime.json"),"utf8")),wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;assert.match(adapter,/enum InputIds \{ LEFT_INPUT, RIGHT_INPUT, NUM_INPUTS \}/);assert.deepEqual([runtime.params.length,runtime.inputs.length,runtime.outputs.length,runtime.lights],[0,2,1,2]);assert.deepEqual(runtime.inputs.map(input=>input.position),[{x:5,y:40},{x:35,y:40}]);assert.deepEqual(runtime.outputs.map(output=>output.position),[{x:20,y:90}]);wasm._initialize();assert.deepEqual([wasm.rack_web_param_count(),wasm.rack_web_input_count(),wasm.rack_web_output_count(),wasm.rack_web_light_count()],[0,2,1,2]);wasm.rack_web_set_input_connected(0,1);wasm.rack_web_set_input_connected(1,1);wasm.rack_web_set_input_channels(0,1);wasm.rack_web_set_input_channels(1,1);const inputs=new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),2*128);inputs[0]=2;inputs[128]=3;wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],5)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("implicit port metadata uses enum names without inventing expander transport",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-implicit-port-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"ImplicitPorts",name:"Implicit ports",description:"Unnamed Rack ports with a shared plugin registry",tags:["Clock"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);fs.writeFileSync(path.join(plugin,"src","SharedRegistry.hpp"),'#pragma once\nextern Model* modelNeighborExpander;\n');fs.writeFileSync(path.join(plugin,"src","ImplicitPorts.cpp"),'#include "plugin.hpp"\n#include "SharedRegistry.hpp"\nstruct ImplicitPortsModule : Module { enum ParamIds { NUM_PARAMS }; enum InputIds { SWING_INPUT, CLOCK_INPUT, RESET_INPUT, RISECV1_INPUT, VOCT1_INPUT, IN_L_INPUT, NUM_INPUTS }; enum OutputIds { CLOCK_OUTPUT, PULSE1_OUTPUT, BP2_OUTPUT, OUT_R_OUTPUT, NUM_OUTPUTS }; enum LightIds { NUM_LIGHTS }; ImplicitPortsModule() { config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS); } }; struct ImplicitPortsWidget : ModuleWidget {}; Model* modelImplicitPorts = createModel<ImplicitPortsModule, ImplicitPortsWidget>("ImplicitPorts");\n');
  try{const stdout=execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/ImplicitPorts","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output],{encoding:"utf8"}),report=JSON.parse(stdout),runtime=JSON.parse(fs.readFileSync(path.join(output,"runtime.json"),"utf8"));assert.equal(report.detected.expander,null);assert.ok(!report.detected.features.includes("expanders"));assert.equal(runtime.runtime,undefined);assert.deepEqual(runtime.inputs,[{id:0,name:"Swing",kind:"cv"},{id:1,name:"Clock",kind:"gate"},{id:2,name:"Reset",kind:"gate"},{id:3,name:"Rise CV 1",kind:"cv"},{id:4,name:"V/Oct 1",kind:"cv"},{id:5,name:"Input L",kind:"audio"}]);assert.deepEqual(runtime.outputs,[{id:0,name:"Clock",kind:"gate"},{id:1,name:"Pulse 1",kind:"gate"},{id:2,name:"Bipolar 2",kind:"cv"},{id:3,name:"Output R",kind:"audio"}])}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("template-specialized Rack registrations preserve arguments and port counts",()=>{
  const output=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-template-scaffold-test-"));
  const stdout=execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/TemplateRoute","--manifest-file",path.join(source,"plugin.json"),"--source-dir",source,"--output",output,"--compile","--use-rust-analysis"],{encoding:"utf8",env:{...process.env,RACK_WEB_REQUIRE_RUST_CONFIG_CALLS:"1",RACK_WEB_REQUIRE_RUST_CONFIG_EXPANSION:"1",RACK_WEB_REQUIRE_RUST_CONSTANT_ANALYSIS:"1",RACK_WEB_REQUIRE_RUST_INTEGER_EVAL:"1",RACK_WEB_REQUIRE_RUST_PREPROCESS:"1",RACK_WEB_REQUIRE_RUST_STRING_EVAL:"1"}}),report=JSON.parse(stdout),runtime=JSON.parse(fs.readFileSync(path.join(output,"runtime.json"),"utf8"));
  assert.equal(report.source.moduleClass,"TemplateRoute<std::pair<int, int>, 1, 4>");assert.deepEqual(report.detected.template.constants,{INPUTS:1,OUTPUTS:4});assert.deepEqual(runtime.inputs.map(port=>port.name),["Input 1"]);assert.deepEqual(runtime.outputs.map(port=>port.name),["Output 1","Output 2","Output 3","Output 4"]);assert.match(fs.readFileSync(path.join(output,"adapter.cpp"),"utf8"),/using RackWebModule = TemplateRoute<std::pair<int, int>, 1, 4>/);
  const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();assert.equal(typeof wasm.rack_web_get_chain_neighbor_light_brightness,"function");assert.equal(typeof wasm.rack_web_get_neighbor_light_brightness,"function");wasm.rack_web_set_input_connected(0,1);wasm.rack_web_set_input_channels(0,1);new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),128)[0]=3.25;wasm.rack_web_process(1,48000);const values=new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),4*16*128);for(let port=0;port<4;port++)assert.equal(values[port*128],3.25);
  fs.rmSync(output,{recursive:true,force:true});
});

test("widget-scoped module aliases resolve to the namespaced DSP class",()=>{
  const output=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-scoped-alias-test-"));
  const stdout=execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/ScopedAlias","--manifest-file",path.join(source,"plugin.json"),"--source-dir",source,"--output",output,"--compile","--use-rust-analysis"],{encoding:"utf8"}),report=JSON.parse(stdout),runtime=JSON.parse(fs.readFileSync(path.join(output,"runtime.json"),"utf8"));
  assert.equal(report.source.moduleClass,"fixture::dsp::ScopedAlias");assert.equal(report.source.widgetClass,"fixture::ui::ScopedAliasWidget<fixture::dsp::ScopedAlias>");assert.deepEqual([runtime.params.length,runtime.inputs.length,runtime.outputs.length],[1,1,1]);assert.match(fs.readFileSync(path.join(output,"adapter.cpp"),"utf8"),/RACK_WEB_EXPORTS\(fixture::dsp::ScopedAlias\)/);
  const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();wasm.rack_web_set_input_connected(0,1);wasm.rack_web_set_input_channels(0,1);wasm.rack_web_set_param(0,1.5);new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),128)[0]=2;wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],3);
  fs.rmSync(output,{recursive:true,force:true});
});

test("function-style registrations and FXConfig specializations preserve the concrete effect contract",()=>{
  const output=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-function-fx-test-"));
  const stdout=execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/SurgeXTFXFixture","--manifest-file",path.join(source,"plugin.json"),"--source-dir",source,"--output",output],{encoding:"utf8"}),report=JSON.parse(stdout),runtime=JSON.parse(fs.readFileSync(path.join(output,"runtime.json"),"utf8"));
  assert.equal(report.source.moduleClass,"fixture::fx::FX<fxt_fixture>");assert.equal(report.source.widgetClass,"fixture::fxui::FXWidget<fxt_fixture>");assert.equal(report.detected.constants["FXConfig.numParams"],11);assert.equal(report.detected.constants["FXConfig.specificParamCount"],2);assert.deepEqual([runtime.params.length,runtime.inputs.length,runtime.outputs.length],[62,9,2]);assert.deepEqual(runtime.params.slice(0,3).map(({name})=>name),["Drive","Feedback","Tone"]);assert.equal(runtime.params[11].name,"Unused Effect Slot 1");assert.deepEqual(runtime.params.slice(-2).map(({name})=>name),["Enable Low Cut","Enable High Cut"]);
  fs.rmSync(output,{recursive:true,force:true});
});

test("Rust-derived FXConfig specialization executes in real WASM",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-rust-fx-specialization-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"RustFxSpecialization",name:"Rust FX specialization",description:"Rust out-of-line FXConfig specialization fixture",tags:["Effect"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);
  fs.writeFileSync(path.join(plugin,"src","RustFxSpecialization.cpp"),'#include "plugin.hpp"\nenum RustFxType { fxt_rust };\ntemplate<int fxType> struct FX;\ntemplate<int fxType> struct FXConfig { static float scale(); };\ntemplate<int fxType> struct FX : Module { enum InputIds { SIGNAL_INPUT, NUM_INPUTS }; enum OutputIds { SIGNAL_OUTPUT, NUM_OUTPUTS }; FX() { config(0, NUM_INPUTS, NUM_OUTPUTS, 0); configInput(SIGNAL_INPUT, "Signal"); configOutput(SIGNAL_OUTPUT, "Signal"); } void process(const ProcessArgs&) override { outputs[SIGNAL_OUTPUT].setVoltage(inputs[SIGNAL_INPUT].getVoltage() * FXConfig<fxType>::scale()); } };\ntemplate<> float FXConfig<fxt_rust>::scale() { return 2.f; }\ntemplate<int fxType> struct FXWidget : ModuleWidget {};\nModel* modelRustFxSpecialization = createModel<FX<fxt_rust>, FXWidget<fxt_rust>>("RustFxSpecialization");\n');
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/RustFxSpecialization","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"});const adapter=fs.readFileSync(path.join(output,"adapter.cpp"),"utf8"),wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;assert.equal([...adapter.matchAll(/FXConfig<fxt_rust>::scale\(\)\s*\{/g)].length,1);wasm._initialize();wasm.rack_web_set_input_connected(0,1);wasm.rack_web_set_input_channels(0,1);wasm.rack_web_set_output_connected(0,1);new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),128)[0]=3;wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],6)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("Rust-derived VCO specialization strips its Rack editor and executes in real WASM",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-rust-vco-specialization-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"RustVcoSpecialization",name:"Rust VCO specialization",description:"Rust out-of-line VCOConfig specialization fixture",tags:["Oscillator"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);
  fs.writeFileSync(path.join(plugin,"src","RustVcoSpecialization.cpp"),'#include "plugin.hpp"\nenum RustOscType { ot_rust };\ntemplate<int oscType> struct VCOConfig { static float scale(); };\ntemplate<int oscType> struct VCO : Module { enum InputIds { SIGNAL_INPUT, NUM_INPUTS }; enum OutputIds { SIGNAL_OUTPUT, NUM_OUTPUTS }; VCO() { config(0, NUM_INPUTS, NUM_OUTPUTS, 0); configInput(SIGNAL_INPUT, "Signal"); configOutput(SIGNAL_OUTPUT, "Signal"); guaranteeRackUserWavetablesDir(); } void guaranteeRackUserWavetablesDir() { desktopOnlyGuarantee(); } void process(const ProcessArgs&) override { outputs[SIGNAL_OUTPUT].setVoltage(inputs[SIGNAL_INPUT].getVoltage() * VCOConfig<oscType>::scale()); } };\ntemplate<> float VCOConfig<ot_rust>::scale() { return 2.f; }\ntemplate<> rack::Widget* VCOConfig<ot_rust>::createCustomEditorAt(int) { return APP->scene->rack; }\ntemplate<int oscType> struct VCOWidget : ModuleWidget {};\nModel* modelRustVcoSpecialization = createModel<VCO<ot_rust>, VCOWidget<ot_rust>>("RustVcoSpecialization");\n');
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/RustVcoSpecialization","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"});const adapter=fs.readFileSync(path.join(output,"adapter.cpp"),"utf8"),wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;assert.equal([...adapter.matchAll(/VCOConfig<ot_rust>::scale\(\)\s*\{/g)].length,1);assert.match(adapter,/void guaranteeRackUserWavetablesDir\(\) \{\s*\}/);assert.doesNotMatch(adapter,/createCustomEditorAt|APP->scene|desktopOnlyGuarantee/);wasm._initialize();wasm.rack_web_set_input_connected(0,1);wasm.rack_web_set_input_channels(0,1);wasm.rack_web_set_output_connected(0,1);new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),128)[0]=4;wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],8)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("locked submodule checkout resumes a matching interrupted staging clone",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-resume-submodule-test-")),plugin=path.join(temporary,"plugin"),helper=path.join(temporary,"helper-origin"),output=path.join(temporary,"output"),gitEnvironment={...process.env,GIT_AUTHOR_NAME:"Rack Web",GIT_AUTHOR_EMAIL:"rack-web@example.invalid",GIT_COMMITTER_NAME:"Rack Web",GIT_COMMITTER_EMAIL:"rack-web@example.invalid"},git=(directory,...parameters)=>execFileSync("git",["-C",directory,...parameters],{encoding:"utf8",env:gitEnvironment,stdio:["ignore","pipe","pipe"]}).trim();
  fs.cpSync(source,plugin,{recursive:true});fs.mkdirSync(helper,{recursive:true});git(helper,"init");fs.writeFileSync(path.join(helper,"helper.hpp"),"#pragma once\nstruct ExternalGain { ExternalGain(); float apply(float value) const; private: float factor; };\n");fs.writeFileSync(path.join(helper,"helper.cpp"),'#include "helper.hpp"\nExternalGain::ExternalGain() : factor(3.f) {}\nfloat ExternalGain::apply(float value) const { return value * factor; }\n');git(helper,"add","helper.hpp","helper.cpp");git(helper,"commit","-m","fixture helper");const commit=git(helper,"rev-parse","HEAD");
  const simpleHeader=path.join(plugin,"src","Simple.hpp"),simpleSource=fs.readFileSync(simpleHeader,"utf8").replace('#include "plugin.hpp"','#include "plugin.hpp"\n#include "helper.hpp"').replace("struct FixtureModule : Module {","struct FixtureModule : Module {\n  ExternalGain externalGain;").replace("inputs[SIGNAL_INPUT].getVoltage() * params[LEVEL_PARAM].getValue()","externalGain.apply(inputs[SIGNAL_INPUT].getVoltage() * params[LEVEL_PARAM].getValue())");fs.writeFileSync(simpleHeader,simpleSource);
  git(plugin,"init");const vendored=path.join(plugin,"dep","Vendored");fs.mkdirSync(vendored,{recursive:true});fs.writeFileSync(path.join(vendored,"marker.hpp"),"#pragma once\n");fs.writeFileSync(path.join(plugin,".gitmodules"),'[submodule "libs/helper"]\n  path = libs/helper\n  url = https://github.com/example/helper.git\n[submodule "dep/Vendored"]\n  path = dep/Vendored\n  url = https://github.com/example/vendored.git\n');git(plugin,"add",".");git(plugin,"update-index","--add","--cacheinfo",`160000,${commit},libs/helper`);git(plugin,"commit","-m","fixture plugin");
  fs.mkdirSync(path.join(plugin,"libs"),{recursive:true});const staging=path.join(plugin,"libs","helper.building-recovered");execFileSync("git",["clone",helper,staging],{env:gitEnvironment,stdio:"ignore"});git(staging,"remote","set-url","origin","https://github.com/example/helper.git");
  const stdout=execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/Simple","--manifest-file",path.join(plugin,"plugin.json"),"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"});assert.equal(JSON.parse(stdout).key,"FixturePlugin/Simple");assert.equal(git(path.join(plugin,"libs","helper"),"rev-parse","HEAD"),commit);assert.equal(fs.existsSync(staging),false);assert.equal(fs.readFileSync(path.join(vendored,"marker.hpp"),"utf8"),"#pragma once\n");const adapter=fs.readFileSync(path.join(output,"adapter.cpp"),"utf8");assert.match(adapter,/#include "helper\.hpp"/);assert.doesNotMatch(adapter,/struct ExternalGain/);const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();wasm.rack_web_set_input_connected(0,1);wasm.rack_web_set_input_channels(0,1);new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),128)[0]=2;wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],6);
  fs.rmSync(temporary,{recursive:true,force:true});
});

test("macro-configured shared module headers compile as their concrete Library model",()=>{
  const output=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-macro-scaffold-test-"));
  const stdout=execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/MacroSwitch","--manifest-file",path.join(source,"plugin.json"),"--source-dir",source,"--output",output,"--compile","--use-rust-analysis"],{encoding:"utf8",env:{...process.env,RACK_WEB_REQUIRE_RUST_CONFIG_CALLS:"1",RACK_WEB_REQUIRE_RUST_CONFIG_EXPANSION:"1",RACK_WEB_REQUIRE_RUST_DECLARATIONS:"1",RACK_WEB_REQUIRE_RUST_PREPROCESS:"1"}}),report=JSON.parse(stdout),runtime=JSON.parse(fs.readFileSync(path.join(output,"runtime.json"),"utf8")),adapter=fs.readFileSync(path.join(output,"adapter.cpp"),"utf8");
  assert.equal(report.source.moduleClass,"MacroSwitch");assert.equal(report.source.file,"src/MacroSwitchSrc.hpp");assert.deepEqual([runtime.params.length,runtime.inputs.length,runtime.outputs.length,runtime.lights],[1,2,1,2]);assert.deepEqual(runtime.stateKeys,[{key:"selected",type:"integer"}]);assert.match(adapter,/\/\/ FIXTURE_SELECTED_MEMBER must remain a comment/);assert.doesNotMatch(adapter,/Vec|nativeWidgetPosition|STRUCT_NAME|ROUTE_TO_ONE|FixtureCenteredLabel/);
  const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();wasm.rack_web_set_input_connected(0,1);wasm.rack_web_set_input_connected(1,1);wasm.rack_web_set_input_channels(0,1);wasm.rack_web_set_input_channels(1,1);const inputs=new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),2*16*128),outputs=new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128);inputs[0]=2;inputs[128]=7;wasm.rack_web_set_param(0,1);wasm.rack_web_process(1,48000);assert.equal(outputs[0],7);assert.deepEqual([...new Float32Array(wasm.memory.buffer,wasm.rack_web_light_buffer(),2)],[0,1]);
  fs.rmSync(output,{recursive:true,force:true});
});

test("mixed host helpers keep DSP state while desktop-only methods are stubbed",()=>{
  const output=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-host-helper-test-"));
  const stdout=execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/HostMixed","--manifest-file",path.join(source,"plugin.json"),"--source-dir",source,"--output",output,"--compile"],{encoding:"utf8"}),report=JSON.parse(stdout),runtime=JSON.parse(fs.readFileSync(path.join(output,"runtime.json"),"utf8")),adapter=fs.readFileSync(path.join(output,"adapter.cpp"),"utf8");
  assert.equal(report.assessment.compileEligible,true);assert.deepEqual(report.detected.stateKeys,[]);assert.ok(!report.assessment.blockers.some(blocker=>blocker.kind==="state-schema"));assert.deepEqual(runtime.params,[{id:0,name:"Ratio",min:-3,max:9,default:2},{id:1,name:"Extra 1",min:0,max:1,default:0},{id:2,name:"Extra 2",min:0,max:1,default:0}]);assert.equal(runtime.inputs[0].name,"Track A");assert.match(adapter,/struct HostRegistry/);assert.match(adapter,/bool validateHost\(\)\{ return \{\}; \}/);assert.match(adapter,/HostRegistry hostRegistry/);assert.match(adapter,/const int HostRegistry::pattern\[2\] = \{1, 2\}/);assert.match(adapter,/float hostDefaultValue = 4\.f/);assert.match(adapter,/APP->window->getMods\(\)/);assert.doesNotMatch(adapter,/HostResetMenuItem|HostUiBase|HostUiDerived|createHostMenu|SvgPanel|event::Action|APP->scene/);
  const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();assert.equal(wasm.rack_web_get_param_min(0),-3);assert.equal(wasm.rack_web_get_param_max(0),9);wasm.rack_web_set_input_connected(0,1);wasm.rack_web_set_input_channels(0,1);new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),128)[0]=3;wasm.rack_web_process(1,48000);const outputBuffer=new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128);assert.equal(outputBuffer[0],12);const json=new TextEncoder().encode('{"bank":{"name":"音序","slots":[null,{"voltage":2.25}]}}'),pointer=wasm.rack_web_state_buffer(json.length);new Uint8Array(wasm.memory.buffer,pointer,json.length).set(json);assert.equal(wasm.rack_web_commit_state_json(json.length),1);wasm.rack_web_process(1,48000);assert.equal(outputBuffer[0],14.25);const invalid=new TextEncoder().encode('{"bank":');new Uint8Array(wasm.memory.buffer,wasm.rack_web_state_buffer(invalid.length),invalid.length).set(invalid);assert.equal(wasm.rack_web_commit_state_json(invalid.length),0);
  const snapshotLength=wasm.rack_web_snapshot_state_json(),snapshotPointer=wasm.rack_web_snapshot_state_buffer(),snapshot=JSON.parse(new TextDecoder().decode(new Uint8Array(wasm.memory.buffer,snapshotPointer,snapshotLength)));assert.deepEqual(snapshot,{"bank-2":2.25});
  fs.rmSync(output,{recursive:true,force:true});
});

test("Rust-derived custom Model lambda registration executes in real WASM",()=>{
  const output=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-custom-model-test-"));
  try{
    const stdout=execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/CustomFactory","--manifest-file",path.join(source,"plugin.json"),"--source-dir",source,"--output",output,"--compile"],{encoding:"utf8"}),report=JSON.parse(stdout),runtime=JSON.parse(fs.readFileSync(path.join(output,"runtime.json"),"utf8"));
    assert.equal(report.source.moduleClass,"CustomFactoryDsp");
    assert.equal(report.source.widgetClass,"CustomFactoryWidget");
    assert.deepEqual(runtime.params,[{id:0,name:"Offset",min:-5,max:5,default:1}]);
    const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;
    wasm._initialize();
    wasm.rack_web_set_input_connected(0,1);
    wasm.rack_web_set_input_channels(0,1);
    new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),128)[0]=3;
    wasm.rack_web_set_param(0,5);
    wasm.rack_web_process(1,48000);
    assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],8);
  }finally{fs.rmSync(output,{recursive:true,force:true})}
});

test("classic modules without a LightIds enum synthesize a zero-light ABI",()=>{
  const output=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-no-lights-test-"));
  const stdout=execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/NoLights","--manifest-file",path.join(source,"plugin.json"),"--source-dir",source,"--output",output,"--compile"],{encoding:"utf8"}),report=JSON.parse(stdout);
  assert.equal(report.assessment.compileEligible,true);assert.equal(report.detected.counts.lights,0);assert.equal(report.runtimeDraft.lights,0);assert.equal(report.runtimeDraft.params[0].default,1.25);const adapter=fs.readFileSync(path.join(output,"adapter.cpp"),"utf8");assert.match(adapter,/static constexpr int NUM_LIGHTS = 0/);assert.doesNotMatch(adapter,/UiUmbrella\.hpp/);assert.match(adapter,/const float NamespacedGain::bias = 0\.f/);assert.match(adapter,/float helperLeaf\(float value\)/);assert.match(adapter,/float helperBridge\(float value\)/);assert.match(adapter,/namespace fixture \{\s*NamespacedGain::NamespacedGain\(float scale\) : _scale\(scale\)/s);assert.match(adapter,/float NamespacedGain::apply\(float value\) const/s);assert.match(adapter,/template<int Scale> float NamespacedTemplateGain<Scale>::apply/);
  const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();assert.equal(wasm.rack_web_light_count(),0);assert.equal(typeof wasm.rack_web_get_chain_neighbor_light_brightness,"function");assert.equal(typeof wasm.rack_web_get_neighbor_light_brightness,"function");wasm.rack_web_set_input_connected(0,1);wasm.rack_web_set_input_channels(0,1);wasm.rack_web_set_param(0,1.5);new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),128)[0]=2;wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],6);
  fs.rmSync(output,{recursive:true,force:true});
});

test("DSP helpers before the module class are isolated without widget code",()=>{
  const output=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-prelude-test-"));
  const stdout=execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/Prelude","--manifest-file",path.join(source,"plugin.json"),"--source-dir",source,"--output",output,"--compile"],{encoding:"utf8"}),report=JSON.parse(stdout),adapter=fs.readFileSync(path.join(output,"adapter.cpp"),"utf8");
  assert.equal(report.detected.prelude,true);assert.match(adapter,/T preludeScale\(T value\)/);assert.doesNotMatch(adapter,/nativeUiOnly|PreludeWidget/);
  const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();wasm.rack_web_set_input_connected(0,1);wasm.rack_web_set_input_channels(0,1);new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),128)[0]=4;wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],6);
  fs.rmSync(output,{recursive:true,force:true});
});

test("widget-only window and asset APIs do not block an otherwise portable DSP class",()=>{
  const output=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-widget-assets-test-"));
  const stdout=execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/WidgetAssets","--manifest-file",path.join(source,"plugin.json"),"--source-dir",source,"--output",output,"--compile"],{encoding:"utf8"}),report=JSON.parse(stdout),adapter=fs.readFileSync(path.join(output,"adapter.cpp"),"utf8");
  assert.equal(report.assessment.compileEligible,true);assert.deepEqual(report.assessment.blockers,[]);assert.deepEqual(report.detected.features,["rack-app","sample-rate-event"]);assert.doesNotMatch(adapter,/FixtureDisplay|WidgetAssetsWidget|loadFont|asset::/);
  const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();wasm.rack_web_set_input_connected(0,1);wasm.rack_web_set_input_channels(0,1);const inputs=new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),128),outputs=new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128);inputs[0]=3;wasm.rack_web_process(1,96000);assert.equal(outputs[0],6);
  fs.rmSync(output,{recursive:true,force:true});
});

test("widget sibling pointers stay out of DSP while object macros size Rack ports",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-widget-sibling-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"WidgetSibling",name:"Widget sibling",description:"Macro-sized DSP with a native widget back-pointer",tags:["Utility"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);fs.writeFileSync(path.join(plugin,"src","WidgetSibling.cpp"),'#include "plugin.hpp"\n#define VALUE_COUNT 4\nstruct WidgetSiblingWidget;\nstruct WidgetSiblingModule : Module { enum ParamIds { NUM_PARAMS }; enum InputIds { ENUMS(VALUE_INPUT, VALUE_COUNT), NUM_INPUTS }; enum OutputIds { ENUMS(VALUE_OUTPUT, VALUE_COUNT), NUM_OUTPUTS }; enum LightIds { NUM_LIGHTS }; WidgetSiblingWidget* widget = nullptr; WidgetSiblingModule() { config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS); } void process(const ProcessArgs&) override { for (int index = 0; index < VALUE_COUNT; ++index) outputs[VALUE_OUTPUT + index].setVoltage(inputs[VALUE_INPUT + index].getVoltage()); } };\nstruct LabelDisplay : LedDisplay {};\nstruct WidgetSiblingWidget : ModuleWidget { LabelDisplay* labels[VALUE_COUNT]; WidgetSiblingWidget(WidgetSiblingModule* module) { setModule(module); box.size = Vec(60, 380); float y = 40; for (int index = 0; index < VALUE_COUNT; ++index) { addInput(createInput<PJ301MPort>(Vec(5, y), module, WidgetSiblingModule::VALUE_INPUT + index)); addOutput(createOutput<PJ301MPort>(Vec(35, y), module, WidgetSiblingModule::VALUE_OUTPUT + index)); y += 70; } } };\nModel* modelWidgetSibling = createModel<WidgetSiblingModule, WidgetSiblingWidget>("WidgetSibling");\n');
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/WidgetSibling","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"});const adapter=fs.readFileSync(path.join(output,"adapter.cpp"),"utf8"),runtime=JSON.parse(fs.readFileSync(path.join(output,"runtime.json"),"utf8")),wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;assert.doesNotMatch(adapter,/ModuleWidget|LabelDisplay/);assert.deepEqual([runtime.inputs.length,runtime.outputs.length],[4,4]);assert.deepEqual(runtime.inputs.map(input=>input.name),["Value 1","Value 2","Value 3","Value 4"]);assert.deepEqual(runtime.outputs.map(output=>output.name),["Value 1","Value 2","Value 3","Value 4"]);assert.deepEqual(runtime.inputs.map(input=>input.position?.y),[40,110,180,250]);assert.deepEqual(runtime.outputs.map(output=>output.position?.y),[40,110,180,250]);wasm._initialize();assert.deepEqual([wasm.rack_web_input_count(),wasm.rack_web_output_count()],[4,4]);wasm.rack_web_set_input_connected(3,1);wasm.rack_web_set_input_channels(3,1);new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),4*128)[3*128]=7;wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),4*128)[3*128],7)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("portable JSON state methods survive optional native widget branches",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-widget-state-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"WidgetState",name:"Widget state",description:"Portable state with optional native labels",tags:["Utility"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);fs.writeFileSync(path.join(plugin,"src","WidgetState.cpp"),'#include "plugin.hpp"\n#define VALUE_COUNT 4\nstruct WidgetStateWidget;\nstruct WidgetStateModule : Module { enum ParamIds { NUM_PARAMS }; enum InputIds { NUM_INPUTS }; enum OutputIds { ENUMS(VALUE_OUTPUT, VALUE_COUNT), NUM_OUTPUTS }; enum LightIds { NUM_LIGHTS }; float values[VALUE_COUNT]{}; WidgetStateWidget* widget = nullptr; WidgetStateModule() { config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS); } void process(const ProcessArgs&) override { for (int index = 0; index < VALUE_COUNT; ++index) outputs[VALUE_OUTPUT + index].setVoltage(values[index]); } json_t* dataToJson() override; void dataFromJson(json_t* root) override; };\nstruct LabelDisplay : LedDisplay {};\nstruct WidgetStateWidget : ModuleWidget { LabelDisplay* labels[VALUE_COUNT]; WidgetStateWidget(WidgetStateModule* module) { setModule(module); box.size = Vec(60, 380); } };\njson_t* WidgetStateModule::dataToJson() { auto* root = json_object(); auto* items = json_array(); auto* labels = json_array(); WidgetStateWidget* localWidget; if (localWidget) { json_array_append_new(labels, json_string("local-native")); } for (int index = 0; index < VALUE_COUNT; ++index) { json_array_append_new(items, json_real(values[index])); if (widget) { json_array_append_new(labels, json_string("native")); } } json_object_set_new(root, "values", items); json_object_set_new(root, "labels", labels); return root; }\nvoid WidgetStateModule::dataFromJson(json_t* root) { auto* items = json_object_get(root, "values"); for (int index = 0; index < VALUE_COUNT; ++index) { if (auto* item = json_array_get(items, index)) values[index] = json_number_value(item); } auto* labels = json_object_get(root, "labels"); if (labels && widget) { widget->box.size.x = 60; } }\nModel* modelWidgetState = createModel<WidgetStateModule, WidgetStateWidget>("WidgetState");\n');
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/WidgetState","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"});const adapter=fs.readFileSync(path.join(output,"adapter.cpp"),"utf8"),wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;assert.match(adapter,/WidgetStateModule::dataToJson/);assert.match(adapter,/json_array_append_new\(items, json_real/);assert.doesNotMatch(adapter,/ModuleWidget|LabelDisplay|\bwidget\b|localWidget/);wasm._initialize();const encoded=new TextEncoder().encode('{"values":[1,2,3,4],"labels":["ignored"]}'),pointer=wasm.rack_web_state_buffer(encoded.length);new Uint8Array(wasm.memory.buffer,pointer,encoded.length).set(encoded);assert.equal(wasm.rack_web_commit_state_json(encoded.length),1);wasm.rack_web_process(1,48000);assert.deepEqual([...new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),4*128).filter((_,index)=>index%128===0)],[1,2,3,4]);const bytes=wasm.rack_web_snapshot_state_json(),snapshot=JSON.parse(new TextDecoder().decode(new Uint8Array(wasm.memory.buffer,wasm.rack_web_snapshot_state_buffer(),bytes)));assert.deepEqual(snapshot.values,[1,2,3,4])}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("template DMA module families retain their complete ordered header",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-dma-header-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"DirectHeaderDMA",name:"Direct header DMA",description:"Template DMA dependency order",tags:["Utility"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);fs.writeFileSync(path.join(plugin,"src","plugin.hpp"),'#pragma once\n#include "rack.hpp"\nusing namespace rack;\n');fs.writeFileSync(path.join(plugin,"src","Utility.hpp"),'#pragma once\nnamespace fixture_dma { inline float helperVoltage() { return 7.f; } }\n');fs.writeFileSync(path.join(plugin,"src","DMA.hpp"),'#pragma once\n#include "plugin.hpp"\n#include "Utility.hpp"\nnamespace fixture_dma {\ntemplate <typename TFirst, typename... TRest> struct FirstParameter { using type = TFirst; };\ntemplate <typename T> struct DMAWriteEvent;\ntemplate <typename T> struct DMAChannel { class accessor { DMAChannel* channel; public: operator T() const { return channel->read(0); } }; virtual T read(size_t) const { return T{}; } };\ntemplate <typename T> struct DMAWriteEvent { DMAChannel<T>* channel; };\ntemplate <typename T> struct DMAClient { virtual bool readyForDMA() const { return true; } };\ntemplate <typename... T> struct DMAHostModule : Module, DMAClient<T>... {};\n}\n');fs.writeFileSync(path.join(plugin,"src","DirectHeaderDMA.cpp"),'#include "plugin.hpp"\n#include "DMA.hpp"\nusing namespace fixture_dma;\nstruct DirectHeaderDMA : DMAHostModule<float> { enum OutputIds { VALUE_OUTPUT, NUM_OUTPUTS }; DirectHeaderDMA() { config(0, 0, NUM_OUTPUTS, 0); configOutput(VALUE_OUTPUT, "Value"); } void process(const ProcessArgs&) override { outputs[VALUE_OUTPUT].setVoltage(helperVoltage()); } };\nstruct DirectHeaderDMAWidget : ModuleWidget { DirectHeaderDMAWidget(DirectHeaderDMA* module) { setModule(module); box.size = Vec(75, 380); addOutput(createOutput<PJ301MPort>(Vec(25, 100), module, DirectHeaderDMA::VALUE_OUTPUT)); } }; Model* modelDirectHeaderDMA = createModel<DirectHeaderDMA, DirectHeaderDMAWidget>("DirectHeaderDMA");\n');
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/DirectHeaderDMA","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"});const adapter=fs.readFileSync(path.join(output,"adapter.cpp"),"utf8"),wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;assert.match(adapter,/#include "DMA\.hpp"/);assert.equal((adapter.match(/struct DMAChannel/g)??[]).length,0);wasm._initialize();wasm.rack_web_set_output_connected(0,1);wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],7)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("zero-I/O visual modules use config() counts and preserve Rack color helpers",()=>{
  const output=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-visual-only-test-"));
  const stdout=execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/VisualOnly","--manifest-file",path.join(source,"plugin.json"),"--source-dir",source,"--output",output,"--compile"],{encoding:"utf8"}),report=JSON.parse(stdout),runtime=JSON.parse(fs.readFileSync(path.join(output,"runtime.json"),"utf8")),adapter=fs.readFileSync(path.join(output,"adapter.cpp"),"utf8");
  assert.equal(report.assessment.compileEligible,true);assert.deepEqual(report.detected.counts,{params:0,inputs:0,outputs:0,lights:2});assert.deepEqual(report.detected.stateKeys,[]);assert.equal(runtime.params.length,0);assert.equal(runtime.inputs.length,0);assert.equal(runtime.outputs.length,0);assert.equal(runtime.lights,2);assert.match(adapter,/static constexpr int NUM_PARAMS = 0/);assert.match(adapter,/static constexpr int NUM_LIGHTS = 2/);
  const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();assert.equal(wasm.rack_web_param_count(),0);assert.equal(wasm.rack_web_input_count(),0);assert.equal(wasm.rack_web_output_count(),0);assert.equal(wasm.rack_web_light_count(),2);wasm.rack_web_process(32,48000);assert.deepEqual([...new Float32Array(wasm.memory.buffer,wasm.rack_web_light_buffer(),2)],[0,0]);
  fs.rmSync(output,{recursive:true,force:true});
});

test("JSON arrays of objects map to mixed array/object state paths",()=>{
  const output=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-object-state-test-"));
  const stdout=execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/ObjectState","--manifest-file",path.join(source,"plugin.json"),"--source-dir",source,"--output",output,"--compile"],{encoding:"utf8"}),report=JSON.parse(stdout);
  assert.deepEqual(report.detected.stateKeys,[{path:[0,"key"],key:"slots",type:"integer"},{path:[0,"high"],key:"slots",type:"boolean"},{path:[1,"key"],key:"slots",type:"integer"},{path:[1,"high"],key:"slots",type:"boolean"}]);
  const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();wasm.rack_web_set_state(0,7);wasm.rack_web_set_state(1,1);wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],7);
  fs.rmSync(output,{recursive:true,force:true});
});

test("finite JSON string modes map to numeric ABI state and back",()=>{
  const output=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-string-state-test-"));
  const stdout=execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/StringState","--manifest-file",path.join(source,"plugin.json"),"--source-dir",source,"--output",output,"--compile"],{encoding:"utf8"}),report=JSON.parse(stdout),runtime=JSON.parse(fs.readFileSync(path.join(output,"runtime.json"),"utf8")),adapter=fs.readFileSync(path.join(output,"adapter.cpp"),"utf8");
  assert.equal(report.assessment.compileEligible,true);assert.deepEqual(runtime.stateKeys,[{key:"mode",type:"string-enum",values:["pitched","linear"]}]);assert.match(adapter,/json_string\(value < 0\.5f \? "pitched" : "linear"\)/);
  const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();wasm.rack_web_set_input_connected(0,1);wasm.rack_web_set_input_channels(0,1);new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),128)[0]=3;wasm.rack_web_set_state(0,0);wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],6);wasm.rack_web_set_state(0,1);wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],3);
  fs.rmSync(output,{recursive:true,force:true});
});

test("Rack 1 toJson and fromJson callbacks bridge the browser state ABI",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-legacy-json-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"LegacyJson",name:"Legacy JSON",description:"Rack 1 state callback fixture",tags:["Utility"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);fs.writeFileSync(path.join(plugin,"src","LegacyJson.cpp"),'#include "plugin.hpp"\nstruct LegacyJsonModule : Module { enum ParamIds { NUM_PARAMS }; enum InputIds { NUM_INPUTS }; enum OutputIds { VALUE_OUTPUT, NUM_OUTPUTS }; enum LightIds { NUM_LIGHTS }; int saved = 3; LegacyJsonModule() { config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS); } json_t* toJson() override { json_t* root = Module::toJson(); json_object_set(root, "legacy", json_integer(saved)); return root; } void fromJson(json_t* root) override { Module::fromJson(root); if (json_t* value = json_object_get(root, "legacy")) saved = json_integer_value(value); } void process(const ProcessArgs&) override { outputs[VALUE_OUTPUT].setVoltage(saved); } }; struct LegacyJsonWidget : ModuleWidget {}; Model* modelLegacyJson = createModel<LegacyJsonModule, LegacyJsonWidget>("LegacyJson");\n');
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/LegacyJson","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"});const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();const encoded=new TextEncoder().encode('{"legacy":9}'),pointer=wasm.rack_web_state_buffer(encoded.length);new Uint8Array(wasm.memory.buffer,pointer,encoded.length).set(encoded);assert.equal(wasm.rack_web_commit_state_json(encoded.length),1);wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],9);const bytes=wasm.rack_web_snapshot_state_json(),snapshot=new TextDecoder().decode(new Uint8Array(wasm.memory.buffer,wasm.rack_web_snapshot_state_buffer(),bytes));assert.equal(JSON.parse(snapshot).legacy,9)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("AudioFile tape modules replace desktop paths with the browser asset ABI",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-audiofile-tape-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"AudioFileTape",name:"AudioFile tape",description:"Browser-backed multitrack tape fixture",tags:["Sampler"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);
  fs.writeFileSync(path.join(plugin,"src","AudioFileTape.cpp"),'#include "plugin.hpp"\n#include <algorithm>\n#include <cstdint>\n#include <string>\n#include <vector>\nstruct TapeLength { int value; const char* name; };\ntemplate <typename T> struct AudioFile { std::vector<std::vector<T>> samples{{}}; int rate = 44100; void setNumSamplesPerChannel(int frames) { for (auto& channel : samples) channel.resize(frames); } void setNumChannels(int channels) { const int frames = samples.empty() ? 0 : samples[0].size(); samples.resize(channels); for (auto& channel : samples) channel.resize(frames); } void setAudioBufferSize(int channels, int frames) { setNumSamplesPerChannel(frames); setNumChannels(channels); } void setSampleRate(uint32_t next) { rate = next; } int getNumSamplesPerChannel() const { return samples.empty() ? 0 : samples[0].size(); } int getNumChannels() const { return samples.size(); } bool load(std::string) { return false; } bool save(std::string, int) { return false; } void setBitDepth(int) {} };\nstruct AudioFileTapeModule : Module { inline static constexpr TapeLength TAPE_LENGTHS[] = {{48000, "short"}, {96000, "long"}}; static constexpr int NUM_TAPE_LENGTHS = 2; static constexpr int NUM_MAX_TRACKS = 4; enum ParamIds { PLAY_PARAM, NUM_PARAMS }; enum InputIds { AUDIO_INPUT, NUM_INPUTS }; enum OutputIds { AUDIO_OUTPUT, NUM_OUTPUTS }; enum LightIds { NUM_LIGHTS }; enum InitTape { INIT_TAPE_NOOP, INIT_TAPE_COMPLETE, INIT_TAPE_TRACK_COUNT, INIT_TAPE_LENGTH, INIT_TAPE_ERASE }; AudioFile<float> audioFile; int sizeAudioBuffer = 0; int trackCountParam = 1; int tapeLengthParam = 0; double audioBufferPosition = 0; std::string audioFilePath; bool playStatus = true; AudioFileTapeModule(); void initTape(InitTape); void calcAudio(int, float); void process(const ProcessArgs&) override; void onSave(const SaveEvent&) override; std::string getAudioFileDir(); void saveAudioFile(std::string); void loadAudioFile(std::string); };\nAudioFileTapeModule::AudioFileTapeModule() { config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS); configButton(PLAY_PARAM, "Play"); configInput(AUDIO_INPUT, "Audio"); configOutput(AUDIO_OUTPUT, "Audio"); audioFile.setAudioBufferSize(1, TAPE_LENGTHS[0].value); sizeAudioBuffer = audioFile.getNumSamplesPerChannel(); }\nvoid AudioFileTapeModule::initTape(InitTape what) { bool loaded = false; if (what == INIT_TAPE_COMPLETE) loaded = audioFile.load(system::join(getPatchStorageDirectory(), audioFilePath)); if (what == INIT_TAPE_TRACK_COUNT) audioFile.setNumChannels(trackCountParam); sizeAudioBuffer = audioFile.getNumSamplesPerChannel(); audioBufferPosition = 0; playStatus = true; (void)loaded; }\nvoid AudioFileTapeModule::calcAudio(int, float) {}\nvoid AudioFileTapeModule::process(const ProcessArgs&) { if (!playStatus || sizeAudioBuffer < 1) return; outputs[AUDIO_OUTPUT].setChannels(trackCountParam); for (int channel = 0; channel < trackCountParam; ++channel) outputs[AUDIO_OUTPUT].setVoltage(audioFile.samples[channel][static_cast<int>(audioBufferPosition)] * 10.f, channel); audioBufferPosition = std::fmod(audioBufferPosition + 1., sizeAudioBuffer); }\nvoid AudioFileTapeModule::onSave(const SaveEvent&) { audioFile.save(system::join(createPatchStorageDirectory(), "tape.wav"), 0); }\nstd::string AudioFileTapeModule::getAudioFileDir() { system::createDirectory(asset::user("recordings")); return asset::user("recordings"); }\nvoid AudioFileTapeModule::saveAudioFile(std::string path) { if (path.empty()) system::remove(path); else audioFile.save(path, 0); }\nvoid AudioFileTapeModule::loadAudioFile(std::string path) { audioFile.load(path); }\nstruct AudioFileTapeWidget : ModuleWidget { AudioFileTapeWidget(AudioFileTapeModule* module) { addParam(createParam<RoundBlackKnob>(Vec(20, 20), module, AudioFileTapeModule::PLAY_PARAM)); addInput(createInput<PJ301MPort>(Vec(10, 300), module, AudioFileTapeModule::AUDIO_INPUT)); addOutput(createOutput<PJ301MPort>(Vec(40, 330), module, AudioFileTapeModule::AUDIO_OUTPUT)); } }; Model* modelAudioFileTape = createModel<AudioFileTapeModule, AudioFileTapeWidget>("AudioFileTape");\n');
  const tapeFixturePath=path.join(plugin,"src","AudioFileTape.cpp"),tapeFixtureSource=fs.readFileSync(tapeFixturePath,"utf8");fs.writeFileSync(tapeFixturePath,tapeFixtureSource.replace("bool loaded = false;","bool loaded = false; /* Inactive desktop note: APP->engine and APP->patch. */"));
  try{const report=JSON.parse(execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/AudioFileTape","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"})),adapter=fs.readFileSync(path.join(output,"adapter.cpp"),"utf8"),runtime=JSON.parse(fs.readFileSync(path.join(output,"runtime.json"),"utf8")),wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;assert.equal(report.detected.browserAsset.mode,"audiofile-tape");assert.deepEqual(runtime.runtime.asset,{type:"audio",maxSamples:1920000,maxSeconds:10,channels:4});assert.doesNotMatch(adapter,/system::(?:join|createDirectory|remove)|createPatchStorageDirectory|getPatchStorageDirectory/);wasm._initialize();assert.equal(wasm.rack_web_asset_capacity(),1920000);const samples=new Float32Array(wasm.memory.buffer,wasm.rack_web_asset_buffer(),64);for(let index=0;index<samples.length;index++)samples[index]=(index+1)/64;wasm.rack_web_commit_asset(64,1,44100);wasm.rack_web_set_output_connected(0,1);wasm.rack_web_process(1,44100);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],10/64)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("built-in JSON style assets are embedded without desktop filesystem access",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-embedded-json-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"EmbeddedJson",name:"Embedded JSON",description:"Built-in JSON style fixture",tags:["Sequencer"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);const styles=path.join(plugin,"res","styles","electronic");fs.mkdirSync(styles,{recursive:true});fs.writeFileSync(path.join(styles,"fixture.json"),'{"name":"Fixture","value":7.25}\n');
  fs.writeFileSync(path.join(plugin,"src","EmbeddedJson.cpp"),'#include "plugin.hpp"\n#include <cstdio>\n#include <string>\nstruct EmbeddedStyle { std::string name = "Default"; float value = 1.f; bool loadFromJson(const std::string& path) {\nFILE* f = fopen(path.c_str(), "r");\nif (!f) return false;\njson_error_t error;\njson_t* root = json_loadf(f, 0, &error);\nfclose(f);\nif (!root) return false;\nif (auto* nameJ = json_object_get(root, "name")) name = json_string_value(nameJ); if (auto* valueJ = json_object_get(root, "value")) value = json_number_value(valueJ); json_decref(root); return true; } };\nstruct EmbeddedJsonModule : Module { enum OutputIds { VALUE_OUTPUT, NUM_OUTPUTS }; EmbeddedStyle style; EmbeddedJsonModule() { config(0, 0, NUM_OUTPUTS, 0); std::string path = asset::plugin(pluginInstance, "res/styles/electronic/fixture.json"); style.loadFromJson(path); } void process(const ProcessArgs&) override { outputs[VALUE_OUTPUT].setVoltage(style.value); } };\nstruct EmbeddedJsonWidget : ModuleWidget {}; Model* modelEmbeddedJson = createModel<EmbeddedJsonModule, EmbeddedJsonWidget>("EmbeddedJson");\n');
  try{const report=JSON.parse(execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/EmbeddedJson","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"})),adapter=fs.readFileSync(path.join(output,"adapter.cpp"),"utf8"),wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;assert.equal(report.assessment.compileEligible,true);assert.match(adapter,/rackWebEmbeddedJsonAsset/);assert.match(adapter,/styles\/electronic\/fixture\.json/);assert.match(adapter,/json_loads\(rackWebJson/);assert.doesNotMatch(adapter,/\bfopen\s*\(|\bjson_loadf\s*\(|\bpluginInstance\b/);wasm._initialize();wasm.rack_web_set_output_connected(0,1);wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],7.25)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("Rack double ring buffers compile with source-sized WASM memory",()=>{
  const output=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-buffered-test-"));
  const stdout=execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/Buffered","--manifest-file",path.join(source,"plugin.json"),"--source-dir",source,"--output",output,"--compile"],{encoding:"utf8"}),report=JSON.parse(stdout),runtime=JSON.parse(fs.readFileSync(path.join(output,"runtime.json"),"utf8"));
  assert.equal(report.detected.staticMemoryBytes,32);assert.equal(runtime.runtime.initialMemory%65536,0);assert.ok(runtime.runtime.initialMemory>=1048576+report.detected.staticMemoryBytes);
  const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();wasm.rack_web_set_input_connected(0,1);wasm.rack_web_set_input_channels(0,1);const inputs=new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),128),outputs=new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128);inputs.set([1,2,3,4]);wasm.rack_web_process(4,48000);assert.deepEqual([...outputs.slice(0,4)],[0,0,1,2]);
  fs.rmSync(output,{recursive:true,force:true});
});

test("Rack FFT, IIR, and MinBLEP primitives execute inside the generated WASM",()=>{
  const output=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-spectral-test-"));
  execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/Spectral","--manifest-file",path.join(source,"plugin.json"),"--source-dir",source,"--output",output,"--compile"],{encoding:"utf8"});
  const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();wasm.rack_web_set_input_connected(0,1);wasm.rack_web_set_input_channels(0,1);const inputs=new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),128),outputs=new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),4*128);inputs.set([2,4]);wasm.rack_web_process(2,48000);assert.ok(Math.abs(outputs[0]-1)<1e-5);assert.ok(Math.abs(outputs[1]-1)<1e-5);assert.ok(Math.abs(outputs[128]-1)<1e-5);assert.ok(Math.abs(outputs[129]-3)<1e-5);assert.ok(Number.isFinite(outputs[256])&&Math.abs(outputs[256])>0.5);assert.ok(Number.isFinite(outputs[257]));assert.equal(outputs[384],1);assert.equal(outputs[385],1);
  fs.rmSync(output,{recursive:true,force:true});
});

test("out-of-line DSP and large JSON arrays compile without losing earlier state slots",()=>{
  const output=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-out-of-line-test-"));
  const stdout=execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/OutOfLine","--manifest-file",path.join(source,"plugin.json"),"--source-dir",source,"--output",output,"--compile"],{encoding:"utf8"}),report=JSON.parse(stdout),runtime=JSON.parse(fs.readFileSync(path.join(output,"runtime.json"),"utf8"));
  assert.equal(report.detected.outOfLineDefinitions,3);assert.equal(report.detected.stateKeys.length,40);assert.equal(runtime.lights,4);assert.doesNotMatch(fs.readFileSync(path.join(output,"adapter.cpp"),"utf8"),/int values = 7/);
  const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();wasm.rack_web_set_state(0,1.25);wasm.rack_web_set_state(39,2.5);wasm.rack_web_set_input_connected(0,1);wasm.rack_web_set_input_channels(0,1);new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),128)[0]=3;wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],13.5);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_light_buffer(),4)[3],0.5);
  fs.rmSync(output,{recursive:true,force:true});
});

test("out-of-line constructors retain their configured control and port metadata",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-constructor-metadata-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"ExternalConstructor",name:"External constructor",description:"Constructor metadata fixture",tags:["Utility"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);fs.writeFileSync(path.join(plugin,"src","ExternalResources.hpp"),'#pragma once\nconst float externalValues[] = {2.f};\n');fs.writeFileSync(path.join(plugin,"src","ExternalScale.cpp"),'#include "plugin.hpp"\nstruct ExternalScale { static float apply(float value); };\nfloat ExternalScale::apply(float value) { return value * 3.f; }\n');fs.writeFileSync(path.join(plugin,"src","ExternalConstructor.cpp"),'#include "plugin.hpp"\n#include "ExternalResources.hpp"\nstruct ExternalScale { static float apply(float value); };\nstruct ExternalConstructorModule : Module { enum ParamIds { LEVEL_PARAM, NUM_PARAMS }; enum InputIds { SIGNAL_INPUT, NUM_INPUTS }; enum OutputIds { SIGNAL_OUTPUT, NUM_OUTPUTS }; enum LightIds { NUM_LIGHTS }; ExternalConstructorModule(); void step() override; };\nExternalConstructorModule::ExternalConstructorModule() { config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS); configParam(LEVEL_PARAM, -2.f, 2.f, 0.5f, "Level"); configInput(SIGNAL_INPUT, "Signal"); configOutput(SIGNAL_OUTPUT, "Scaled signal"); }\nvoid ExternalConstructorModule::step() { outputs[SIGNAL_OUTPUT].setVoltage(ExternalScale::apply(inputs[SIGNAL_INPUT].getVoltage() * params[LEVEL_PARAM].getValue() * externalValues[0])); }\nstruct ExternalConstructorWidget : ModuleWidget { Vec levelPosition = Vec(15, 25); Vec inputPosition = mm2px(Vec(10, 20)); Vec outputPosition = Vec(75, 300); ExternalConstructorWidget(ExternalConstructorModule* module) { addParam(createParam<RoundBlackKnob>(levelPosition, module, ExternalConstructorModule::LEVEL_PARAM)); addInput(createInput<PJ301MPort>(inputPosition, module, ExternalConstructorModule::SIGNAL_INPUT)); addOutput(createOutputCentered<PJ301MPort>(outputPosition, module, ExternalConstructorModule::SIGNAL_OUTPUT)); } };\nModel* modelExternalConstructor = createModel<ExternalConstructorModule, ExternalConstructorWidget>("ExternalConstructor");\n');
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/ExternalConstructor","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"});const runtime=JSON.parse(fs.readFileSync(path.join(output,"runtime.json"),"utf8"));assert.deepEqual(runtime.params,[{id:0,name:"Level",min:-2,max:2,default:.5,position:{x:15,y:25,widget:"RoundBlackKnob"}}]);assert.deepEqual(runtime.inputs,[{id:0,name:"Signal",kind:"audio",position:{x:29.528,y:59.055}}]);assert.deepEqual(runtime.outputs,[{id:0,name:"Scaled signal",kind:"audio",position:{x:75,y:300,centered:true}}]);const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();wasm.rack_web_set_input_connected(0,1);wasm.rack_web_set_input_channels(0,1);new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),128)[0]=4;wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],12)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("widget geometry expands scalar coordinates and simple placement loops",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-loop-layout-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"LoopLayout",name:"Loop layout",description:"Loop-generated widget layout fixture",tags:["Utility"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);fs.writeFileSync(path.join(plugin,"src","LoopLayout.cpp"),'#include "plugin.hpp"\nstruct LoopLayoutModule : Module { enum Architecture { NUM_LANES = 3 }; enum InputIds { MAIN_INPUT, LOOP_INPUT_1, LOOP_INPUT_2, LOOP_INPUT_3, GRID_INPUT_1, GRID_INPUT_2, GRID_INPUT_3, GRID_INPUT_4, NUM_INPUTS }; enum OutputIds { NUM_OUTPUTS }; enum ParamIds { NUM_PARAMS }; enum LightIds { NUM_LIGHTS }; LoopLayoutModule() { config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS); configInput(MAIN_INPUT, "Main"); configInput(LOOP_INPUT_1, "Loop 1"); configInput(LOOP_INPUT_2, "Loop 2"); configInput(LOOP_INPUT_3, "Loop 3"); configInput(GRID_INPUT_1, "Grid 1"); configInput(GRID_INPUT_2, "Grid 2"); configInput(GRID_INPUT_3, "Grid 3"); configInput(GRID_INPUT_4, "Grid 4"); } };\nstruct LoopLayoutWidget : ModuleWidget { float firstX = 12.5f; const float stepX = 30.f; float gridX[2] = {20.f, 50.f}; float gridY[2] = {250.f, 280.f}; LoopLayoutWidget(LoopLayoutModule* module) { addInput(createInput<PJ301MPort>(Vec(firstX, 300), module, LoopLayoutModule::MAIN_INPUT)); for (std::size_t lane = 0; lane < LoopLayoutModule::NUM_LANES; ++lane) { float offset = lane * stepX; addInput(createInputCentered<PJ301MPort>(Vec(firstX + offset, 330), module, LoopLayoutModule::LOOP_INPUT_1 + lane)); } long input = 0; for (auto row = 0; row < 2; ++row) { for (auto col = 0; col < 2; ++col) { input = LoopLayoutModule::GRID_INPUT_1 + row * 2 + col; addInput(createInput<PJ301MPort>(Vec(gridX[col], gridY[row]), module, input)); } } } };\nModel* modelLoopLayout = createModel<LoopLayoutModule, LoopLayoutWidget>("LoopLayout");\n');
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/LoopLayout","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output],{encoding:"utf8"});const runtime=JSON.parse(fs.readFileSync(path.join(output,"runtime.json"),"utf8"));assert.deepEqual(runtime.inputs,[{id:0,name:"Main",kind:"cv",position:{x:12.5,y:300}},{id:1,name:"Loop 1",kind:"cv",position:{x:12.5,y:330,centered:true}},{id:2,name:"Loop 2",kind:"cv",position:{x:42.5,y:330,centered:true}},{id:3,name:"Loop 3",kind:"cv",position:{x:72.5,y:330,centered:true}},{id:4,name:"Grid 1",kind:"cv",position:{x:20,y:250}},{id:5,name:"Grid 2",kind:"cv",position:{x:50,y:250}},{id:6,name:"Grid 3",kind:"cv",position:{x:20,y:280}},{id:7,name:"Grid 4",kind:"cv",position:{x:50,y:280}}])}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("widget geometry resolves header constants, panel size, and range-loop counters",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-range-layout-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"RangeLayout",name:"Range layout",description:"Header-driven range layout fixture",tags:["Utility"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);fs.writeFileSync(path.join(plugin,"src","RangeLayoutConstants.hpp"),'#pragma once\n#include <array>\nnamespace fixture::layout { struct LayoutConstants { static constexpr float knobRow_MM{20.f}; static constexpr float inputRow_MM = 100.f; static constexpr std::array<float, 2> outputRows_MM{110.f, 114.5f}; }; }\n');fs.writeFileSync(path.join(plugin,"src","RangeLayout.cpp"),'#include "plugin.hpp"\n#include "RangeLayoutConstants.hpp"\nstruct RangeLayoutModule : Module { enum ParamIds { CENTER_PARAM, ROW_PARAM, NUM_PARAMS }; enum InputIds { LEFT_INPUT, RIGHT_INPUT, CENTER_INPUT, NUM_INPUTS }; enum OutputIds { LEFT_OUTPUT, RIGHT_OUTPUT, NUM_OUTPUTS }; enum LightIds { NUM_LIGHTS }; RangeLayoutModule() { config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS); configParam(CENTER_PARAM, 0.f, 1.f, 0.5f, "Center"); configParam(ROW_PARAM, 0.f, 1.f, 0.5f, "Row"); configInput(LEFT_INPUT, "Left"); configInput(RIGHT_INPUT, "Right"); configInput(CENTER_INPUT, "Center"); configOutput(LEFT_OUTPUT, "Left"); configOutput(RIGHT_OUTPUT, "Right"); } };\nstruct RangeLayoutWidget : ModuleWidget { RangeLayoutWidget(RangeLayoutModule* module) { box.size = rack::Vec(rack::app::RACK_GRID_WIDTH * 6, rack::app::RACK_GRID_HEIGHT); auto cx = box.size.x * 0.5; auto cy = 30.f; addParam(rack::createParamCentered<RoundBlackKnob>(rack::Vec(cx, cy), module, RangeLayoutModule::CENTER_PARAM)); cy = rack::mm2px(fixture::layout::LayoutConstants::knobRow_MM); addParam(rack::createParamCentered<RoundBlackKnob>(rack::Vec(cx, cy), module, RangeLayoutModule::ROW_PARAM)); auto centerY = fixture::layout::LayoutConstants::inputRow_MM - 40.f; addInput(rack::createInputCentered<PJ301MPort>(rack::Vec(cx, rack::mm2px(centerY)), module, RangeLayoutModule::CENTER_INPUT)); float cols[2]{box.size.x * 0.5f - rack::mm2px(7.f), box.size.x * 0.5f + rack::mm2px(7.f)}; int col = 0; for (auto p : {RangeLayoutModule::LEFT_INPUT, RangeLayoutModule::RIGHT_INPUT}) { auto yp = rack::mm2px(fixture::layout::LayoutConstants::inputRow_MM); auto xp = cols[col]; addInput(rack::createInputCentered<PJ301MPort>(rack::Vec(xp, yp), module, p)); col++; } col = 0; for (auto p : {RangeLayoutModule::LEFT_OUTPUT, RangeLayoutModule::RIGHT_OUTPUT}) { auto yp = rack::mm2px(fixture::layout::LayoutConstants::outputRows_MM[1]); auto xp = cols[col]; addOutput(rack::createOutputCentered<PJ301MPort>(rack::Vec(xp, yp), module, p)); col++; } } };\nModel* modelRangeLayout = createModel<RangeLayoutModule, RangeLayoutWidget>("RangeLayout");\n');
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/RangeLayout","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output],{encoding:"utf8"});const runtime=JSON.parse(fs.readFileSync(path.join(output,"runtime.json"),"utf8"));assert.equal(runtime.width,90);assert.deepEqual(runtime.params,[{id:0,name:"Center",min:0,max:1,default:.5,position:{x:45,y:30,centered:true,widget:"RoundBlackKnob"}},{id:1,name:"Row",min:0,max:1,default:.5,position:{x:45,y:59.055,centered:true,widget:"RoundBlackKnob"}}]);assert.deepEqual(runtime.inputs,[{id:0,name:"Left",kind:"audio",position:{x:24.331,y:295.276,centered:true}},{id:1,name:"Right",kind:"audio",position:{x:65.669,y:295.276,centered:true}},{id:2,name:"Center",kind:"cv",position:{x:45,y:177.165,centered:true}}]);assert.deepEqual(runtime.outputs,[{id:0,name:"Left",kind:"audio",position:{x:24.331,y:338.091,centered:true}},{id:1,name:"Right",kind:"audio",position:{x:65.669,y:338.091,centered:true}}])}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("widget geometry expands plugin layout helper functions",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-helper-layout-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"HelperLayout",name:"Helper layout",description:"Plugin helper layout fixture",tags:["Utility"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);fs.writeFileSync(path.join(plugin,"src","HelperLayout.hpp"),'#pragma once\nextern const int HELPER_HP;\nnamespace fixture::layout { rack::Vec gridPosition(float column, float row); struct Constants { static constexpr float inputX_MM = 7.f; static constexpr float outputX_MM = 13.f; static constexpr float row_MM = 100.f; }; template <class W> struct Engine { static void placePorts(W* w, int input0, int output0, float row_MM = Constants::row_MM) { float columns_MM[2]{Constants::inputX_MM, Constants::outputX_MM}; int col = 0; for (auto p : {input0}) { auto x = rack::mm2px(columns_MM[col]); auto y = rack::mm2px(row_MM); w->addInput(rack::createInputCentered<PJ301MPort>(rack::Vec(x, y), w->module, p)); col++; } for (auto p : {output0}) { auto x = rack::mm2px(columns_MM[col]); auto y = rack::mm2px(row_MM); w->addOutput(rack::createOutputCentered<PJ301MPort>(rack::Vec(x, y), w->module, p)); col++; } } }; }\n');fs.writeFileSync(path.join(plugin,"src","HelperGrid.cpp"),'#include "plugin.hpp"\n#include "HelperLayout.hpp"\nconst int HELPER_HP{4};\nnamespace fixture::layout { rack::Vec gridPosition(float column, float row) { return rack::Vec(15.f * ((column * 2.f) - 1.f), 10.f * ((row * 2.f) - 1.f)); } }\n');fs.writeFileSync(path.join(plugin,"src","HelperLayout.cpp"),'#include "plugin.hpp"\n#include "HelperLayout.hpp"\nstruct HelperLayoutModule : Module { enum ParamIds { LEVEL_PARAM, NUM_PARAMS }; enum InputIds { SIGNAL_INPUT, NUM_INPUTS }; enum OutputIds { SIGNAL_OUTPUT, NUM_OUTPUTS }; enum LightIds { NUM_LIGHTS }; HelperLayoutModule() { config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS); configParam(LEVEL_PARAM, 0.f, 1.f, .5f, "Level"); configInput(SIGNAL_INPUT, "Signal"); configOutput(SIGNAL_OUTPUT, "Signal"); } }; struct HelperLayoutWidget : ModuleWidget { HelperLayoutWidget(HelperLayoutModule* module) { this->module = module; box.size = rack::Vec(rack::app::RACK_GRID_WIDTH * HELPER_HP, rack::app::RACK_GRID_HEIGHT); addParam(rack::createParamCentered<RoundBlackKnob>(fixture::layout::gridPosition(2.f, 3.f), module, HelperLayoutModule::LEVEL_PARAM)); using engine_t = fixture::layout::Engine<HelperLayoutWidget>; engine_t::placePorts(this, HelperLayoutModule::SIGNAL_INPUT, HelperLayoutModule::SIGNAL_OUTPUT); } }; Model* modelHelperLayout = createModel<HelperLayoutModule, HelperLayoutWidget>("HelperLayout");\n');
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/HelperLayout","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output],{encoding:"utf8"});const runtime=JSON.parse(fs.readFileSync(path.join(output,"runtime.json"),"utf8"));assert.equal(runtime.width,60);assert.deepEqual(runtime.params,[{id:0,name:"Level",min:0,max:1,default:.5,position:{x:45,y:50,centered:true,widget:"RoundBlackKnob"}}]);assert.deepEqual(runtime.inputs,[{id:0,name:"Signal",kind:"audio",position:{x:20.669,y:295.276,centered:true}}]);assert.deepEqual(runtime.outputs,[{id:0,name:"Signal",kind:"audio",position:{x:38.386,y:295.276,centered:true}}])}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("widget geometry resolves layout value objects and rectangular selectors",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-layout-object-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"LayoutObject",name:"Layout object",description:"Value-object layout fixture",tags:["Utility"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);fs.writeFileSync(path.join(plugin,"src","LayoutObject.hpp"),'#pragma once\nnamespace fixture::layout { struct Constants { static constexpr float firstColumnCenter_MM{9.48f}; static constexpr float columnWidth_MM{14.f}; static constexpr std::array<float, 2> vcoRowCenters_MM{55.f, 71.f}; }; struct Item { static Item createVCFWSBigKnob(int, const char*) { return {}; } static Item createVCOKnob(int, const char*, int, int) { return {}; } }; template <class W, int P> struct Engine { static void layoutItem(W*, const Item&, const char*) {} }; }\n');fs.writeFileSync(path.join(plugin,"src","LayoutObject.cpp"),'#include "plugin.hpp"\n#include "LayoutObject.hpp"\nstruct LayoutObjectModule : Module { enum ParamIds { BIG_PARAM, ROW_PARAM, SELECT_PARAM, NUM_PARAMS }; enum InputIds { NUM_INPUTS }; enum OutputIds { NUM_OUTPUTS }; enum LightIds { NUM_LIGHTS }; LayoutObjectModule() { config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS); configParam(BIG_PARAM, 0.f, 1.f, .5f, "Big"); configParam(ROW_PARAM, 0.f, 1.f, .5f, "Row"); configParam(SELECT_PARAM, 0.f, 3.f, 0.f, "Select"); } }; struct LayoutObjectWidget : ModuleWidget { LayoutObjectWidget(LayoutObjectModule* module) { typedef fixture::layout::Item lay_t; typedef fixture::layout::Engine<LayoutObjectWidget, LayoutObjectModule::BIG_PARAM> engine_t; for (const auto &lay : {lay_t::createVCFWSBigKnob(LayoutObjectModule::BIG_PARAM, "BIG"), lay_t::createVCOKnob(LayoutObjectModule::ROW_PARAM, "ROW", 0, 2)}) engine_t::layoutItem(this, lay, "OBJECT"); auto x = rack::mm2px(5.f); auto y = rack::mm2px(7.f); auto w = rack::mm2px(20.f); auto h = rack::mm2px(4.f); addChild(JogSelector::create(rack::Vec(x, y), rack::Vec(w, h), module, LayoutObjectModule::SELECT_PARAM)); } }; Model* modelLayoutObject = createModel<LayoutObjectModule, LayoutObjectWidget>("LayoutObject");\n');
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/LayoutObject","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output],{encoding:"utf8"});const runtime=JSON.parse(fs.readFileSync(path.join(output,"runtime.json"),"utf8"));assert.deepEqual(runtime.params,[{id:0,name:"Big",min:0,max:1,default:.5,position:{x:48.661,y:186.024,centered:true}},{id:1,name:"Row",min:0,max:1,default:.5,position:{x:110.669,y:162.402,centered:true}},{id:2,name:"Select",min:0,max:3,default:0,position:{x:44.291,y:26.575,width:59.055,height:11.811,control:"selector",centered:true}}])}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("qualified Rack module bases ignore unrelated terminal-name typedefs",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-qualified-base-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"QualifiedBase",name:"Qualified base",description:"Qualified Rack base fixture",tags:["Utility"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);fs.writeFileSync(path.join(plugin,"src","Foreign.hpp"),'#pragma once\nnamespace foreign { typedef struct Module Module; }\n');fs.writeFileSync(path.join(plugin,"src","QualifiedBase.cpp"),'#include "plugin.hpp"\n#include "Foreign.hpp"\nstruct QualifiedBaseModule : rack::Module, sst::rackhelpers::module_connector::NeighborConnectable_V1 { enum ParamIds { NUM_PARAMS }; enum InputIds { NUM_INPUTS }; enum OutputIds { NUM_OUTPUTS }; enum LightIds { NUM_LIGHTS }; QualifiedBaseModule() { config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS); } std::optional<std::vector<labeledStereoPort_t>> getPrimaryInputs() override { return std::nullopt; } };\nstruct QualifiedBaseWidget : ModuleWidget { QualifiedBaseWidget(QualifiedBaseModule*) {} };\nModel* modelQualifiedBase = createModel<QualifiedBaseModule, QualifiedBaseWidget>("QualifiedBase");\n');
  try{const stdout=execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/QualifiedBase","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"}),report=JSON.parse(stdout);assert.equal(report.assessment.compileEligible,true);assert.deepEqual(report.detected.inheritance,{directBase:"rack::Module",secondaryBases:["sst::rackhelpers::module_connector::NeighborConnectable_V1"],chain:[]});const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();assert.equal(wasm.rack_web_input_count(),0)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("companion implementation includes are followed transitively",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-companion-closure-test-")),plugin=path.join(temporary,"plugin"),dependency=path.join(plugin,"dependency"),output=path.join(temporary,"output");
  fs.cpSync(source,plugin,{recursive:true});
  const header=path.join(plugin,"src","Simple.hpp"),simple=fs.readFileSync(header,"utf8").replace('#include "plugin.hpp"','#include "plugin.hpp"\n#include <time.h>\n#include "entry.hpp"\n#ifdef _WIN32\n#include "include/windows_only.hpp"\n#endif').replace("struct FixtureModule : Module {","struct FixtureModule : Module {\n  FixtureEntry entry;\n  FixtureMode mode = FixtureMode::Double;").replace("inputs[SIGNAL_INPUT].getVoltage() * params[LEVEL_PARAM].getValue()","entry.apply(inputs[SIGNAL_INPUT].getVoltage() * params[LEVEL_PARAM].getValue())");
  const sdk=path.join(plugin,"metamodule-plugin-sdk");fs.writeFileSync(header,simple);fs.mkdirSync(path.join(dependency,"include"),{recursive:true});fs.mkdirSync(path.join(dependency,"src"),{recursive:true});fs.mkdirSync(path.join(sdk,"newlib"),{recursive:true});fs.writeFileSync(path.join(plugin,".gitmodules"),'[submodule "dependency"]\n  path = dependency\n  url = https://github.com/example/dependency.git\n[submodule "metamodule-plugin-sdk"]\n  path = metamodule-plugin-sdk\n  url = https://github.com/example/metamodule-plugin-sdk.git\n');fs.writeFileSync(path.join(dependency,"include","entry.hpp"),'#pragma once\nenum class FixtureMode { Double };\nstruct FixtureEntry { float apply(float value) const; };\n');fs.writeFileSync(path.join(dependency,"include","time.h"),'#error A submodule time.h must not shadow the browser C standard library\n');fs.writeFileSync(path.join(dependency,"include","windows_only.hpp"),'#error An inactive Windows-only dependency must not enter the browser adapter\n');fs.writeFileSync(path.join(dependency,"src","entry.cpp"),'#include "entry.hpp"\n#include "resources.hpp"\nfloat FixtureEntry::apply(float value) const { return value * fixtureResourceGain; }\n');fs.writeFileSync(path.join(dependency,"src","resources.hpp"),'#pragma once\nextern const float fixtureResourceGain;\n');fs.writeFileSync(path.join(dependency,"src","resources.cpp"),'#include "resources.hpp"\nconst float fixtureResourceGain = 2.f;\n');fs.writeFileSync(path.join(sdk,"rack.hpp"),'#error A vendored host rack.hpp must never replace the browser Rack ABI\n');fs.writeFileSync(path.join(sdk,"newlib","incompatible.c"),'#error MetaModule firmware libc must not be linked into browser Rack modules\n');
  const gitEnvironment={...process.env,GIT_AUTHOR_NAME:"Rack Web",GIT_AUTHOR_EMAIL:"rack-web@example.invalid",GIT_COMMITTER_NAME:"Rack Web",GIT_COMMITTER_EMAIL:"rack-web@example.invalid"},git=(directory,...parameters)=>execFileSync("git",["-C",directory,...parameters],{env:gitEnvironment,stdio:"ignore"});execFileSync("git",["init",dependency],{env:gitEnvironment,stdio:"ignore"});git(dependency,"add",".");git(dependency,"commit","-m","fixture dependency");execFileSync("git",["init",sdk],{env:gitEnvironment,stdio:"ignore"});git(sdk,"add",".");git(sdk,"commit","-m","fixture sdk");execFileSync("git",["init",plugin],{env:gitEnvironment,stdio:"ignore"});git(plugin,"add",".");git(plugin,"commit","-m","fixture plugin");
  execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/Simple","--manifest-file",path.join(plugin,"plugin.json"),"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"});
  const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();wasm.rack_web_set_input_connected(0,1);wasm.rack_web_set_input_channels(0,1);new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),128)[0]=3;wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],6);
  fs.rmSync(temporary,{recursive:true,force:true});
});

test("dependency angle headers cannot shadow the browser C standard library",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-header-shadow-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output"),legacy=path.join(plugin,"vendor","legacy");fs.cpSync(source,plugin,{recursive:true});fs.mkdirSync(legacy,{recursive:true});
  fs.writeFileSync(path.join(legacy,"LegacyDsp.hpp"),'#pragma once\nstruct LegacyShadowDsp { float apply(float value) const { return value * 2.f; } };\n');
  fs.writeFileSync(path.join(legacy,"time.h"),'#error A dependency time.h must not shadow the browser C standard library\n');
  const header=path.join(plugin,"src","Simple.hpp"),simple=fs.readFileSync(header,"utf8").replace('#include "plugin.hpp"','#include "plugin.hpp"\n#include <LegacyDsp.hpp>').replace("struct FixtureModule : Module {","struct FixtureModule : Module {\n  LegacyShadowDsp shadowDsp;").replace("inputs[SIGNAL_INPUT].getVoltage() * params[LEVEL_PARAM].getValue()","shadowDsp.apply(inputs[SIGNAL_INPUT].getVoltage() * params[LEVEL_PARAM].getValue())");fs.writeFileSync(header,simple);
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/Simple","--manifest-file",path.join(plugin,"plugin.json"),"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"});const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();wasm.rack_web_set_input_connected(0,1);wasm.rack_web_set_input_channels(0,1);new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),128)[0]=3;wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],6)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("vendored eurorack DSP keeps preprocessor branches and companion data translations",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-eurorack-dependency-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output"),vendor=path.join(plugin,"eurorack","plaits"),firmware=path.join(plugin,"eurorack","stmlib","third_party","STM","CMSIS");fs.cpSync(source,plugin,{recursive:true});fs.mkdirSync(vendor,{recursive:true});fs.mkdirSync(firmware,{recursive:true});
  fs.writeFileSync(path.join(firmware,"system_firmware.h"),"#pragma once\nvoid fixtureFirmware();\n");
  fs.writeFileSync(path.join(firmware,"system_firmware.c"),"#error STM32 firmware must not be compiled into a browser DSP module\n");
  fs.writeFileSync(path.join(vendor,"cv_reader.h"),"#pragma once\nvoid fixtureCvReader();\n");
  fs.writeFileSync(path.join(vendor,"cv_reader.cc"),'#include "cv_reader.h"\n#include "stmlib/system/storage.h"\n#error Hardware calibration readers must not be compiled into a browser DSP module\n');
  fs.writeFileSync(path.join(vendor,"voice.h"),'#pragma once\n#include <cstdint>\n#include "cv_reader.h"\n#include "../stmlib/third_party/STM/CMSIS/system_firmware.h"\n#ifdef TEST\ninline uint16_t fixtureClip(int value) { return value < 0 ? 0 : value; }\n#else\ninline uint32_t fixtureClip(int value) { return value < 0 ? 0 : value; }\n#endif\nnamespace atelier_support { inline float applyScale(float value, float scale) { return value * scale; } }\nnamespace atelier_fixture { struct Voice { static const float scale_[1]; float process(float value) const; }; }\n');
  fs.writeFileSync(path.join(vendor,"voice.cc"),'#include "voice.h"\nnamespace atelier_fixture { using namespace atelier_support; float Voice::process(float value) const { return fixtureClip(applyScale(value, scale_[0])); } }\n');
  fs.writeFileSync(path.join(vendor,"voice_data.cc"),'#include "voice.h"\nnamespace atelier_fixture { const float Voice::scale_[] = { 2.f }; }\n');
  const header=path.join(plugin,"src","Simple.hpp"),simple=fs.readFileSync(header,"utf8").replace('#include "plugin.hpp"','#include "plugin.hpp"\n#include "voice.h"').replace("struct FixtureModule : Module {","struct FixtureModule : Module {\n  atelier_fixture::Voice voice;").replace("inputs[SIGNAL_INPUT].getVoltage() * params[LEVEL_PARAM].getValue()","voice.process(inputs[SIGNAL_INPUT].getVoltage() * params[LEVEL_PARAM].getValue())");fs.writeFileSync(header,simple);
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/Simple","--manifest-file",path.join(plugin,"plugin.json"),"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"});const adapter=fs.readFileSync(path.join(output,"adapter.cpp"),"utf8");assert.match(adapter,/#include "voice\.h"/);assert.doesNotMatch(adapter,/uint16_t fixtureClip|uint32_t fixtureClip|Voice::scale_/);const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();wasm.rack_web_set_input_connected(0,1);wasm.rack_web_set_input_channels(0,1);new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),128)[0]=3;wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],6)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("value-type DSP button helpers survive native UI stripping",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-dsp-button-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"DspButton",name:"DSP button",description:"Value-type button helper fixture",tags:["Utility"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);
  fs.writeFileSync(path.join(plugin,"src","DspButton.cpp"),'#include "plugin.hpp"\n/*s\ntruct CenteredLabel : Widget { void draw(const DrawArgs&) override {} };\n*/\nstruct LongPressButton { bool pressed = false; bool step(Param& param) { bool next = param.getValue() > 0.f; bool released = pressed && !next; pressed = next; return released; } };\nstruct DspButtonModule : Module { enum ParamIds { TYPE_PARAM, NUM_PARAMS }; enum InputIds { NUM_INPUTS }; enum OutputIds { SIGNAL_OUTPUT, NUM_OUTPUTS }; enum LightIds { NUM_LIGHTS }; LongPressButton typeButtons[1]; bool active = false; DspButtonModule() { config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS); configButton(TYPE_PARAM, "Type"); configOutput(SIGNAL_OUTPUT, "Signal"); } void process(const ProcessArgs&) override { if (typeButtons[0].step(params[TYPE_PARAM])) active = !active; outputs[SIGNAL_OUTPUT].setVoltage(active ? 5.f : 0.f); } };\nstruct DspButtonWidget : ModuleWidget {};\nModel* modelDspButton = createModel<DspButtonModule, DspButtonWidget>("DspButton");\n');
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/DspButton","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"});const adapter=fs.readFileSync(path.join(output,"adapter.cpp"),"utf8");assert.match(adapter,/struct LongPressButton/);assert.match(adapter,/LongPressButton typeButtons\[1\]/);const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports,outputs=new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128);wasm._initialize();wasm.rack_web_set_param(0,1);wasm.rack_web_process(1,48000);assert.equal(outputs[0],0);wasm.rack_web_set_param(0,0);wasm.rack_web_process(1,48000);assert.equal(outputs[0],5)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("dependency arrays, commented method signatures, and recursive macros compile together",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-legacy-dependency-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"LegacyDependency",name:"Legacy dependency",description:"Namespace globals and recursive macro fixture",tags:["Utility"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);
  fs.mkdirSync(path.join(plugin,"shared","include"),{recursive:true});fs.mkdirSync(path.join(plugin,"shared","src"),{recursive:true});
  fs.writeFileSync(path.join(plugin,"shared","include","LegacyDsp.hpp"),'#pragma once\nstruct LegacyDsp { double apply(double value); };\n');
  fs.writeFileSync(path.join(plugin,"shared","src","LegacyDsp.cpp"),'#include "LegacyDsp.hpp"\n#define FIXTURE_SCALE(value) ((value) * 1.5)\n#define FIXTURE_GAIN FIXTURE_SCALE(2)\nstatic const double fixtureGain = []() { double value = FIXTURE_GAIN; return value; }();\ndouble LegacyDsp::apply(double value) /* legacy unit */ { return value * fixtureGain; }\n');
  fs.writeFileSync(path.join(plugin,"src","LegacyDependency.cpp"),'#include "plugin.hpp"\n#include "../shared/include/LegacyDsp.hpp"\nclass LegacyDependencyModule : public Module { private: enum ParamIds { NUM_PARAMS }; enum InputIds { SIGNAL_INPUT, NUM_INPUTS }; enum OutputIds { SIGNAL_OUTPUT, NUM_OUTPUTS }; enum LightIds { NUM_LIGHTS }; LegacyDsp dsp; public: LegacyDependencyModule() { config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS); } void process(const ProcessArgs&) override { outputs[SIGNAL_OUTPUT].setVoltage(dsp.apply(inputs[SIGNAL_INPUT].getVoltage())); } };\nstruct LegacyDependencyWidget : ModuleWidget {};\nModel* modelLegacyDependency = createModel<LegacyDependencyModule, LegacyDependencyWidget>("LegacyDependency");\n');
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/LegacyDependency","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"});const adapter=fs.readFileSync(path.join(output,"adapter.cpp"),"utf8");assert.match(adapter,/fixtureGain = \[\]\(\) \{ double value = FIXTURE_GAIN; return value; \}\(\);/);assert.match(adapter,/#define FIXTURE_SCALE/);assert.match(adapter,/#define FIXTURE_GAIN FIXTURE_SCALE\(2\)/);assert.match(adapter,/LegacyDsp::apply\(double value\) \/\* legacy unit \*\//);const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();wasm.rack_web_set_input_connected(0,1);wasm.rack_web_set_input_channels(0,1);new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),128)[0]=2;wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],6)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("specific using declarations precede generated helper forwards",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-helper-using-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"HelperUsing",name:"Helper using",description:"Specific namespace using fixture",tags:["Utility"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);
  fs.writeFileSync(path.join(plugin,"src","HelperUsingDsp.hpp"),'#pragma once\n#include <array>\n#include <string>\nusing std::array;\nstatic const std::string fixtureScript = R"JS(\nfunction tokenize(input) { return { value: input || "default" }; }\n)JS";\ninline void fixtureFillArray(array<float, 2>& values, float value = 1.f) { values[0] = value; values[1] = value * 2.f; }\nstruct HelperUsingDsp { float apply(float value) { array<float, 2> values{}; fixtureFillArray(values, value); return values[1]; } };\n');
  fs.writeFileSync(path.join(plugin,"src","HelperUsing.cpp"),'#include "plugin.hpp"\n#include "HelperUsingDsp.hpp"\nstruct FixtureHistoryAction : history::ModuleAction {};\nstruct HelperUsingModule : Module { enum ParamIds { NUM_PARAMS }; enum InputIds { SIGNAL_INPUT, NUM_INPUTS }; enum OutputIds { SIGNAL_OUTPUT, NUM_OUTPUTS }; enum LightIds { NUM_LIGHTS }; HelperUsingDsp dsp; HelperUsingModule() { config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS); } void importDesktopScript() { Javascript::Runtime runtime; } void copyDesktopSequence() { sequence.toClipboard(); } void recordDesktopHistory() { APP->history->push(new FixtureHistoryAction()); } void process(const ProcessArgs&) override { outputs[SIGNAL_OUTPUT].setVoltage(dsp.apply(inputs[SIGNAL_INPUT].getVoltage())); } };\nstruct HelperUsingWidget : ModuleWidget {};\nModel* modelHelperUsing = createModel<HelperUsingModule, HelperUsingWidget>("HelperUsing");\n');
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/HelperUsing","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"});const adapter=fs.readFileSync(path.join(output,"adapter.cpp"),"utf8"),usingIndex=adapter.indexOf("using std::array;"),forwardIndex=adapter.indexOf("inline void fixtureFillArray(array<float, 2>& values, float value);");assert.ok(usingIndex>=0&&forwardIndex>usingIndex);assert.doesNotMatch(adapter,/function tokenize\(input\);|Javascript::Runtime|sequence\.toClipboard|FixtureHistoryAction|APP->history/);assert.equal((adapter.match(/float value = 1\.f/g)??[]).length,1);const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();wasm.rack_web_set_input_connected(0,1);wasm.rack_web_set_input_channels(0,1);new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),128)[0]=3;wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],6)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("out-of-line DSP keeps referenced parameter quantity helpers",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-out-of-line-quantity-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"OutOfLineQuantity",name:"Out-of-line quantity",description:"Implementation quantity helper fixture",tags:["Utility"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);
  fs.writeFileSync(path.join(plugin,"src","OutOfLineQuantity.hpp"),'#pragma once\n#include "plugin.hpp"\nstruct OutOfLineQuantityModule : Module { enum ParamIds { NUM_PARAMS }; enum InputIds { SIGNAL_INPUT, NUM_INPUTS }; enum OutputIds { SIGNAL_OUTPUT, NUM_OUTPUTS }; enum LightIds { NUM_LIGHTS }; OutOfLineQuantityModule(); void process(const ProcessArgs&) override; };\n');
  fs.writeFileSync(path.join(plugin,"src","OutOfLineQuantity.cpp"),'#include "OutOfLineQuantity.hpp"\nstruct FixtureRateQuantity : public ParamQuantity { static float scale(float value) { return value * 2.f; } };\nOutOfLineQuantityModule::OutOfLineQuantityModule() { config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS); }\nvoid OutOfLineQuantityModule:: process(const ProcessArgs&) { outputs[SIGNAL_OUTPUT].setVoltage(FixtureRateQuantity::scale(inputs[SIGNAL_INPUT].getVoltage())); }\nstruct OutOfLineQuantityWidget : ModuleWidget {};\nModel* modelOutOfLineQuantity = createModel<OutOfLineQuantityModule, OutOfLineQuantityWidget>("OutOfLineQuantity");\n');
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/OutOfLineQuantity","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"});const adapter=fs.readFileSync(path.join(output,"adapter.cpp"),"utf8");assert.match(adapter,/struct FixtureRateQuantity : public ParamQuantity/);assert.match(adapter,/OutOfLineQuantityModule:: process/);const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();wasm.rack_web_set_input_connected(0,1);wasm.rack_web_set_input_channels(0,1);new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),128)[0]=3;wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],6)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("dependency methods using a target back-reference wait for the complete module type",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-target-backref-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"TargetBackref",name:"Target back-reference",description:"Dependency implementation ordering fixture",tags:["Utility"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);
  fs.writeFileSync(path.join(plugin,"src","BackrefRotor.hpp"),'#pragma once\nstruct TargetBackrefModule;\nclass BackrefRotor { public: explicit BackrefRotor(const TargetBackrefModule* owner); float read() const; private: const TargetBackrefModule* owner; };\n');
  fs.writeFileSync(path.join(plugin,"src","BackrefRotor.cpp"),'#include "BackrefRotor.hpp"\n#include "TargetBackref.hpp"\nBackrefRotor::BackrefRotor(const TargetBackrefModule* owner) : owner(owner) {}\nfloat BackrefRotor::read() const { return float(owner->currentFrame() + 1); }\n');
  fs.writeFileSync(path.join(plugin,"src","TargetBackref.hpp"),'#pragma once\n#include "plugin.hpp"\n#include "BackrefRotor.hpp"\nstruct TargetBackrefModule : Module { enum ParamIds { NUM_PARAMS }; enum InputIds { NUM_INPUTS }; enum OutputIds { SIGNAL_OUTPUT, NUM_OUTPUTS }; enum LightIds { NUM_LIGHTS }; int64_t frame = 0; BackrefRotor rotor; TargetBackrefModule() : rotor(this) { config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS); configOutput(SIGNAL_OUTPUT, "Frame"); } int64_t currentFrame() const { return frame; } void process(const ProcessArgs& args) override { frame = args.frame; outputs[SIGNAL_OUTPUT].setVoltage(rotor.read()); } };\n');
  fs.writeFileSync(path.join(plugin,"src","TargetBackref.cpp"),'#include "TargetBackref.hpp"\nstruct TargetBackrefWidget : ModuleWidget {};\nModel* modelTargetBackref = createModel<TargetBackrefModule, TargetBackrefWidget>("TargetBackref");\n');
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/TargetBackref","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"});const adapter=fs.readFileSync(path.join(output,"adapter.cpp"),"utf8"),moduleIndex=adapter.indexOf("struct TargetBackrefModule : Module"),methodIndex=adapter.indexOf("float BackrefRotor::read() const");assert.ok(moduleIndex>=0&&methodIndex>moduleIndex);const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();wasm.rack_web_set_output_connected(0,1);wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],1)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("configured parameter quantities keep out-of-line virtual methods",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-configured-quantity-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"ConfiguredQuantity",name:"Configured quantity",description:"Out-of-line configured quantity fixture",tags:["Utility"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);
  fs.writeFileSync(path.join(plugin,"src","ConfiguredQuantity.cpp"),'#include "plugin.hpp"\nstruct ConfiguredQuantityModule;\nstruct DynamicLabelQuantity : ParamQuantity { std::string getLabel() override; };\nstruct ConfiguredQuantityModule : Module { enum ParamIds { LEVEL_PARAM, NUM_PARAMS }; enum InputIds { NUM_INPUTS }; enum OutputIds { SIGNAL_OUTPUT, NUM_OUTPUTS }; enum LightIds { NUM_LIGHTS }; ConfiguredQuantityModule() { config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS); configParam<DynamicLabelQuantity>(LEVEL_PARAM, 0.f, 2.f, .75f, "Level"); } void process(const ProcessArgs&) override { outputs[SIGNAL_OUTPUT].setVoltage(params[LEVEL_PARAM].getValue()); } };\nstd::string DynamicLabelQuantity::getLabel() { return dynamic_cast<ConfiguredQuantityModule*>(module) ? "Dynamic level" : name; }\nstruct ConfiguredQuantityWidget : ModuleWidget {};\nModel* modelConfiguredQuantity = createModel<ConfiguredQuantityModule, ConfiguredQuantityWidget>("ConfiguredQuantity");\n');
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/ConfiguredQuantity","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"});const adapter=fs.readFileSync(path.join(output,"adapter.cpp"),"utf8");assert.match(adapter,/DynamicLabelQuantity::getLabel\s*\(\s*\)/);const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],.75)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("plain configParam quantities can be deleted and replaced like Rack-owned quantities",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-replaced-quantity-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"ReplacedQuantity",name:"Replaced quantity",description:"Rack-owned quantity replacement fixture",tags:["Utility"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);
  fs.writeFileSync(path.join(plugin,"src","ReplacedQuantity.cpp"),'#include "plugin.hpp"\nstruct ReplacementQuantity : ParamQuantity { std::string getDisplayValueString() override { return string::f("%d step", (int) std::round(getValue())); } };\nstruct ReplacedQuantityModule : Module { enum ParamIds { STEP_PARAM, NUM_PARAMS }; enum InputIds { NUM_INPUTS }; enum OutputIds { SIGNAL_OUTPUT, NUM_OUTPUTS }; enum LightIds { NUM_LIGHTS }; ReplacedQuantityModule() { config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS); configParam(STEP_PARAM, 1.f, 7.f, 2.f, "Step"); delete paramQuantities[STEP_PARAM]; paramQuantities[STEP_PARAM] = new ReplacementQuantity; paramQuantities[STEP_PARAM]->module = this; paramQuantities[STEP_PARAM]->paramId = STEP_PARAM; paramQuantities[STEP_PARAM]->minValue = 1.f; paramQuantities[STEP_PARAM]->maxValue = 7.f; paramQuantities[STEP_PARAM]->defaultValue = 2.f; paramQuantities[STEP_PARAM]->name = "Step"; paramQuantities[STEP_PARAM]->snapEnabled = true; } void process(const ProcessArgs&) override { outputs[SIGNAL_OUTPUT].setVoltage(params[STEP_PARAM].getValue()); } };\nstruct ReplacedQuantityWidget : ModuleWidget {};\nModel* modelReplacedQuantity = createModel<ReplacedQuantityModule, ReplacedQuantityWidget>("ReplacedQuantity");\n');
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/ReplacedQuantity","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"});const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();assert.deepEqual([wasm.rack_web_param_count(),wasm.rack_web_get_param(0),wasm.rack_web_get_param_min(0),wasm.rack_web_get_param_max(0)],[1,2,1,7]);wasm.rack_web_set_param(0,6);wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],6);wasm.rack_web_reset_param(0,2);assert.equal(wasm.rack_web_get_param(0),2)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("same-named parameter quantities use the target translation unit implementation",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-quantity-owner-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"OwnedQuantity",name:"Owned quantity",description:"Translation-unit-local quantity fixture",tags:["Utility"]},{slug:"SiblingQuantity",name:"Sibling quantity",description:"Same-named quantity in a sibling translation unit",tags:["Utility"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);
  fs.writeFileSync(path.join(plugin,"src","OwnedQuantity.cpp"),'#include "plugin.hpp"\nstruct OwnedQuantityModule; struct SharedLabelQuantity : ParamQuantity { std::string getLabel() override; }; struct OwnedQuantityModule : Module { enum ParamIds { LEVEL_PARAM, NUM_PARAMS }; enum InputIds { NUM_INPUTS }; enum OutputIds { SIGNAL_OUTPUT, NUM_OUTPUTS }; enum LightIds { NUM_LIGHTS }; OwnedQuantityModule() { config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS); configParam<SharedLabelQuantity>(LEVEL_PARAM, 0.f, 2.f, 1.25f, "Level"); } void process(const ProcessArgs&) override { outputs[SIGNAL_OUTPUT].setVoltage(params[LEVEL_PARAM].getValue()); } };\nstd::string SharedLabelQuantity::getLabel() { return dynamic_cast<OwnedQuantityModule*>(module) ? "Owned" : name; }\nstruct OwnedQuantityWidget : ModuleWidget {}; Model* modelOwnedQuantity = createModel<OwnedQuantityModule, OwnedQuantityWidget>("OwnedQuantity");\n');
  fs.writeFileSync(path.join(plugin,"src","SiblingQuantity.cpp"),'#include "plugin.hpp"\nstruct SiblingQuantityModule; struct SharedLabelQuantity : ParamQuantity { std::string getLabel() override; }; struct SiblingQuantityModule : Module { enum ParamIds { LEVEL_PARAM, NUM_PARAMS }; enum InputIds { NUM_INPUTS }; enum OutputIds { SIGNAL_OUTPUT, NUM_OUTPUTS }; enum LightIds { NUM_LIGHTS }; SiblingQuantityModule() { config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS); configParam<SharedLabelQuantity>(LEVEL_PARAM, 0.f, 2.f, .5f, "Level"); } void process(const ProcessArgs&) override { outputs[SIGNAL_OUTPUT].setVoltage(params[LEVEL_PARAM].getValue()); } };\nstd::string SharedLabelQuantity::getLabel() { return dynamic_cast<SiblingQuantityModule*>(module) ? "Sibling" : name; }\nstruct SiblingQuantityWidget : ModuleWidget {}; Model* modelSiblingQuantity = createModel<SiblingQuantityModule, SiblingQuantityWidget>("SiblingQuantity");\n');
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/OwnedQuantity","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"});const adapter=fs.readFileSync(path.join(output,"adapter.cpp"),"utf8");assert.match(adapter,/dynamic_cast<OwnedQuantityModule\*>/);assert.doesNotMatch(adapter,/dynamic_cast<SiblingQuantityModule\*>/);const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],1.25)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("free functions requiring a complete inherited type are emitted after the base",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-deferred-base-function-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"DeferredInheritance",name:"Deferred inheritance",description:"Complete inherited type fixture",tags:["Utility"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);
  fs.writeFileSync(path.join(plugin,"src","DeferredBase.hpp"),'#pragma once\nstruct DeferredBase;\nbool fixtureIsDeferred(Module* module);\nstruct DeferredBase : Module { float apply(float value) const { return value * 2.f; } };\n');
  fs.writeFileSync(path.join(plugin,"src","DeferredInheritance.cpp"),'#include "plugin.hpp"\n#include "DeferredBase.hpp"\nvoid init(Plugin* plugin) { plugin->addModel(nullptr); }\nbool fixtureIsDeferred(Module* module) { return dynamic_cast<DeferredBase*>(module) != nullptr; }\nstruct DeferredInheritanceModule : DeferredBase { enum ParamIds { NUM_PARAMS }; enum InputIds { SIGNAL_INPUT, NUM_INPUTS }; enum OutputIds { SIGNAL_OUTPUT, NUM_OUTPUTS }; enum LightIds { NUM_LIGHTS }; DeferredInheritanceModule() { config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS); } void process(const ProcessArgs&) override { outputs[SIGNAL_OUTPUT].setVoltage(fixtureIsDeferred(this) ? apply(inputs[SIGNAL_INPUT].getVoltage()) : 0.f); } }; struct DeferredInheritanceWidget : ModuleWidget {}; Model* modelDeferredInheritance = createModel<DeferredInheritanceModule, DeferredInheritanceWidget>("DeferredInheritance");\n');
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/DeferredInheritance","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"});const adapter=fs.readFileSync(path.join(output,"adapter.cpp"),"utf8"),baseIndex=adapter.indexOf("struct DeferredBase : Module"),functionIndex=adapter.search(/bool fixtureIsDeferred\(Module\* module\)\s*\{/);assert.ok(baseIndex>=0&&functionIndex>baseIndex);assert.doesNotMatch(adapter,/void init\s*\(\s*Plugin\s*\*/);const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();wasm.rack_web_set_input_connected(0,1);wasm.rack_web_set_input_channels(0,1);new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),128)[0]=3;wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],6)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("free helpers keep referenced globals while unbraced native display branches are stripped",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-global-ui-branch-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"GlobalUiBranch",name:"Global UI branch",description:"Referenced helper globals with optional native UI",tags:["Utility"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);
  fs.writeFileSync(path.join(plugin,"src","GlobalUiBranch.cpp"),'#include "plugin.hpp"\nstruct HelperDisplay { void touch() {} };\nstatic const char helperDigits[] = "0123";\nfloat helperWithGlobal(float value) { return value + float(helperDigits[1] - \'0\'); }\nstruct GlobalUiBranchModule : Module { enum ParamIds { NUM_PARAMS }; enum InputIds { SIGNAL_INPUT, NUM_INPUTS }; enum OutputIds { SIGNAL_OUTPUT, NUM_OUTPUTS }; enum LightIds { NUM_LIGHTS }; HelperDisplay* display = nullptr; GlobalUiBranchModule() { config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS); } void process(const ProcessArgs&) override; };\nvoid GlobalUiBranchModule::process(const ProcessArgs&) { if (display) display->touch(); else outputs[SIGNAL_OUTPUT].setVoltage(helperWithGlobal(inputs[SIGNAL_INPUT].getVoltage())); for (int index = 0; index < 1; ++index) display->touch(); }\nstruct GlobalUiBranchWidget : ModuleWidget {};\nModel* modelGlobalUiBranch = createModel<GlobalUiBranchModule, GlobalUiBranchWidget>("GlobalUiBranch");\n');
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/GlobalUiBranch","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"});const adapter=fs.readFileSync(path.join(output,"adapter.cpp"),"utf8"),globalIndex=adapter.indexOf('helperDigits[] = "0123"'),helperIndex=adapter.indexOf("float helperWithGlobal(float value)");assert.ok(globalIndex>=0&&helperIndex>globalIndex);assert.doesNotMatch(adapter,/HelperDisplay|\bdisplay\b/);const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();wasm.rack_web_set_input_connected(0,1);wasm.rack_web_set_input_channels(0,1);wasm.rack_web_set_output_connected(0,1);new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),128)[0]=2;wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],3)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("plugin-defined DSP base classes, aliases, and template arguments are collected transitively",()=>{
  const output=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-inherited-test-"));
  const stdout=execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/Inherited","--manifest-file",path.join(source,"plugin.json"),"--source-dir",source,"--output",output,"--compile","--use-rust-analysis"],{encoding:"utf8"}),report=JSON.parse(stdout);
  assert.deepEqual(report.detected.inheritance,{directBase:"FixtureForwardedBase",secondaryBases:[],chain:[{name:"FixtureDspBase",base:"Module",missing:false},{name:"FixtureForwardingBase",base:"FixtureDspBase",missing:false}]});assert.deepEqual(report.detected.dependencyFiles,[]);assert.deepEqual(report.detected.stateKeys,[]);assert.ok(report.detected.features.includes("custom-state"));assert.ok(!report.detected.features.includes("assets"));assert.match(fs.readFileSync(path.join(output,"adapter.cpp"),"utf8"),/template <class BASE>\s*struct FixtureForwardingBase : BASE/);
  const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();wasm.rack_web_set_input_connected(0,1);wasm.rack_web_set_input_channels(0,1);wasm.rack_web_set_param(0,1.5);const inputs=new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),128),outputs=new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128);inputs[0]=2;wasm.rack_web_process(1,48000);assert.equal(outputs[0],7.125);inputs[0]=2;wasm.rack_web_process(1,96000);assert.equal(outputs[0],14.25);
  fs.rmSync(output,{recursive:true,force:true});
});

test("aliased template bases preserve header SIMD, body macros, multiline enums, and brace constants",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-aliased-template-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"AliasedTemplate",name:"Aliased template",description:"Bacon-style template module fixture",tags:["Utility"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);
  fs.writeFileSync(path.join(plugin,"src","AliasedTemplateSupport.hpp"),'#pragma once\n#include <xmmintrin.h>\nnamespace vendor { struct CustomBase : Module { float scale = 2.f; }; }\ninline float headerSimdScale(float value) { __m128 lane = _mm_set1_ps(value); lane = _mm_mul_ps(lane, _mm_set1_ps(2.f)); return lane[0]; }\n');
  fs.writeFileSync(path.join(plugin,"src","AliasedTemplate.hpp"),'#pragma once\n#include "AliasedTemplateSupport.hpp"\ntemplate<typename TBase> struct AliasedTemplate : virtual TBase { static constexpr int nParams{8}, nInputs{4}; enum OutputIds { SIGNAL_OUTPUT, EXTRA_OUTPUT = SIGNAL_OUTPUT + CHANNELS +\n1, NUM_OUTPUTS }; AliasedTemplate() : TBase() { this->config(nParams, nInputs, NUM_OUTPUTS, 0); } void process(const typename TBase::ProcessArgs&) override { this->outputs[SIGNAL_OUTPUT].setVoltage(headerSimdScale(this->inputs[0].getVoltage()) * this->scale); } };\n');
  fs.writeFileSync(path.join(plugin,"src","AliasedTemplate.cpp"),'#include "plugin.hpp"\n#define CHANNELS 4\n#include "AliasedTemplate.hpp"\nnamespace bp = vendor;\nstruct AliasedTemplateWidget : ModuleWidget { using ModuleType = AliasedTemplate<bp::CustomBase>; AliasedTemplateWidget(ModuleType* module) { setModule(module); box.size = Vec(150, 380); auto layoutSize = box.size; layoutSize.x /= 2; Vec inputPosition(5, 35); auto inputSpacing = (layoutSize.x - 10) / 4; for (int input = 0; input < 4; ++input) { addInput(createInput<PJ301MPort>(inputPosition, module, input)); inputPosition.x += inputSpacing; } Vec paramPosition(10, 90); auto paramSpacing = (layoutSize.x - 20) / 2; std::vector<int> paramIds = {0, 1, 2, 3, 4, 5, 6, 7}; int param = 0; for (auto ignored : paramIds) { addParam(createParam<RoundLargeBlackKnob>(paramPosition, module, param)); if (param % 2 == 0) paramPosition.x += paramSpacing; else { paramPosition.x = 10; paramPosition.y += paramSpacing; } param++; } } };\nModel* modelAliasedTemplate = createModel<AliasedTemplateWidget::ModuleType, AliasedTemplateWidget>("AliasedTemplate");\n');
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/AliasedTemplate","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile","--use-rust-analysis"],{encoding:"utf8"});const adapter=fs.readFileSync(path.join(output,"adapter.cpp"),"utf8"),runtime=JSON.parse(fs.readFileSync(path.join(output,"runtime.json"),"utf8")),baseIndex=adapter.indexOf("struct CustomBase"),aliasIndex=adapter.indexOf("namespace bp = vendor");assert.ok(baseIndex>=0&&aliasIndex>baseIndex);assert.match(adapter,/#define CHANNELS 4/);assert.match(adapter,/template\s*<\s*typename TBase\s*>\s*struct AliasedTemplate : TBase/);assert.match(adapter,/#include <xmmintrin\.h>/);assert.equal(runtime.width,150);assert.deepEqual(runtime.inputs.map(input=>input.position),[{x:5,y:35},{x:21.25,y:35},{x:37.5,y:35},{x:53.75,y:35}]);assert.deepEqual(runtime.params.map(param=>param.position),[{x:10,y:90,widget:"RoundLargeBlackKnob"},{x:37.5,y:90,widget:"RoundLargeBlackKnob"},{x:10,y:117.5,widget:"RoundLargeBlackKnob"},{x:37.5,y:117.5,widget:"RoundLargeBlackKnob"},{x:10,y:145,widget:"RoundLargeBlackKnob"},{x:37.5,y:145,widget:"RoundLargeBlackKnob"},{x:10,y:172.5,widget:"RoundLargeBlackKnob"},{x:37.5,y:172.5,widget:"RoundLargeBlackKnob"}]);const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();assert.deepEqual([wasm.rack_web_param_count(),wasm.rack_web_input_count(),wasm.rack_web_output_count(),wasm.rack_web_light_count()],[8,4,6,0]);wasm.rack_web_set_input_connected(0,1);wasm.rack_web_set_input_channels(0,1);wasm.rack_web_set_output_connected(0,1);new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),4*16*128)[0]=3;wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),6*16*128)[0],12)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("direct implementation includes keep SSE3 DSP and comma-declared widget arrays",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-direct-implementation-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"DirectImplementation",name:"Direct implementation",description:"Directly included implementation fixture",tags:["Utility"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);
  fs.writeFileSync(path.join(plugin,"src","DirectFrame.hpp"),'#pragma once\nstruct DirectFrame { float value; float apply(float input); };\n#include "DirectFrame.inl"\n');
  fs.writeFileSync(path.join(plugin,"src","DirectFrame.inl"),'#pragma once\ninline float DirectFrame::apply(float input) { return input + value; }\n');
  fs.writeFileSync(path.join(plugin,"src","DirectDspOnly.hpp"),'#pragma once\nstruct DirectDspOnly { float bias; };\n');
  fs.writeFileSync(path.join(plugin,"src","DirectNestedLeaf.hpp"),'#pragma once\nstruct DirectNestedLeaf { float apply(float value); };\n#ifdef DIRECT_NESTED_IMPLEMENTATION\ninline float DirectNestedLeaf::apply(float value) { return value + 1.f; }\n#endif\n');
  fs.writeFileSync(path.join(plugin,"src","DirectNestedLeaf.cpp"),'#define DIRECT_NESTED_IMPLEMENTATION\n#include "DirectNestedLeaf.hpp"\n');
  fs.writeFileSync(path.join(plugin,"src","DirectNested.cpp"),'#include "DirectNestedLeaf.cpp"\nstruct DirectNested { float apply(float value) { return DirectNestedLeaf{}.apply(value); } };\n');
  fs.writeFileSync(path.join(plugin,"src","DirectNativeOnly.cpp"),'#error An inactive native implementation must not enter the browser adapter\n');
  fs.writeFileSync(path.join(plugin,"src","DirectDsp.cpp"),'#include <pmmintrin.h>\n#ifdef _WIN32\n#include <windows.h>\n#endif\n#include "DirectFrame.hpp"\n#include "DirectDspOnly.hpp"\n#include "DirectNested.cpp"\nstruct DirectDsp { float apply(float value) { DirectFrame frame{value}; DirectDspOnly support{0.f}; unsigned csr = _mm_getcsr(); _mm_setcsr(csr); __m128 lanes = _mm_set1_ps(frame.apply(DirectNested{}.apply(value)) + support.bias); lanes = _mm_hadd_ps(lanes, lanes); return lanes[0] - value; } };\n');
  fs.writeFileSync(path.join(plugin,"src","DirectImplementation.cpp"),'#include "plugin.hpp"\n#ifdef _WIN32\n#include "DirectNativeOnly.cpp"\n#endif\n#include "DirectDsp.cpp"\nstruct DirectImplementationModule : Module { enum ParamIds { LEVEL_PARAM, NUM_PARAMS }; enum InputIds { SIGNAL_INPUT, NUM_INPUTS }; enum OutputIds { SIGNAL_OUTPUT, NUM_OUTPUTS }; enum LightIds { NUM_LIGHTS }; DirectFrame scratch{}; DirectImplementationModule() { config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS); configParam(LEVEL_PARAM, 0.f, 1.f, .5f, "Level"); configInput(SIGNAL_INPUT, "Signal"); configOutput(SIGNAL_OUTPUT, "Signal"); } void process(const ProcessArgs&) override { scratch.value = inputs[SIGNAL_INPUT].getVoltage(); outputs[SIGNAL_OUTPUT].setVoltage(DirectDsp{}.apply(scratch.value)); } };\nstruct DirectImplementationWidget : ModuleWidget { DirectImplementationWidget(DirectImplementationModule* module) { setModule(module); box.size = Vec(45, 380); constexpr float portX[1] = { 5.f }, knobX[1] = { 20.f }; addInput(createInput<PJ301MPort>(Vec(portX[0], 35.f), module, DirectImplementationModule::SIGNAL_INPUT)); addParam(createParam<RoundBlackKnob>(Vec(knobX[0], 90.f), module, DirectImplementationModule::LEVEL_PARAM)); addOutput(createOutput<PJ301MPort>(Vec(portX[0], 320.f), module, DirectImplementationModule::SIGNAL_OUTPUT)); } };\nModel* modelDirectImplementation = createModel<DirectImplementationModule, DirectImplementationWidget>("DirectImplementation");\n');
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/DirectImplementation","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"});const runtime=JSON.parse(fs.readFileSync(path.join(output,"runtime.json"),"utf8")),adapter=fs.readFileSync(path.join(output,"adapter.cpp"),"utf8"),implementationMacro="#define DIRECT_NESTED_IMPLEMENTATION",leafInclude='#include "DirectNestedLeaf.hpp"';assert.match(adapter,/struct DirectDsp/);assert.equal(adapter.split(implementationMacro).length-1,1);assert.ok(adapter.includes(leafInclude));assert.ok(adapter.indexOf(implementationMacro)<adapter.indexOf(leafInclude));assert.ok(adapter.indexOf(leafInclude)<adapter.indexOf("struct DirectNested {"));assert.match(adapter,/#include "DirectDspOnly\.hpp"/);assert.match(adapter,/inline float DirectFrame::apply\(float input\)/);assert.doesNotMatch(adapter,/#include "DirectFrame\.inl"|DirectNativeOnly|windows\.h/);assert.ok(adapter.indexOf("struct DirectFrame")<adapter.indexOf("DirectFrame::apply"));assert.deepEqual(runtime.inputs[0].position,{x:5,y:35});assert.deepEqual(runtime.params[0].position,{x:20,y:90,widget:"RoundBlackKnob"});assert.deepEqual(runtime.outputs[0].position,{x:5,y:320});const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();wasm.rack_web_set_input_connected(0,1);wasm.rack_web_set_input_channels(0,1);wasm.rack_web_set_output_connected(0,1);new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),128)[0]=2;wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],8)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("constructor heap pressure retries memory and WASI logging stays browser-loadable",()=>{
  const output=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-heap-test-"));
  execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/Heap","--manifest-file",path.join(source,"plugin.json"),"--source-dir",source,"--output",output,"--compile"],{encoding:"utf8"});
  const runtime=JSON.parse(fs.readFileSync(path.join(output,"runtime.json"),"utf8")),wasmModule=new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),imports=WebAssembly.Module.imports(wasmModule);
  assert.equal(runtime.runtime.initialMemory,8388608);assert.deepEqual(imports,[{module:"wasi_snapshot_preview1",name:"fd_write",kind:"function"}]);
  const holder={runtime:null},wasm=new WebAssembly.Instance(wasmModule,{wasi_snapshot_preview1:{fd_write(_fd,iovecs,iovecCount,written){const view=new DataView(holder.runtime.memory.buffer);let bytes=0;for(let index=0;index<iovecCount;index++)bytes+=view.getUint32(iovecs+index*8+4,true);view.setUint32(written,bytes,true);return 0}}}).exports;holder.runtime=wasm;wasm._initialize();wasm.rack_web_set_input_connected(0,1);wasm.rack_web_set_input_channels(0,1);new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),128)[0]=2.25;wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],2.25);
  fs.rmSync(output,{recursive:true,force:true});
});

test("legacy SSE modules embed locked binary ROMs and retry link-time memory",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-sse-rom-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"EmbeddedSse",name:"Embedded SSE",description:"SIMD ROM fixture",tags:["Oscillator"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);
  const rom=Buffer.alloc(5*1024*1024);rom.fill(Buffer.from([0,0,0,64]));fs.writeFileSync(path.join(plugin,"src","TEST.bin"),rom);fs.writeFileSync(path.join(plugin,"src","EmbeddedSseResources.hpp"),'#pragma once\n#include <common.hpp>\nBINARY(src_TEST_bin);\nstatic float* embeddedWavetables[1] = {(float*)BINARY_START(src_TEST_bin)};\nstatic int32_t embeddedWavetableSizes[1] = {1310720};\n');fs.writeFileSync(path.join(plugin,"src","EmbeddedSse.cpp"),'#include "plugin.hpp"\n#include "EmbeddedSseResources.hpp"\nstruct EmbeddedSseModule : Module { enum ParamIds { NUM_PARAMS }; enum InputIds { SIGNAL_INPUT, NUM_INPUTS }; enum OutputIds { SIGNAL_OUTPUT, NUM_OUTPUTS }; enum LightIds { NUM_LIGHTS }; EmbeddedSseModule() { config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS); } void process(const ProcessArgs&) override { auto input = inputs[SIGNAL_INPUT].getPolyVoltageSimd<simd::float_4>(0); int index = clamp((int)std::fabs(input[0]) * 1024, 0, embeddedWavetableSizes[0] - 1); __m128 scale = sse_mathfun_exp_ps(sse_mathfun_log_ps(_mm_set1_ps(embeddedWavetables[0][index]))); __m64 mask = _mm_set1_pi16(0x7fff); mask = _mm_or_si64(mask, mask); (void)mask; simd::float_4 result = _mm_mul_ps(input.v, scale); outputs[SIGNAL_OUTPUT].setVoltageSimd(result, 0); } };\nstruct EmbeddedSseWidget : ModuleWidget {};\nModel* modelEmbeddedSse = createModel<EmbeddedSseModule, EmbeddedSseWidget>("EmbeddedSse");\n');
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/EmbeddedSse","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"});const runtime=JSON.parse(fs.readFileSync(path.join(output,"runtime.json"),"utf8")),adapter=fs.readFileSync(path.join(output,"adapter.cpp"),"utf8");assert.ok(runtime.runtime.initialMemory>4194304);assert.match(adapter,/rackWebBinary_src_TEST_bin/);assert.match(adapter,/-msimd128|Rack Web SSE compatibility/);const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();wasm.rack_web_set_input_connected(0,1);wasm.rack_web_set_input_channels(0,1);new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),128)[0]=3;wasm.rack_web_process(1,48000);assert.ok(Math.abs(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0]-6)<1e-5)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("pure expander modules inherit enums and compile the message-buffer ABI",()=>{
  const output=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-expander-only-test-"));
  const stdout=execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/ExpanderOnly","--manifest-file",path.join(source,"plugin.json"),"--source-dir",source,"--output",output,"--compile"],{encoding:"utf8"}),report=JSON.parse(stdout),runtime=JSON.parse(fs.readFileSync(path.join(output,"runtime.json"),"utf8"));
  assert.equal(report.detected.enums.params.identifiers.at(-1),"EXP_PARAMS_LEN");assert.equal(report.detected.enums.inputs.identifiers.at(-1),"EXP_INPUTS_LEN");assert.equal(report.detected.enums.outputs.identifiers.at(-1),"EXP_OUTPUTS_LEN");assert.equal(report.assessment.compileEligible,true);assert.deepEqual(report.assessment.blockers,[]);assert.equal(runtime.runtime.expanderMode,"message-buffer");const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();assert.equal(wasm.rack_web_message_capacity(),32768);assert.equal(typeof wasm.rack_web_process_frame,"function");
  fs.rmSync(output,{recursive:true,force:true});
});

test("message-buffer neighbors use model identity without importing sibling DSP",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-message-neighbor-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"Neighbor",name:"Neighbor sampler",description:"A deliberately browser-incompatible sibling",tags:["Sampler"]},{slug:"MessageOnly",name:"Message-only expander",description:"An expander that needs only its neighbor model identity",tags:["Expander"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);
  fs.writeFileSync(path.join(plugin,"src","Neighbor.cpp"),'#include "plugin.hpp"\nstruct Neighbor : Module { MissingFilesystemSampler sample; }; struct NeighborWidget : ModuleWidget {}; Model* modelNeighbor = createModel<Neighbor, NeighborWidget>("Neighbor");\n');
  fs.writeFileSync(path.join(plugin,"src","MessageOnly.cpp"),'#include "plugin.hpp"\nextern Model* modelNeighbor;\nstruct MessageOnly : Module { struct Message { float value = 0.f; }; enum OutputIds { SIGNAL_OUTPUT, NUM_OUTPUTS }; Model* neighborModel = nullptr; MessageOnly() { config(0, 0, NUM_OUTPUTS, 0); neighborModel = rack::plugin::getModel("FixturePlugin", "Neighbor"); rightExpander.producerMessage = new Message; rightExpander.consumerMessage = new Message; } void process(const ProcessArgs&) override { if (rightExpander.module && rightExpander.module->model == neighborModel && neighborModel == modelNeighbor) { auto* message = static_cast<Message*>(rightExpander.consumerMessage); outputs[SIGNAL_OUTPUT].setVoltage(message->value); } } }; struct MessageOnlyWidget : ModuleWidget {}; Model* modelMessageOnly = createModel<MessageOnly, MessageOnlyWidget>("MessageOnly");\n');
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/MessageOnly","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"});const adapter=fs.readFileSync(path.join(output,"adapter.cpp"),"utf8"),runtime=JSON.parse(fs.readFileSync(path.join(output,"runtime.json"),"utf8")),wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;assert.doesNotMatch(adapter,/MissingFilesystemSampler|struct Neighbor\s*:|rack::plugin::getModel/);assert.match(adapter,/neighborModel = modelNeighbor/);assert.deepEqual(runtime.runtime.expander.models,[{key:"FixturePlugin/Neighbor",symbol:"modelNeighbor",index:0}]);wasm._initialize();assert.equal(wasm.rack_web_message_capacity(),32768)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("pure UI secondary bases and VCV enum names do not leak into WASM",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-ui-secondary-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"UiSecondary",name:"UI secondary",description:"UI listener stripping fixture",tags:["Utility"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);
  fs.writeFileSync(path.join(plugin,"src","UiSecondary.cpp"),'#include "plugin.hpp"\nenum ThemeId { VCV, LIGHT, DARK }; struct DrawListener { virtual void draw(const widget::Widget::DrawArgs&) = 0; }; struct UiSecondaryModule : Module, DrawListener { enum InputIds { SIGNAL_INPUT, NUM_INPUTS }; enum OutputIds { SIGNAL_OUTPUT, NUM_OUTPUTS }; ThemeId theme = ThemeId::VCV; UiSecondaryModule() { config(0, NUM_INPUTS, NUM_OUTPUTS, 0); } void draw(const widget::Widget::DrawArgs&) override {} void process(const ProcessArgs&) override { outputs[SIGNAL_OUTPUT].setVoltage(inputs[SIGNAL_INPUT].getVoltage() + (theme == ThemeId::VCV ? 1.f : 0.f)); } }; struct UiSecondaryWidget : ModuleWidget {}; Model* modelUiSecondary = createModel<UiSecondaryModule, UiSecondaryWidget>("UiSecondary");\n');
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/UiSecondary","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"});const adapter=fs.readFileSync(path.join(output,"adapter.cpp"),"utf8"),wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;assert.doesNotMatch(adapter,/DrawListener|DrawArgs|\bdraw\s*\(/);assert.match(adapter,/ThemeId::VCV/);wasm._initialize();wasm.rack_web_set_input_connected(0,1);wasm.rack_web_set_input_channels(0,1);wasm.rack_web_set_output_connected(0,1);new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),128)[0]=2;wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],3)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("included header DSP state and duplicate port metadata survive direct adapter generation",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-header-state-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"HeaderState",name:"Header state",description:"Included DSP state and duplicate metadata fixture",tags:["Sample and hold"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);
  fs.writeFileSync(path.join(plugin,"src","HeaderStateMacros.hpp"),"#define HEADER_STATE_WIDTH 2\n");
  fs.writeFileSync(path.join(plugin,"src","HeaderStateStorage.hpp"),'float headerStateOffset[HEADER_STATE_WIDTH] = {1.f, 2.f};\n');
  fs.writeFileSync(path.join(plugin,"src","HeaderState.hpp"),'#if !defined(HEADER_STATE_HPP)\n#define HEADER_STATE_HPP 1\nrack::dsp::SchmittTrigger headerStateTrigger; float headerStateHeld = 0.f;\n  #include "HeaderStateStorage.hpp" // nested class-body state\n#endif\n');
  fs.writeFileSync(path.join(plugin,"src","HeaderState.cpp"),'#include "plugin.hpp"\nstruct HeaderStateModule : Module { enum InputIds { SAMPLE_INPUT, TRIGGER_INPUT, NUM_INPUTS }; enum OutputIds { A_OUTPUT, B_OUTPUT, NUM_OUTPUTS };\n  #include "HeaderState.hpp" // DSP state is intentionally included inside the module class\nHeaderStateModule() { config(0, NUM_INPUTS, NUM_OUTPUTS, 0); configInput(SAMPLE_INPUT, "Sample"); configInput(TRIGGER_INPUT, "Trigger"); configOutput(A_OUTPUT, "Output A"); configOutput(A_OUTPUT, "Output B"); } void process(const ProcessArgs&) override { if (headerStateTrigger.process(inputs[TRIGGER_INPUT].getVoltage())) headerStateHeld = inputs[SAMPLE_INPUT].getVoltage(); outputs[A_OUTPUT].setVoltage(headerStateHeld); outputs[B_OUTPUT].setVoltage(headerStateHeld + headerStateOffset[0]); } };\nstruct HeaderStateWidget : ModuleWidget { HeaderStateWidget(HeaderStateModule* module) { setModule(module); box.size = Vec(75, 380); addInput(createInputCentered<PJ301MPort>(Vec(20, 80), module, HeaderStateModule::SAMPLE_INPUT)); addInput(createInputCentered<PJ301MPort>(Vec(55, 80), module, HeaderStateModule::TRIGGER_INPUT)); addOutput(createOutputCentered<PJ301MPort>(Vec(20, 300), module, HeaderStateModule::A_OUTPUT)); addOutput(createOutputCentered<PJ301MPort>(Vec(55, 300), module, HeaderStateModule::B_OUTPUT)); } };\nModel* modelHeaderState = createModel<HeaderStateModule, HeaderStateWidget>("HeaderState");\n');
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/HeaderState","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"});const adapter=fs.readFileSync(path.join(output,"adapter.cpp"),"utf8"),runtime=JSON.parse(fs.readFileSync(path.join(output,"runtime.json"),"utf8"));assert.match(adapter,/#define HEADER_STATE_WIDTH 2/);assert.doesNotMatch(adapter,/#define HEADER_STATE_HPP/);assert.match(adapter,/SchmittTrigger headerStateTrigger/);assert.match(adapter,/float headerStateHeld = 0\.f/);assert.match(adapter,/float headerStateOffset\[HEADER_STATE_WIDTH\]/);assert.deepEqual(runtime.outputs.map(port=>port.name),["Output A","Output B"]);const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();for(let input=0;input<2;input++){wasm.rack_web_set_input_connected(input,1);wasm.rack_web_set_input_channels(input,1)}for(let output=0;output<2;output++)wasm.rack_web_set_output_connected(output,1);const inputs=new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),2*16*128),outputs=new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),2*16*128);inputs[0]=3;wasm.rack_web_process(1,48000);inputs[128]=10;wasm.rack_web_process(1,48000);assert.deepEqual([outputs[0],outputs[128]],[3,4])}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("cross-file DSP closure keeps only required sibling types and nested engines",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-cross-file-dsp-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"CrossFileDsp",name:"Cross-file DSP",description:"Selective sibling implementation fixture",tags:["Utility"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);
  fs.writeFileSync(path.join(plugin,"src","CrossFileDspSupport.hpp"),'#pragma once\nnamespace fixture_dsp { struct Slew { float next(float value); }; struct SlewLimiter { float next(float value) { return value * 2.f; } }; struct SpectralAnalyzer { float process(float value); }; }\n');
  fs.writeFileSync(path.join(plugin,"src","CrossFileDspUnused.cpp"),'#include "CrossFileDspSupport.hpp"\nnamespace fixture_dsp { float Slew::next(float value) { return MissingSlewBackend::apply(value); } float SpectralAnalyzer::process(float value) { return MissingAnalyzerBackend::apply(value); } }\n');
  fs.writeFileSync(path.join(plugin,"src","CrossFileDsp.cpp"),'#include "plugin.hpp"\n#include "CrossFileDspSupport.hpp"\nstruct CrossFileDspModule : Module { enum InputIds { SIGNAL_INPUT, NUM_INPUTS }; enum OutputIds { SIGNAL_OUTPUT, NUM_OUTPUTS }; struct Engine { float apply(float value) { return value + 1.f; } }; fixture_dsp::SlewLimiter limiter; Engine engine; CrossFileDspModule() { config(0, NUM_INPUTS, NUM_OUTPUTS, 0); configInput(SIGNAL_INPUT, "Signal"); configOutput(SIGNAL_OUTPUT, "Signal"); } void process(const ProcessArgs&) override { outputs[SIGNAL_OUTPUT].setVoltage(limiter.next(engine.apply(inputs[SIGNAL_INPUT].getVoltage()))); } };\nstruct NeighborModule : Module { struct Engine { float apply(float value) { return value + 100.f; } }; };\nstruct CrossFileDspWidget : ModuleWidget { CrossFileDspWidget(CrossFileDspModule* module) { setModule(module); box.size = Vec(75, 380); } };\nModel* modelCrossFileDsp = createModel<CrossFileDspModule, CrossFileDspWidget>("CrossFileDsp");\n');
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/CrossFileDsp","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"});const adapter=fs.readFileSync(path.join(output,"adapter.cpp"),"utf8");assert.match(adapter,/struct SlewLimiter/);assert.match(adapter,/return value \* 2\.f/);assert.doesNotMatch(adapter,/Slew::next|SpectralAnalyzer::process|MissingSlewBackend|MissingAnalyzerBackend|value \+ 100\.f/);const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();wasm.rack_web_set_input_connected(0,1);wasm.rack_web_set_input_channels(0,1);new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),128)[0]=3;wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],8)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("referenced sibling modules are selected from Rust type declarations",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-rust-sibling-fact-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"RustSiblingFact",name:"Rust sibling fact",description:"Rust declaration-backed sibling module fixture",tags:["Utility"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);
  fs.writeFileSync(path.join(plugin,"src","RustSiblingFact.cpp"),'#include "plugin.hpp"\nstruct RustSiblingFactModule : Module { enum InputIds { SIGNAL_INPUT, NUM_INPUTS }; enum OutputIds { SIGNAL_OUTPUT, NUM_OUTPUTS }; RustSiblingFactModule() { config(0, NUM_INPUTS, NUM_OUTPUTS, 0); configInput(SIGNAL_INPUT, "Signal"); configOutput(SIGNAL_OUTPUT, "Signal"); } void process(const ProcessArgs&) override; };\nstruct RustSiblingBridgeModule final : public Module { static float transform(float value) { return value * 3.f; } };\nvoid RustSiblingFactModule::process(const ProcessArgs&) { outputs[SIGNAL_OUTPUT].setVoltage(RustSiblingBridgeModule::transform(inputs[SIGNAL_INPUT].getVoltage())); }\nstruct RustSiblingFactWidget : ModuleWidget {};\nModel* modelRustSiblingFact = createModel<RustSiblingFactModule, RustSiblingFactWidget>("RustSiblingFact");\n');
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/RustSiblingFact","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"});const adapter=fs.readFileSync(path.join(output,"adapter.cpp"),"utf8"),wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;assert.match(adapter,/struct RustSiblingBridgeModule : Module/);assert.match(adapter,/RustSiblingBridgeModule::transform/);wasm._initialize();wasm.rack_web_set_input_connected(0,1);wasm.rack_web_set_input_channels(0,1);wasm.rack_web_set_output_connected(0,1);new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),128)[0]=2;wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],6)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("secondary bases retain namespaces and nested quantity implementations without menu UI",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-secondary-base-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"SecondaryBase",name:"Secondary base",description:"Namespaced secondary base fixture",tags:["Utility"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);
  fs.writeFileSync(path.join(plugin,"src","SecondaryRange.hpp"),'#pragma once\nnamespace fixture_secondary { struct Range { float scale = 2.f; struct RangeParamQuantity : ParamQuantity { float getDisplayValue() override; void setDisplayValue(float value) override; }; }; struct RangeOptionMenuItem : MenuItem { void onAction(const event::Action&) override {} }; }\n');
  fs.writeFileSync(path.join(plugin,"src","SecondaryRange.cpp"),'#include "SecondaryRange.hpp"\nusing namespace fixture_secondary;\nfloat Range::RangeParamQuantity::getDisplayValue() { return getValue() * 2.f; }\nvoid Range::RangeParamQuantity::setDisplayValue(float value) { setValue(value / 2.f); }\n');
  fs.writeFileSync(path.join(plugin,"src","SecondaryBase.cpp"),'#include "plugin.hpp"\n#include "SecondaryRange.hpp"\nnamespace fixture_secondary { struct Primary : Module { Primary() {} }; struct SecondaryBaseModule : Primary, Range { enum ParamIds { LEVEL_PARAM, NUM_PARAMS }; enum OutputIds { SIGNAL_OUTPUT, NUM_OUTPUTS }; SecondaryBaseModule() { config(NUM_PARAMS, 0, NUM_OUTPUTS, 0); configParam<RangeParamQuantity>(LEVEL_PARAM, 0.f, 1.f, .25f, "Level"); configOutput(SIGNAL_OUTPUT, "Signal"); } void process(const ProcessArgs&) override { outputs[SIGNAL_OUTPUT].setVoltage(params[LEVEL_PARAM].getValue() * scale); } }; struct SecondaryBaseWidget : ModuleWidget {}; }\nModel* modelSecondaryBase = createModel<fixture_secondary::SecondaryBaseModule, fixture_secondary::SecondaryBaseWidget>("SecondaryBase");\n');
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/SecondaryBase","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"});const adapter=fs.readFileSync(path.join(output,"adapter.cpp"),"utf8"),quantityDefinitions=[...adapter.matchAll(/Range::RangeParamQuantity::(?:get|set)DisplayValue\s*\(/g)];assert.equal(quantityDefinitions.length,2);assert.match(adapter,/namespace fixture_secondary\s*\{\s*struct Range/);assert.doesNotMatch(adapter,/RangeOptionMenuItem|MenuItem|event::Action/);const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();wasm.rack_web_set_param(0,.75);wasm.rack_web_set_output_connected(0,1);wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],1.5)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("Makefile SIMD template specializations precede use without inactive generic implementations",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-simd-template-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"SimdTemplate",name:"SIMD template",description:"Conditional template specialization fixture",tags:["Utility"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);fs.writeFileSync(path.join(plugin,"Makefile"),"ifndef NO_RACK_SIMD\nFLAGS += -DRACK_SIMD=1\nendif\n");fs.writeFileSync(path.join(plugin,"CMakeLists.txt"),'set(FIXTURE_CMAKE_SCALE 3 CACHE STRING "scale")\n');
  fs.writeFileSync(path.join(plugin,"src","SimdBank.hpp"),'#pragma once\nnamespace fixture_simd { #ifdef RACK_SIMD\nstruct Lane { float next(float value); };\n#endif\ntemplate<typename T, int N> struct Bank { #ifdef RACK_SIMD\nLane lanes[N / 4];\n#else\nT lanes[N] {}; int active = N;\n#endif\nfloat next(float value); }; }\n'.replaceAll("{ #","{\n#"));
  fs.writeFileSync(path.join(plugin,"src","SimdBank.cpp"),'#include "SimdBank.hpp"\nnamespace fixture_simd {\n#ifdef RACK_SIMD\nfloat Lane::next(float value) { return value * 2.f; }\ntemplate<> float Bank<float, 4>::next(float value) { return lanes[0].next(value); }\n#else\ntemplate<typename T, int N> float Bank<T, N>::next(float value) { return value + active; }\n#endif\ntemplate struct Bank<float, 4>;\n}\n');
  fs.writeFileSync(path.join(plugin,"src","SimdTemplate.cpp"),'#include "plugin.hpp"\n#include "SimdBank.hpp"\nstruct SimdTemplateModule : Module { enum InputIds { SIGNAL_INPUT, NUM_INPUTS }; enum OutputIds { SIGNAL_OUTPUT, NUM_OUTPUTS }; fixture_simd::Bank<float, 4> bank; SimdTemplateModule() { config(0, NUM_INPUTS, NUM_OUTPUTS, 0); } void process(const ProcessArgs&) override { outputs[SIGNAL_OUTPUT].setVoltage(bank.next(inputs[SIGNAL_INPUT].getVoltage()) * FIXTURE_CMAKE_SCALE); } };\nstruct SimdTemplateWidget : ModuleWidget {};\nModel* modelSimdTemplate = createModel<SimdTemplateModule, SimdTemplateWidget>("SimdTemplate");\n');
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/SimdTemplate","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"});const adapter=fs.readFileSync(path.join(output,"adapter.cpp"),"utf8");assert.match(adapter,/template<>\s*float Bank<float, 4>::next/);assert.doesNotMatch(adapter,/template<typename T, int N>\s*float Bank<T, N>::next|template struct Bank<float, 4>/);const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();wasm.rack_web_set_input_connected(0,1);wasm.rack_web_set_input_channels(0,1);wasm.rack_web_set_output_connected(0,1);new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),128)[0]=3;wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],18)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("MetaModule generic registrations compile their DSP core and element metadata",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-metamodule-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output"),inferredOutput=path.join(temporary,"inferred-output"),src=path.join(plugin,"src"),modules=path.join(src,"modules"),info=path.join(modules,"info"),counter=path.join(plugin,"metamodule-plugin-sdk","metamodule-core-interface","CoreModules","elements");fs.mkdirSync(info,{recursive:true});fs.mkdirSync(counter,{recursive:true});
  fs.writeFileSync(path.join(plugin,"plugin.json"),JSON.stringify({slug:"FixtureMeta",name:"Fixture Meta",version:"1.0.0",license:"MIT",sourceUrl:"https://github.com/example/fixture-meta",modules:[{slug:"GenericKick",name:"Generic Kick",description:"Generic MetaModule fixture",tags:["Drum"]}]},null,2));
  fs.writeFileSync(path.join(counter,"element_counter.hh"),'#pragma once\nnamespace ElementCount { template<class Info> consteval auto count() { return Info::counts; } }\n');
  fs.writeFileSync(path.join(info,"GenericKick_info.hh"),'#pragma once\n#include <array>\n#include <string_view>\n#include <variant>\nnamespace MetaModule {\nenum Coords { Center, TopLeft };\ntemplate<int DPI> constexpr float to_mm(float value) { return value * 25.4f / DPI; }\nstruct BaseElement { float x; float y; Coords coords; std::string_view short_name; std::string_view long_name; };\nstruct Knob9mm { BaseElement base; float value; constexpr Knob9mm(BaseElement b, float v=.5f, float=0, float=1, std::string_view=\"\"):base(b),value(v){} };\nstruct WhiteMomentary7mm { BaseElement base; constexpr WhiteMomentary7mm(BaseElement b):base(b){} };\nstruct GateJackInput4ms { BaseElement base; constexpr GateJackInput4ms(BaseElement b):base(b){} };\nstruct AnalogJackOutput4ms { BaseElement base; constexpr AnalogJackOutput4ms(BaseElement b):base(b){} };\nusing Element=std::variant<Knob9mm,WhiteMomentary7mm,GateJackInput4ms,AnalogJackOutput4ms>;\nstruct FixtureCounts { unsigned num_params; unsigned num_lights; unsigned num_inputs; unsigned num_outputs; };\nstruct GenericKickInfo { static constexpr unsigned width_hp=4; static constexpr FixtureCounts counts{2,1,1,1}; static constexpr std::array<Element,4> Elements{{\nKnob9mm{{to_mm<96>(38.4),to_mm<96>(64),Center,\"Tone\",\"\"},.25f,0,1,\"%\"},\nWhiteMomentary7mm{{to_mm<96>(38.4),to_mm<96>(192),Center,\"Trigger\",\"\"}},\nGateJackInput4ms{{to_mm<96>(38.4),to_mm<96>(320),Center,\"Trigger In\",\"\"}},\nAnalogJackOutput4ms{{to_mm<96>(38.4),to_mm<96>(416),Center,\"Audio Out\",\"\"}}\n}}; };\n}\n');
  fs.writeFileSync(path.join(modules,"GenericKick.hh"),'#pragma once\n#include "info/GenericKick_info.hh"\n#include "CoreModules/elements/element_counter.hh"\nnamespace MetaModule { class GenericKickCore { float level=.25f,input=0; public: void set_param(int id,float value){if(id==0)level=value;} void set_input(int,float value){input=value;} void set_samplerate(float){} void update(){} float get_output(int)const{return input+level;} float get_led_brightness(int)const{return level;} void mark_all_inputs_unpatched(){} void mark_all_outputs_unpatched(){} void mark_input_patched(int){} void mark_input_unpatched(int){} void mark_output_patched(int){} void mark_output_unpatched(int){} }; }\n');
  const registrationFile=path.join(src,"plugin.cpp");fs.writeFileSync(registrationFile,'template<class Info,class Core> struct GenericModule { static int create(); struct Widget {}; };\nusing namespace MetaModule;\nint* modelGenericKick = GenericModule<GenericKickInfo, GenericKickCore>::create();\n');
  try{const verify=targetOutput=>{const report=JSON.parse(execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixtureMeta/GenericKick","--manifest-file",path.join(plugin,"plugin.json"),"--source-dir",plugin,"--output",targetOutput,"--compile"],{encoding:"utf8"})),runtime=JSON.parse(fs.readFileSync(path.join(targetOutput,"runtime.json"),"utf8"));assert.equal(report.assessment.strategy,"metamodule-core-adapter");assert.equal(report.detected.architecture,"metamodule-generic-core");assert.deepEqual(report.detected.counts,{params:2,inputs:1,outputs:1,lights:1});assert.equal(runtime.width,60);assert.deepEqual(runtime.params.map(param=>[param.name,param.default,param.position]),[["Tone",.25,{x:30,y:50,centered:true,widget:"RoundBlackKnob"}],["Trigger",0,{x:30,y:150,centered:true,widget:"VCVButton"}]]);assert.deepEqual(runtime.inputs,[{id:0,name:"Trigger In",position:{x:30,y:250,centered:true},kind:"gate"}]);assert.deepEqual(runtime.outputs,[{id:0,name:"Audio Out",position:{x:30,y:325,centered:true},kind:"audio"}]);const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(targetOutput,"module.wasm"))),{}).exports;wasm._initialize();assert.deepEqual([wasm.rack_web_param_count(),wasm.rack_web_input_count(),wasm.rack_web_output_count(),wasm.rack_web_light_count()],[2,1,1,1]);wasm.rack_web_set_input_connected(0,1);wasm.rack_web_set_input_channels(0,1);new Float32Array(wasm.memory.buffer,wasm.rack_web_input_buffer(),128)[0]=2;wasm.rack_web_set_param(0,.75);wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],2.75);return report};verify(output);fs.writeFileSync(registrationFile,'template<class Info> struct GenericModule { static int create(); struct Widget {}; };\nusing namespace MetaModule;\nint* modelGenericKick = GenericModule<GenericKickInfo>::create();\n');const inferred=verify(inferredOutput);assert.equal(inferred.source.moduleClass,"GenericKickCore")}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("NanoSVG source modules retain the SDK parser and standard formatting headers",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-nanosvg-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"SvgPath",name:"SVG path",description:"NanoSVG parser fixture",tags:["Utility"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);
  fs.writeFileSync(path.join(plugin,"src","SvgPath.cpp"),'#include "plugin.hpp"\n#include <nanosvg.h>\n#include <iomanip>\nstruct SvgPathModule : Module { enum OutputIds { X_OUTPUT, NUM_OUTPUTS }; float maximum = -1.f; SvgPathModule() { config(0, 0, NUM_OUTPUTS, 0); configOutput(X_OUTPUT, "X"); char svg[] = "<svg width=\\"20\\" height=\\"10\\"><path d=\\"M2 3 L12 3 L12 8 Z\\"/></svg>"; NSVGimage* image = nsvgParse(svg, "px", 96.f); if (image && image->shapes && image->shapes->paths) maximum = image->shapes->paths->bounds[2]; std::stringstream label; label << std::fixed << std::setprecision(1) << maximum; if (label.str() != "12.0") maximum = -2.f; nsvgDelete(image); } void process(const ProcessArgs&) override { outputs[X_OUTPUT].setVoltage(maximum); } };\nstruct SvgPathWidget : ModuleWidget { SvgPathWidget(SvgPathModule* module) { setModule(module); box.size = Vec(75, 380); addOutput(createOutputCentered<PJ301MPort>(Vec(37.5, 330), module, SvgPathModule::X_OUTPUT)); } };\nModel* modelSvgPath = createModel<SvgPathModule, SvgPathWidget>("SvgPath");\n');
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/SvgPath","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"});const adapter=fs.readFileSync(path.join(output,"adapter.cpp"),"utf8"),module=new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm")));assert.match(adapter,/#define NANOSVG_IMPLEMENTATION\s*#include <nanosvg\.h>\s*#include <iomanip>/);assert.deepEqual(WebAssembly.Module.imports(module).map(item=>item.name),["fd_close","environ_sizes_get","environ_get"]);const holder={wasm:null},instance=new WebAssembly.Instance(module,{wasi_snapshot_preview1:{fd_close(){return 0},environ_sizes_get(count,size){const view=new DataView(holder.wasm.memory.buffer);view.setUint32(count,0,true);view.setUint32(size,0,true);return 0},environ_get(){return 0}}}),wasm=instance.exports;holder.wasm=wasm;wasm._initialize();wasm.rack_web_set_output_connected(0,1);wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],12)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("read-only plugin binary assets are embedded without desktop filesystem or PFFFT",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-binary-asset-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"BinaryAsset",name:"Binary asset",description:"Read-only binary fixture",tags:["Utility"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);fs.mkdirSync(path.join(plugin,"res"),{recursive:true});const binary=Buffer.alloc(4);binary.writeFloatLE(.25);fs.writeFileSync(path.join(plugin,"res","constant.f32"),binary);
  fs.writeFileSync(path.join(plugin,"src","BinaryAsset.cpp"),'#include "plugin.hpp"\n#include <pffft.h>\nstatic std::vector<uint8_t> data;\nstatic void initData() { if (data.empty()) data = system::readFile(asset::plugin(pluginInstance, "res/constant.f32")); }\nstruct BinaryAssetModule : Module { enum OutputIds { SIGNAL_OUTPUT, NUM_OUTPUTS }; PFFFT_Setup* fft = nullptr; BinaryAssetModule() { config(0, 0, NUM_OUTPUTS, 0); configOutput(SIGNAL_OUTPUT, "Signal"); initData(); fft = pffft_new_setup(8, PFFFT_REAL); } ~BinaryAssetModule() { pffft_destroy_setup(fft); } void process(const ProcessArgs&) override { float value = 0.f, input[8] = {1.f}, spectrum[8] = {}, restored[8] = {}; if (data.size() >= sizeof(value)) std::memcpy(&value, data.data(), sizeof(value)); pffft_transform_ordered(fft, input, spectrum, nullptr, PFFFT_FORWARD); pffft_transform_ordered(fft, spectrum, restored, nullptr, PFFFT_BACKWARD); outputs[SIGNAL_OUTPUT].setVoltage(value + restored[0] / 8.f); } };\nstruct BinaryAssetWidget : ModuleWidget {};\nModel* modelBinaryAsset = createModel<BinaryAssetModule, BinaryAssetWidget>("BinaryAsset");\n');
  try{const report=JSON.parse(execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/BinaryAsset","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"})),adapter=fs.readFileSync(path.join(output,"adapter.cpp"),"utf8");assert.equal(report.assessment.compileEligible,true);assert.deepEqual(report.assessment.blockers,[]);assert.match(adapter,/rackWebEmbeddedBinaryAsset/);assert.match(adapter,/pffft_transform_ordered/);assert.doesNotMatch(adapter,/system::readFile|asset::plugin|#include\s+<pffft\.h>/);const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();wasm.rack_web_set_output_connected(0,1);wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],1.25)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("nested real PFFFT dependencies replace the Rack Web compatibility ABI",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-external-pffft-test-")),plugin=path.join(temporary,"plugin"),output=path.join(temporary,"output"),pffft=path.join(plugin,"pffft");fs.cpSync(source,plugin,{recursive:true});const manifestPath=path.join(plugin,"plugin.json"),manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));manifest.modules.push({slug:"ExternalPffft",name:"External PFFFT",description:"Real PFFFT ABI fixture",tags:["Utility"]});fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);fs.writeFileSync(path.join(plugin,".gitmodules"),'[submodule "pffft"]\n\tpath = pffft\n\turl = https://github.com/example/pffft.git\n');fs.mkdirSync(path.join(pffft,"include","pffft"),{recursive:true});fs.mkdirSync(path.join(pffft,"src"),{recursive:true});
  fs.writeFileSync(path.join(pffft,"include","pffft","pffft.h"),'#pragma once\n#include <stddef.h>\n#ifdef __cplusplus\nextern "C" {\n#endif\ntypedef enum { PFFFT_REAL, PFFFT_COMPLEX } pffft_transform_t;\ntypedef enum { PFFFT_FORWARD, PFFFT_BACKWARD } pffft_direction_t;\ntypedef struct PFFFT_Setup PFFFT_Setup;\nPFFFT_Setup* pffft_new_setup(int, pffft_transform_t);\nvoid pffft_destroy_setup(PFFFT_Setup*);\nvoid pffft_transform_ordered(const PFFFT_Setup*, const float*, float*, float*, pffft_direction_t);\nvoid* pffft_aligned_malloc(size_t);\nvoid pffft_aligned_free(void*);\n#ifdef __cplusplus\n}\n#endif\n');
  fs.writeFileSync(path.join(pffft,"src","pffft.c"),'#include <stdlib.h>\n#include "pffft.h"\nstruct PFFFT_Setup { int size; int marker; };\nPFFFT_Setup* pffft_new_setup(int size, pffft_transform_t transform) { (void)transform; PFFFT_Setup* setup = malloc(sizeof(PFFFT_Setup)); setup->size = size; setup->marker = 17; return setup; }\nvoid pffft_destroy_setup(PFFFT_Setup* setup) { free(setup); }\nvoid pffft_transform_ordered(const PFFFT_Setup* setup, const float* input, float* output, float* work, pffft_direction_t direction) { (void)work; (void)direction; for (int index = 0; index < setup->size; ++index) output[index] = input[index] * setup->marker; }\nvoid* pffft_aligned_malloc(size_t size) { return malloc(size); }\nvoid pffft_aligned_free(void* pointer) { free(pointer); }\n');fs.writeFileSync(path.join(pffft,"src","pffft_common.c"),"int fixture_pffft_common = 1;\n");
  fs.writeFileSync(path.join(plugin,"src","ExternalPffft.cpp"),'#include "plugin.hpp"\n#include <pffft.h>\nstruct ExternalPffftModule : Module { enum OutputIds { SIGNAL_OUTPUT, NUM_OUTPUTS }; PFFFT_Setup* setup = pffft_new_setup(8, PFFFT_REAL); ExternalPffftModule() { config(0, 0, NUM_OUTPUTS, 0); } ~ExternalPffftModule() { pffft_destroy_setup(setup); } void process(const ProcessArgs&) override { float input[8] = {1.f}, output[8] = {}, work[8] = {}; pffft_transform_ordered(setup, input, output, work, PFFFT_FORWARD); outputs[SIGNAL_OUTPUT].setVoltage(output[0]); } };\nstruct ExternalPffftWidget : ModuleWidget {};\nModel* modelExternalPffft = createModel<ExternalPffftModule, ExternalPffftWidget>("ExternalPffft");\n');
  for(const repository of [pffft,plugin]){execFileSync("git",["init","-q"],{cwd:repository});execFileSync("git",["add","."],{cwd:repository});execFileSync("git",["-c","user.name=Rack Web Test","-c","user.email=rack-web@example.invalid","commit","-qm","fixture"],{cwd:repository})}
  try{execFileSync(process.execPath,[path.join(root,"scripts","scaffold-library-module.mjs"),"https://library.vcvrack.com/FixturePlugin/ExternalPffft","--manifest-file",manifestPath,"--source-dir",plugin,"--output",output,"--compile"],{encoding:"utf8"});const wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(output,"module.wasm"))),{}).exports;wasm._initialize();wasm.rack_web_set_output_connected(0,1);wasm.rack_web_process(1,48000);assert.equal(new Float32Array(wasm.memory.buffer,wasm.rack_web_output_buffer(),128)[0],17)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});
