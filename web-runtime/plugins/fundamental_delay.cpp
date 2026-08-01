// Monophonic browser translation of Fundamental Delay 2.6.4.
// Ordered Rack parameters/ports and its 1ms..10s logarithmic time law are
// preserved with a fractional circular delay suitable for AudioWorklet.
// Original source: https://github.com/VCVRack/Fundamental (GPL-3.0-or-later).

#include "rack_web_export.hpp"
#include <algorithm>

struct FundamentalDelay : Module {
  enum ParamIds { TIME_PARAM, FEEDBACK_PARAM, TONE_PARAM, MIX_PARAM, TIME_CV_PARAM, FEEDBACK_CV_PARAM, TONE_CV_PARAM, MIX_CV_PARAM, NUM_PARAMS };
  enum InputIds { TIME_INPUT, FEEDBACK_INPUT, TONE_INPUT, MIX_INPUT, IN_INPUT, CLOCK_INPUT, NUM_INPUTS };
  enum OutputIds { MIX_OUTPUT, WET_OUTPUT, NUM_OUTPUTS };
  enum LightIds { CLOCK_LIGHT, NUM_LIGHTS };
  static constexpr int HISTORY_SIZE = 1 << 19;
  float history[HISTORY_SIZE]{};
  int writeIndex = 0;
  float lastWet = 0.f, lowpass = 0.f, highpassState = 0.f, previousLowpass = 0.f;
  FundamentalDelay() {
    config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS);
    configParam(TIME_PARAM, 0.f, 1.f, std::log10(500.f) / 4.f, "Time");
    configParam(FEEDBACK_PARAM, 0.f, 1.f, .5f, "Feedback");
    configParam(TONE_PARAM, 0.f, 1.f, .5f, "Tone");
    configParam(MIX_PARAM, 0.f, 1.f, .5f, "Mix");
    for (int id = TIME_CV_PARAM; id <= MIX_CV_PARAM; id++) configParam(id, -1.f, 1.f, 0.f, "CV");
  }
  void process(const ProcessArgs& args) override {
    const float input = inputs[IN_INPUT].getVoltage();
    const float feedback = std::clamp(params[FEEDBACK_PARAM].getValue() + inputs[FEEDBACK_INPUT].getVoltage() / 10.f * params[FEEDBACK_CV_PARAM].getValue(), 0.f, 1.f);
    history[writeIndex] = input + lastWet * feedback;
    const float timeControl = params[TIME_PARAM].getValue() - inputs[TIME_INPUT].getVoltage() * params[TIME_CV_PARAM].getValue() / std::log2(10000.f);
    const float seconds = .001f * std::pow(10000.f, timeControl);
    const float delaySamples = std::clamp(seconds * args.sampleRate, 2.f, static_cast<float>(HISTORY_SIZE - 2));
    float read = static_cast<float>(writeIndex) - delaySamples;
    while (read < 0.f) read += HISTORY_SIZE;
    const int first = static_cast<int>(read) & (HISTORY_SIZE - 1), second = (first + 1) & (HISTORY_SIZE - 1);
    const float rawWet = history[first] + (history[second] - history[first]) * (read - std::floor(read));
    const float tone = std::clamp(params[TONE_PARAM].getValue() + inputs[TONE_INPUT].getVoltage() / 10.f * params[TONE_CV_PARAM].getValue(), 0.f, 1.f);
    const float lowCutoff = std::clamp(20000.f * std::pow(100.f, 2.f * tone - 1.f), 20.f, 20000.f);
    const float lowCoefficient = 1.f - std::exp(-6.28318530718f * lowCutoff * args.sampleTime);
    lowpass += lowCoefficient * (rawWet - lowpass);
    const float highCutoff = std::clamp(20.f * std::pow(100.f, 2.f * tone - 1.f), 20.f, 20000.f);
    const float highCoefficient = 1.f - std::exp(-6.28318530718f * highCutoff * args.sampleTime);
    highpassState = highCoefficient * (highpassState + lowpass - previousLowpass);
    previousLowpass = lowpass;
    const float wet = std::clamp(highpassState, -100.f, 100.f);
    lastWet = wet;
    const float mix = std::clamp(params[MIX_PARAM].getValue() + inputs[MIX_INPUT].getVoltage() / 10.f * params[MIX_CV_PARAM].getValue(), 0.f, 1.f);
    outputs[WET_OUTPUT].setVoltage(wet);
    outputs[MIX_OUTPUT].setVoltage(input + (wet - input) * mix);
    writeIndex = (writeIndex + 1) & (HISTORY_SIZE - 1);
    lights[CLOCK_LIGHT].setBrightness(0.f);
  }
};

RACK_WEB_EXPORTS(FundamentalDelay)
