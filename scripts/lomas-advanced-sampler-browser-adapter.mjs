export function browserLomasAdvancedSamplerAdapterSource(target,manifest,license,definitionFile,registrationFile){
  return `// Browser DSP adapter for ${target.key}; native directory dialogs are handled by the web host.
// Source: ${manifest.sourceUrl} (${definitionFile}; registered in ${registrationFile})
// License: ${license}

#include "rack_web_export.hpp"
#include <array>

struct RackWebLomasAdvancedSampler : Module {
  enum ParamId {
    SAMPLE_PARAM, TUNE_PARAM, ATTACK_PARAM, DECAY_PARAM, START_PARAM, END_PARAM,
    LOAD_PARAM, LOOP_PARAM, PLAY_PARAM, REC_PARAM, PARAMS_LEN
  };
  enum InputId {
    SAMPLE_INPUT, TUNE_INPUT, ATTACK_INPUT, DECAY_INPUT, START_INPUT, END_INPUT,
    AUDIO_INPUT, REC_INPUT, PLAY_INPUT, INPUTS_LEN
  };
  enum OutputId { EOC_OUTPUT, AUDIO_OUTPUT, OUTPUTS_LEN };
  enum LightId { PLAY_LIGHT, LOOP_LIGHT, REC_LIGHT_RED, REC_LIGHT_BLUE, LIGHTS_LEN };
  static constexpr int NUM_PARAMS = PARAMS_LEN, NUM_INPUTS = INPUTS_LEN;
  static constexpr int NUM_OUTPUTS = OUTPUTS_LEN, NUM_LIGHTS = LIGHTS_LEN;
  static constexpr int rackWebAssetSampleCapacity = 960000;
  static constexpr int rackWebWaveformBins = 64;

  std::array<float, rackWebAssetSampleCapacity> samples {};
  std::array<float, rackWebWaveformBins> waveform {};
  std::array<float, 9 + rackWebWaveformBins> visual {};
  int frames = 0, sourceChannels = 0;
  float sourceSampleRate = 48000.f, currentSampleRate = 48000.f;
  double phase = 0.0;
  bool playing = false, looping = false, recording = false;
  bool holdEnvelope = false, slice = false;
  int interpolationMode = 2;
  float envelope = 0.f;
  dsp::SchmittTrigger playInputTrigger, recInputTrigger;
  dsp::BooleanTrigger playButtonTrigger, recButtonTrigger, loopButtonTrigger;
  dsp::PulseGenerator eocPulse;

  RackWebLomasAdvancedSampler() {
    config(PARAMS_LEN, INPUTS_LEN, OUTPUTS_LEN, LIGHTS_LEN);
    configParam(SAMPLE_PARAM, 0.f, 1.f, 0.f, "Sample select");
    configParam(TUNE_PARAM, -2.f, 2.f, 0.f, "Tune", " semitones", 0.f, 12.f);
    configParam(ATTACK_PARAM, 0.f, 1.f, 0.f, "Attack");
    configParam(DECAY_PARAM, 0.f, 1.f, 1.f, "Decay");
    configParam(START_PARAM, 0.f, 1.f, 0.f, "Start point", " %", 0.f, 100.f);
    configParam(END_PARAM, 0.f, 1.f, 1.f, "End point", " %", 0.f, 100.f);
    configButton(LOAD_PARAM, "Open folder");
    configButton(LOOP_PARAM, "Loop");
    configButton(PLAY_PARAM, "Play");
    configButton(REC_PARAM, "Record");
    for (int id = 0; id < INPUTS_LEN; ++id) configInput(id, "");
    configOutput(EOC_OUTPUT, "End of cycle");
    configOutput(AUDIO_OUTPUT, "Audio");
    playButtonTrigger.process(false);
    recButtonTrigger.process(false);
    loopButtonTrigger.process(false);
  }

  float modulated(int id, float multiplier = .1f, float minimum = 0.f, float maximum = 1.f) const {
    return clamp(params[id].getValue() + inputs[id].getVoltage() * multiplier, minimum, maximum);
  }
  float endpoint(int id) const {
    float value = modulated(id);
    if (slice) value = std::round(value * 16.f) / 16.f;
    if (frames > 0 && float(frames) / std::max(sourceSampleRate, 1.f) < 2.f) value *= value;
    return clamp(value, 0.f, 1.f);
  }
  void calculateWaveform() {
    waveform.fill(0.f);
    if (frames <= 0) return;
    float peak = 0.f;
    for (int bin = 0; bin < rackWebWaveformBins; ++bin) {
      const int begin = int((int64_t(bin) * frames) / rackWebWaveformBins);
      const int end = std::max(begin + 1, int((int64_t(bin + 1) * frames) / rackWebWaveformBins));
      float average = 0.f;
      for (int frame = begin; frame < std::min(end, frames); ++frame) average += std::fabs(samples[frame]);
      average /= float(std::max(1, std::min(end, frames) - begin));
      waveform[bin] = average;
      peak = std::max(peak, average);
    }
    if (peak > 1e-9f) for (float& value : waveform) value = .8f * value / peak;
  }
  float readSample(double normalizedPhase) const {
    if (frames <= 0) return 0.f;
    const double index = clamp(normalizedPhase, 0.0, std::nextafter(1.0, 0.0)) * double(frames);
    const int base = clamp(int(std::floor(index)), 0, frames - 1);
    if (interpolationMode == 0 || frames < 2) return samples[base];
    const float fraction = float(index - std::floor(index));
    if (interpolationMode == 1 || frames < 4) {
      const int next = std::min(base + 1, frames - 1);
      return samples[base] + (samples[next] - samples[base]) * fraction;
    }
    const int i0 = std::max(0, base - 1), i1 = base, i2 = std::min(frames - 1, base + 1), i3 = std::min(frames - 1, base + 2);
    const float y0 = samples[i0], y1 = samples[i1], y2 = samples[i2], y3 = samples[i3];
    const float c0 = y1, c1 = .5f * (y2 - y0), c2 = y0 - 2.5f * y1 + 2.f * y2 - .5f * y3;
    const float c3 = .5f * (y3 - y0) + 1.5f * (y1 - y2);
    return ((c3 * fraction + c2) * fraction + c1) * fraction + c0;
  }
  void trigger() {
    if (frames <= 0) return;
    playing = true;
    recording = false;
    envelope = 0.f;
    phase = endpoint(START_PARAM);
  }
  void stopRecord() {
    recording = false;
    calculateWaveform();
  }
  void switchRecord(float sampleRate) {
    if (recording) { stopRecord(); return; }
    recording = true;
    playing = false;
    frames = 0;
    sourceChannels = 1;
    sourceSampleRate = std::max(sampleRate, 1.f);
    phase = 0.0;
    envelope = 0.f;
    waveform.fill(0.f);
  }

  int assetCapacity() const override { return rackWebAssetSampleCapacity; }
  float* assetBuffer() override { return samples.data(); }
  void commitAsset(int nextFrames, int nextChannels, float sampleRate) override {
    sourceChannels = clamp(nextChannels, 1, 2);
    frames = clamp(nextFrames, 0, rackWebAssetSampleCapacity / sourceChannels);
    for (int frame = 0; frame < frames; ++frame) {
      float mono = samples[frame * sourceChannels];
      if (sourceChannels > 1) mono = .5f * (mono + samples[frame * sourceChannels + 1]);
      samples[frame] = clamp(mono, -1.f, 1.f);
    }
    sourceChannels = 1;
    sourceSampleRate = std::max(sampleRate, 1.f);
    phase = 0.0; playing = false; recording = false; envelope = 0.f;
    calculateWaveform();
  }
  int rackWebVisualCount() const override { return static_cast<int>(visual.size()); }
  float* rackWebVisualBuffer() override {
    visual[0] = float(frames); visual[1] = sourceSampleRate; visual[2] = float(phase);
    visual[3] = playing ? 1.f : 0.f; visual[4] = recording ? 1.f : 0.f;
    visual[5] = looping ? 1.f : 0.f; visual[6] = endpoint(START_PARAM);
    visual[7] = endpoint(END_PARAM); visual[8] = slice ? 1.f : 0.f;
    for (int index = 0; index < rackWebWaveformBins; ++index) visual[9 + index] = waveform[index];
    return visual.data();
  }
  json_t* dataToJson() override {
    json_t* root = json_object();
    json_object_set_new(root, "loop", json_boolean(looping));
    json_object_set_new(root, "hold_envelope", json_boolean(holdEnvelope));
    json_object_set_new(root, "playing", json_boolean(playing));
    json_object_set_new(root, "read_position", json_real(phase));
    json_object_set_new(root, "interpolation_mode", json_integer(interpolationMode));
    json_object_set_new(root, "slice", json_boolean(slice));
    return root;
  }
  void dataFromJson(json_t* root) override {
    if (auto* value = json_object_get(root, "loop")) looping = json_boolean_value(value);
    if (auto* value = json_object_get(root, "hold_envelope")) holdEnvelope = json_boolean_value(value);
    if (auto* value = json_object_get(root, "playing")) playing = frames > 0 && json_boolean_value(value);
    if (auto* value = json_object_get(root, "read_position")) phase = clamp(json_real_value(value), 0.0, 1.0);
    if (auto* value = json_object_get(root, "interpolation_mode")) interpolationMode = clamp(int(json_integer_value(value)), 0, 3);
    if (auto* value = json_object_get(root, "slice")) slice = json_boolean_value(value);
  }
  void setState(int id, float value) override {
    switch (id) {
      case 0: looping = value != 0.f; break;
      case 1: holdEnvelope = value != 0.f; break;
      case 2: playing = frames > 0 && value != 0.f; break;
      case 3: phase = clamp(double(value), 0.0, 1.0); break;
      case 4: interpolationMode = clamp(int(std::round(value)), 0, 3); break;
      case 5: slice = value != 0.f; break;
      default: break;
    }
  }
  void onReset() override { playing = false; recording = false; envelope = 0.f; phase = 0.0; }
  void process(const ProcessArgs& args) override {
    currentSampleRate = std::max(args.sampleRate, 1.f);
    if (inputs[AUDIO_INPUT].isConnected()) {
      if (recButtonTrigger.process(params[REC_PARAM].getValue())) switchRecord(currentSampleRate);
      if (inputs[REC_INPUT].isConnected() && recInputTrigger.process(inputs[REC_INPUT].getVoltage())) switchRecord(currentSampleRate);
    }
    if (recording) {
      if (frames < rackWebAssetSampleCapacity) samples[frames++] = clamp(inputs[AUDIO_INPUT].getVoltage() / 5.f, -1.f, 1.f);
      if (frames >= rackWebAssetSampleCapacity) stopRecord();
      outputs[AUDIO_OUTPUT].setVoltage(0.f); outputs[EOC_OUTPUT].setVoltage(0.f);
      lights[PLAY_LIGHT].setBrightness(0.f); lights[LOOP_LIGHT].setBrightness(looping ? .5f : 0.f);
      lights[REC_LIGHT_RED].setBrightness(.5f); lights[REC_LIGHT_BLUE].setBrightness(0.f);
      return;
    }
    if (frames > 0) {
      if (playButtonTrigger.process(params[PLAY_PARAM].getValue())) trigger();
      if (inputs[PLAY_INPUT].isConnected() && playInputTrigger.process(inputs[PLAY_INPUT].getVoltage())) trigger();
    }
    if (loopButtonTrigger.process(params[LOOP_PARAM].getValue())) looping = !looping;
    lights[PLAY_LIGHT].setBrightness(playing ? .5f : 0.f);
    lights[LOOP_LIGHT].setBrightness(looping ? .5f : 0.f);
    lights[REC_LIGHT_RED].setBrightness(0.f); lights[REC_LIGHT_BLUE].setBrightness(0.f);
    if (!playing || frames <= 0) {
      outputs[AUDIO_OUTPUT].setVoltage(0.f);
      outputs[EOC_OUTPUT].setVoltage(eocPulse.process(args.sampleTime) ? 10.f : 0.f);
      return;
    }
    const float start = endpoint(START_PARAM), end = endpoint(END_PARAM);
    const bool forward = end >= start;
    const float octave = modulated(TUNE_PARAM, 1.f, -4.f, 4.f);
    const double increment = std::exp2(double(octave)) * double(sourceSampleRate) / double(currentSampleRate) / double(std::max(frames, 1));
    phase += forward ? increment : -increment;
    const float minimum = std::min(start, end), maximum = std::max(start, end);
    const bool ended = (forward && phase >= maximum) || (!forward && phase < minimum);
    if (ended) {
      playing = looping;
      phase = start;
      eocPulse.trigger(1e-3f);
      if (!playing) envelope = 0.f;
    }
    float sample = playing ? readSample(phase) : 0.f;
    const float attack = modulated(ATTACK_PARAM), decay = modulated(DECAY_PARAM);
    const float attackSeconds = attack * attack * 2.f;
    const float decaySeconds = decay * decay * 4.f;
    if (attackSeconds > 1e-6f && envelope < 1.f) envelope = std::min(1.f, envelope + args.sampleTime / attackSeconds);
    else envelope = 1.f;
    if (!holdEnvelope && decaySeconds > 1e-6f) envelope = std::max(0.f, envelope - args.sampleTime / decaySeconds);
    outputs[AUDIO_OUTPUT].setVoltage(sample * envelope * 5.f);
    outputs[EOC_OUTPUT].setVoltage(eocPulse.process(args.sampleTime) ? 10.f : 0.f);
  }
};

RACK_WEB_EXPORTS(RackWebLomasAdvancedSampler)
`;
}
