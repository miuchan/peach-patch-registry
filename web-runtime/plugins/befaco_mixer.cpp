// DSP-only monophonic web translation of Befaco Mixer 2.x.
// Original source: https://github.com/VCVRack/Befaco
// Copyright Befaco and contributors, licensed GPL-3.0-or-later.

#include "rack_web_export.hpp"
#include <algorithm>

struct BefacoMixer : Module {
  enum ParamIds { CH1_PARAM, CH2_PARAM, CH3_PARAM, CH4_PARAM, NUM_PARAMS };
  enum InputIds { IN1_INPUT, IN2_INPUT, IN3_INPUT, IN4_INPUT, NUM_INPUTS };
  enum OutputIds { OUT1_OUTPUT, OUT2_OUTPUT, NUM_OUTPUTS };
  enum LightIds { OUT_POS_LIGHT, OUT_NEG_LIGHT, OUT_BLUE_LIGHT, NUM_LIGHTS };
  BefacoMixer() {
    config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS);
    for (int id = 0; id < 4; id++) configParam(id, 0.f, 1.f, 0.f, "Channel level");
  }
  void process(const ProcessArgs&) override {
    float mix = 0.f;
    for (int id = 0; id < 4; id++) if (inputs[id].isConnected()) mix += inputs[id].getVoltage() * params[id].getValue();
    outputs[OUT1_OUTPUT].setVoltage(mix);
    outputs[OUT2_OUTPUT].setVoltage(-mix);
    lights[OUT_POS_LIGHT].setBrightness(std::fmax(0.f, mix / 5.f));
    lights[OUT_NEG_LIGHT].setBrightness(std::fmax(0.f, -mix / 5.f));
    lights[OUT_BLUE_LIGHT].setBrightness(0.f);
  }
};

RACK_WEB_EXPORTS(BefacoMixer)
