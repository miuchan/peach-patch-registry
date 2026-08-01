export function browserTemporalDeckAdapterSource(target,manifest,license,definitionFile,registrationFile){
  return `// Browser DSP adapter for ${target.key}, preserving the source TemporalDeckEngine.
// Source: ${manifest.sourceUrl} (${definitionFile}; registered in ${registrationFile})
// License: ${license}

#include "rack_web_export.hpp"
#include "TemporalDeckEngine.hpp"
#include <array>
#include <vector>

struct RackWebTemporalDeckModule : Module {
  enum ParamId { BUFFER_PARAM, RATE_PARAM, SCRATCH_SENSITIVITY_PARAM, MIX_PARAM, FEEDBACK_PARAM,
    FREEZE_PARAM, REVERSE_PARAM, SLIP_PARAM, CARTRIDGE_CYCLE_PARAM, ADD_SCOPE_PARAM, PARAMS_LEN };
  enum InputId { POSITION_CV_INPUT, RATE_CV_INPUT, INPUT_L_INPUT, INPUT_R_INPUT, SCRATCH_GATE_INPUT,
    FREEZE_GATE_INPUT, REVERSE_CV_INPUT, INPUTS_LEN };
  enum OutputId { OUTPUT_L_OUTPUT, S_GATE_O_OUTPUT, OUTPUT_R_OUTPUT, S_POS_O_OUTPUT, OUTPUTS_LEN };
  enum LightId { FREEZE_LIGHT, REVERSE_LIGHT, SLIP_SLOW_LIGHT, SLIP_LIGHT, SLIP_FAST_LIGHT,
    EXPANDER_LINK_LIGHT, EXPANDER_READY_LIGHT, ARC_LIGHT_START, ARC_MAX_LIGHT_START = ARC_LIGHT_START + 31,
    LIGHTS_LEN = ARC_MAX_LIGHT_START + 31 };
  static constexpr int NUM_PARAMS = PARAMS_LEN, NUM_INPUTS = INPUTS_LEN;
  static constexpr int NUM_OUTPUTS = OUTPUTS_LEN, NUM_LIGHTS = LIGHTS_LEN;
  static constexpr int rackWebAssetSampleCapacity = 960000;
  std::array<float, rackWebAssetSampleCapacity> rackWebAssetSamples {};
  std::array<float, 8> rackWebVisual {};
  std::array<temporaldeck_expander::ScopeBin, 256> scopeBins {};
  std::array<temporaldeck_expander::ScopeBin, 256> scopeRightBins {};
  temporaldeck::TemporalDeckEngine engine;
  dsp::SchmittTrigger freezeTrigger, reverseTrigger, slipTrigger, cartridgeTrigger;
  bool freezeLatched = false, reverseLatched = false, slipLatched = false;
  bool sampleModeEnabled = false, sampleLoopEnabled = true;
  bool highQualityRateInterpolation = false;
  int scratchInterpolationMode = 1, externalGatePosMode = 0, freezeCvMode = 1, reverseCvMode = 1;
  int slipReturnMode = 1, cartridgeCharacter = 0, bufferDurationMode = 0;
  int platterArtMode = 1, platterBrightnessMode = 0;
  int assetFrames = 0, assetChannels = 0;
  float assetSampleRate = 48000.f, currentSampleRate = 0.f;
  float expanderPublishTimer = 0.f;
  uint64_t expanderPublishSeq = 0;
  bool expanderPreviewReady = false, wantStereoScope = false;

  RackWebTemporalDeckModule() {
    config(PARAMS_LEN, INPUTS_LEN, OUTPUTS_LEN, LIGHTS_LEN);
    configParam(BUFFER_PARAM, 0.f, 1.f, 1.f, "Buffer");
    configParam(RATE_PARAM, 0.f, 1.f, .5f, "Rate");
    configParam(SCRATCH_SENSITIVITY_PARAM, 0.f, 1.f, .5f, "Scratch sensitivity");
    configParam(MIX_PARAM, 0.f, 1.f, 1.f, "Mix");
    configParam(FEEDBACK_PARAM, 0.f, 1.f, 0.f, "Feedback");
    configButton(FREEZE_PARAM, "Freeze"); configButton(REVERSE_PARAM, "Reverse");
    configButton(SLIP_PARAM, "Slip"); configButton(CARTRIDGE_CYCLE_PARAM, "Cycle cartridge");
    configButton(ADD_SCOPE_PARAM, "Spawn TD.Scope");
    for (int id = 0; id < INPUTS_LEN; ++id) configInput(id, "");
    for (int id = 0; id < OUTPUTS_LEN; ++id) configOutput(id, "");
    resetEngine(48000.f);
  }
  void resetEngine(float sampleRate) {
    currentSampleRate = std::max(sampleRate, 1.f);
    engine.bufferDurationMode = bufferDurationMode;
    engine.reset(currentSampleRate);
    engine.highQualityRateInterpolation = highQualityRateInterpolation;
    engine.externalGatePosMode = externalGatePosMode;
    if (assetFrames > 0) installAsset();
  }
  void installAsset() {
    const int frames = std::min(assetFrames, int(currentSampleRate * 10.f));
    std::vector<float> left(frames), right(assetChannels > 1 ? frames : 0);
    const double rateRatio = double(assetSampleRate) / std::max(double(currentSampleRate), 1.0);
    for (int frame = 0; frame < frames; ++frame) {
      const int sourceFrame = std::min(assetFrames - 1, int(frame * rateRatio));
      left[frame] = 5.f * rackWebAssetSamples[sourceFrame * assetChannels];
      if (assetChannels > 1) right[frame] = 5.f * rackWebAssetSamples[sourceFrame * assetChannels + 1];
    }
    engine.installSample(left, right, frames, true, frames < assetFrames);
    engine.sampleLoopEnabled = sampleLoopEnabled;
    sampleModeEnabled = true;
  }
  int assetCapacity() const override { return rackWebAssetSampleCapacity; }
  float* assetBuffer() override { return rackWebAssetSamples.data(); }
  void commitAsset(int frames, int channels, float sampleRate) override {
    assetChannels = clamp(channels, 1, 2);
    assetFrames = clamp(frames, 0, rackWebAssetSampleCapacity / assetChannels);
    assetSampleRate = std::max(sampleRate, 1.f);
    if (assetFrames > 0) installAsset();
  }
  int rackWebVisualCount() const override { return static_cast<int>(rackWebVisual.size()); }
  float* rackWebVisualBuffer() override {
    rackWebVisual = {engine.platterPhase, float(engine.samplePlayhead), float(engine.sampleFrames),
      sampleModeEnabled ? 1.f : 0.f, engine.sampleLoaded ? 1.f : 0.f,
      engine.sampleTransportPlaying ? 1.f : 0.f, float(cartridgeCharacter), float(bufferDurationMode)};
    return rackWebVisual.data();
  }
  json_t* dataToJson() override {
    json_t* root = json_object();
    json_object_set_new(root, "freezeLatched", json_boolean(freezeLatched));
    json_object_set_new(root, "reverseLatched", json_boolean(reverseLatched));
    json_object_set_new(root, "slipLatched", json_boolean(slipLatched));
    json_object_set_new(root, "scratchInterpolationMode", json_integer(scratchInterpolationMode));
    json_object_set_new(root, "highQualityRateInterpolation", json_boolean(highQualityRateInterpolation));
    json_object_set_new(root, "externalGatePosMode", json_integer(externalGatePosMode));
    json_object_set_new(root, "freezeCvMode", json_integer(freezeCvMode));
    json_object_set_new(root, "reverseCvMode", json_integer(reverseCvMode));
    json_object_set_new(root, "slipReturnMode", json_integer(slipReturnMode));
    json_object_set_new(root, "cartridgeCharacter", json_integer(cartridgeCharacter));
    json_object_set_new(root, "bufferDurationMode", json_integer(bufferDurationMode));
    json_object_set_new(root, "sampleModeEnabled", json_boolean(sampleModeEnabled));
    json_object_set_new(root, "sampleLoopEnabled", json_boolean(sampleLoopEnabled));
    json_object_set_new(root, "platterArtMode", json_integer(platterArtMode));
    json_object_set_new(root, "platterBrightnessMode", json_integer(platterBrightnessMode));
    return root;
  }
  void dataFromJson(json_t* root) override {
    auto boolean = [&](const char* key, bool& value) { if (auto* item = json_object_get(root, key)) value = json_boolean_value(item); };
    auto integer = [&](const char* key, int& value) { if (auto* item = json_object_get(root, key)) value = int(json_integer_value(item)); };
    boolean("freezeLatched", freezeLatched); boolean("reverseLatched", reverseLatched); boolean("slipLatched", slipLatched);
    integer("scratchInterpolationMode", scratchInterpolationMode); boolean("highQualityRateInterpolation", highQualityRateInterpolation);
    integer("externalGatePosMode", externalGatePosMode); integer("freezeCvMode", freezeCvMode);
    integer("reverseCvMode", reverseCvMode); integer("slipReturnMode", slipReturnMode);
    integer("cartridgeCharacter", cartridgeCharacter); integer("bufferDurationMode", bufferDurationMode);
    boolean("sampleModeEnabled", sampleModeEnabled); boolean("sampleLoopEnabled", sampleLoopEnabled);
    integer("platterArtMode", platterArtMode); integer("platterBrightnessMode", platterBrightnessMode);
    engine.sampleLoopEnabled = sampleLoopEnabled; engine.sampleModeEnabled = sampleModeEnabled;
    engine.highQualityRateInterpolation = highQualityRateInterpolation; engine.externalGatePosMode = externalGatePosMode;
    engine.slipReturnMode = slipReturnMode;
  }
  void setState(int id, float value) override {
    switch (id) {
      case 0: freezeLatched = value != 0.f; break;
      case 1: reverseLatched = value != 0.f; break;
      case 2: slipLatched = value != 0.f; break;
      case 3: scratchInterpolationMode = int(value); break;
      case 4: highQualityRateInterpolation = value != 0.f; break;
      case 5: externalGatePosMode = int(value); break;
      case 6: freezeCvMode = int(value); break;
      case 7: reverseCvMode = int(value); break;
      case 8: slipReturnMode = int(value); break;
      case 9: cartridgeCharacter = int(value); break;
      case 10: bufferDurationMode = int(value); break;
      case 11: sampleModeEnabled = value != 0.f; break;
      case 12: sampleLoopEnabled = value != 0.f; break;
      case 13: platterArtMode = int(value); break;
      case 14: platterBrightnessMode = int(value); break;
      default: break;
    }
    engine.sampleLoopEnabled = sampleLoopEnabled; engine.sampleModeEnabled = sampleModeEnabled;
    engine.highQualityRateInterpolation = highQualityRateInterpolation; engine.externalGatePosMode = externalGatePosMode;
    engine.slipReturnMode = slipReturnMode;
  }
  void publishScope(const temporaldeck::TemporalDeckEngine::FrameResult& frame, const ProcessArgs& args) {
    Module* scope = rightExpander.module;
    if (!scope || !scope->leftExpander.producerMessage) {
      expanderPreviewReady = false;
      return;
    }
    const auto* request = reinterpret_cast<const temporaldeck_expander::DisplayToHost*>(rightExpander.consumerMessage);
    if (request && temporaldeck_expander::isDisplayRequestValid(*request))
      wantStereoScope = request->requestedScopeFormat == temporaldeck_expander::SCOPE_FORMAT_STEREO;
    expanderPublishTimer += args.sampleTime;
    if (expanderPublishTimer < 1.f / 90.f) return;
    expanderPublishTimer = std::fmod(expanderPublishTimer, 1.f / 90.f);
    const int available = frame.sampleMode ? std::max(0, engine.sampleFrames) : std::max(0, engine.buffer.filled);
    const int count = std::min(256, available);
    if (count <= 0) {
      expanderPreviewReady = false;
      return;
    }
    const int window = std::min(available, std::max(count, int(args.sampleRate * 1.8f)));
    auto empty = temporaldeck_expander::makeEmptyScopeBin();
    scopeBins.fill(empty);
    scopeRightBins.fill(empty);
    for (int bin = 0; bin < count; ++bin) {
      const int begin = int((int64_t(bin) * window) / count);
      const int end = std::max(begin + 1, int((int64_t(bin + 1) * window) / count));
      float minimumL = 10.f, maximumL = -10.f, minimumR = 10.f, maximumR = -10.f;
      for (int sample = begin; sample < end; ++sample) {
        int physical = 0;
        if (frame.sampleMode) {
          const int logical = std::max(0, engine.sampleFrames - window) + sample;
          physical = engine.samplePhysicalIndex(logical);
        } else {
          physical = engine.buffer.wrapIndex(engine.buffer.writeHead - window + sample);
        }
        const float left = engine.buffer.left[size_t(physical)];
        const float right = engine.buffer.rightSample(physical);
        minimumL = std::min(minimumL, left); maximumL = std::max(maximumL, left);
        minimumR = std::min(minimumR, right); maximumR = std::max(maximumR, right);
      }
      scopeBins[size_t(bin)] = {temporaldeck_expander::quantizePreviewSample(minimumL), temporaldeck_expander::quantizePreviewSample(maximumL)};
      scopeRightBins[size_t(bin)] = {temporaldeck_expander::quantizePreviewSample(minimumR), temporaldeck_expander::quantizePreviewSample(maximumR)};
    }
    uint32_t flags = temporaldeck_expander::FLAG_PREVIEW_VALID;
    if (frame.sampleMode) flags |= temporaldeck_expander::FLAG_SAMPLE_MODE;
    if (frame.sampleLoaded) flags |= temporaldeck_expander::FLAG_SAMPLE_LOADED;
    if (frame.sampleTransportPlaying) flags |= temporaldeck_expander::FLAG_SAMPLE_PLAYING;
    if (sampleLoopEnabled) flags |= temporaldeck_expander::FLAG_SAMPLE_LOOP;
    if (freezeLatched) flags |= temporaldeck_expander::FLAG_FREEZE;
    if (reverseLatched) flags |= temporaldeck_expander::FLAG_REVERSE;
    if (slipLatched) flags |= temporaldeck_expander::FLAG_SLIP;
    if (wantStereoScope) flags |= temporaldeck_expander::FLAG_SCOPE_STEREO;
    auto* message = reinterpret_cast<temporaldeck_expander::HostToDisplay*>(scope->leftExpander.producerMessage);
    temporaldeck_expander::populateHostMessage(
      message, ++expanderPublishSeq, engine.bufferGeneration, flags, args.sampleRate,
      float(frame.lag), float(frame.accessibleLag), frame.platterAngle,
      float(frame.samplePlayhead), float(frame.sampleDuration), float(frame.sampleProgress),
      frame.sampleMode ? engine.sampleAbsolutePeakVolts : engine.getLiveAbsolutePeakVolts(),
      .5f + params[SCRATCH_SENSITIVITY_PARAM].getValue() * 1.5f,
      uint32_t(std::max(0, engine.buffer.size)), uint32_t(std::max(0, engine.buffer.filled)),
      900.f, float(window), float(window), float(window) / float(count), float(engine.buffer.writeHead),
      uint32_t(count), scopeBins.data(), wantStereoScope ? scopeRightBins.data() : nullptr);
    scope->leftExpander.messageFlipRequested = true;
    expanderPreviewReady = true;
  }
  void process(const ProcessArgs& args) override {
    if (std::fabs(args.sampleRate - currentSampleRate) > .5f) resetEngine(args.sampleRate);
    if (freezeTrigger.process(params[FREEZE_PARAM].getValue())) freezeLatched = !freezeLatched;
    if (reverseTrigger.process(params[REVERSE_PARAM].getValue())) reverseLatched = !reverseLatched;
    if (slipTrigger.process(params[SLIP_PARAM].getValue())) slipLatched = !slipLatched;
    if (cartridgeTrigger.process(params[CARTRIDGE_CYCLE_PARAM].getValue())) cartridgeCharacter = (cartridgeCharacter + 1) % 6;
    const bool freezeGate = inputs[FREEZE_GATE_INPUT].getVoltage() >= 1.f;
    const bool reverseGate = inputs[REVERSE_CV_INPUT].getVoltage() >= 1.f;
    temporaldeck::TemporalDeckEngine::FrameInput input;
    input.dt = args.sampleTime; input.inL = inputs[INPUT_L_INPUT].getVoltage();
    input.inR = inputs[INPUT_R_INPUT].isConnected() ? inputs[INPUT_R_INPUT].getVoltage() : input.inL;
    input.bufferKnob = params[BUFFER_PARAM].getValue(); input.rateKnob = params[RATE_PARAM].getValue();
    input.mixKnob = params[MIX_PARAM].getValue(); input.feedbackKnob = params[FEEDBACK_PARAM].getValue();
    input.freezeButton = freezeLatched || (freezeCvMode == 1 && freezeGate);
    input.reverseButton = reverseLatched || (reverseCvMode == 1 && reverseGate); input.slipButton = slipLatched;
    input.scratchGate = inputs[SCRATCH_GATE_INPUT].getVoltage() >= 1.f;
    input.scratchGateConnected = inputs[SCRATCH_GATE_INPUT].isConnected();
    input.positionConnected = inputs[POSITION_CV_INPUT].isConnected();
    input.positionCv = inputs[POSITION_CV_INPUT].getVoltage(); input.rateCv = inputs[RATE_CV_INPUT].getVoltage();
    input.rateCvConnected = inputs[RATE_CV_INPUT].isConnected();
    engine.sampleModeEnabled = sampleModeEnabled; engine.sampleLoopEnabled = sampleLoopEnabled;
    engine.slipReturnMode = slipReturnMode; engine.scratchInterpolationMode = scratchInterpolationMode;
    const auto frame = engine.process(input);
    outputs[OUTPUT_L_OUTPUT].setVoltage(frame.outL); outputs[S_GATE_O_OUTPUT].setVoltage(frame.scratchGateOut);
    outputs[OUTPUT_R_OUTPUT].setVoltage(frame.outR); outputs[S_POS_O_OUTPUT].setVoltage(frame.scratchPosOut);
    lights[FREEZE_LIGHT].setBrightness(input.freezeButton ? 1.f : 0.f);
    lights[REVERSE_LIGHT].setBrightness(input.reverseButton ? 1.f : 0.f);
    lights[SLIP_SLOW_LIGHT].setBrightness(slipLatched && slipReturnMode == 0 ? 1.f : 0.f);
    lights[SLIP_LIGHT].setBrightness(slipLatched && slipReturnMode == 1 ? 1.f : 0.f);
    lights[SLIP_FAST_LIGHT].setBrightness(slipLatched && slipReturnMode == 2 ? 1.f : 0.f);
    const float progress = frame.sampleMode ? float(frame.sampleProgress) : float(frame.lag / std::max(frame.accessibleLag, 1.0));
    const int lit = clamp(int(progress * 30.f), 0, 30);
    for (int index = 0; index < 31; ++index) {
      lights[ARC_LIGHT_START + index].setBrightness(index <= lit ? .92f : 0.f);
      lights[ARC_MAX_LIGHT_START + index].setBrightness(index == 30 ? .9f : 0.f);
    }
    publishScope(frame, args);
    const bool linked = rightExpander.module != nullptr;
    lights[EXPANDER_LINK_LIGHT].setBrightness(linked && !expanderPreviewReady ? 1.f : 0.f);
    lights[EXPANDER_READY_LIGHT].setBrightness(linked && expanderPreviewReady ? 1.f : 0.f);
  }
};

RACK_WEB_EXPORTS(RackWebTemporalDeckModule)
`;
}
