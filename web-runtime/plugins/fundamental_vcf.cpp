// Monophonic browser translation of Fundamental VCF 2.6.4.
// Ordered Rack parameters and ports are preserved; the four cascaded nonlinear
// one-poles implement the same resonant low/high-pass signal contract.
// Original source: https://github.com/VCVRack/Fundamental (GPL-3.0-or-later).

#include "rack_web_export.hpp"
#include <algorithm>

struct FundamentalVCF : Module {
  enum ParamIds { FREQ_PARAM, FINE_PARAM, RES_PARAM, FREQ_CV_PARAM, DRIVE_PARAM, RES_CV_PARAM, DRIVE_CV_PARAM, NUM_PARAMS };
  enum InputIds { FREQ_INPUT, RES_INPUT, DRIVE_INPUT, IN_INPUT, NUM_INPUTS };
  enum OutputIds { LPF_OUTPUT, HPF_OUTPUT, NUM_OUTPUTS };
  enum LightIds { NUM_LIGHTS };
  float stages[4]{};
  FundamentalVCF() {
    config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS);
    configParam(FREQ_PARAM, 0.f, 1.f, .5f, "Cutoff frequency");
    configParam(RES_PARAM, 0.f, 1.f, 0.f, "Resonance");
    configParam(FREQ_CV_PARAM, -1.f, 1.f, 0.f, "Cutoff CV");
    configParam(DRIVE_PARAM, -1.f, 1.f, 0.f, "Drive");
    configParam(RES_CV_PARAM, -1.f, 1.f, 0.f, "Resonance CV");
    configParam(DRIVE_CV_PARAM, -1.f, 1.f, 0.f, "Drive CV");
  }
  void process(const ProcessArgs& args) override {
    const float drive = std::clamp(params[DRIVE_PARAM].getValue() + inputs[DRIVE_INPUT].getVoltage() / 10.f * params[DRIVE_CV_PARAM].getValue(), -1.f, 1.f);
    const float gain = std::pow(1.f + drive, 5.f);
    const float resonance = std::pow(std::clamp(params[RES_PARAM].getValue() + inputs[RES_INPUT].getVoltage() / 10.f * params[RES_CV_PARAM].getValue(), 0.f, 1.f), 2.f) * 4.f;
    const float pitch = params[FREQ_PARAM].getValue() * 10.f - 5.f + inputs[FREQ_INPUT].getVoltage() * params[FREQ_CV_PARAM].getValue();
    const float cutoff = std::clamp(261.625565f * std::exp2(pitch), 8.f, args.sampleRate * .45f);
    const float coefficient = 1.f - std::exp(-6.28318530718f * cutoff * args.sampleTime);
    float value = std::tanh((inputs[IN_INPUT].getVoltage() / 5.f * gain - resonance * stages[3]) * .8f);
    for (float& stage : stages) { stage += coefficient * (value - stage); value = std::tanh(stage); }
    outputs[LPF_OUTPUT].setVoltage(5.f * stages[3]);
    outputs[HPF_OUTPUT].setVoltage(inputs[IN_INPUT].getVoltage() - 5.f * stages[3]);
  }
};

RACK_WEB_EXPORTS(FundamentalVCF)
