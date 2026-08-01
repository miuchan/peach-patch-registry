// DSP-only monophonic web translation of Audible Instruments Links 2.0.0.
// Original source: https://github.com/VCVRack/AudibleInstruments
// Copyright Emilie Gillet and VCV, licensed GPL-3.0-or-later.

#include "rack_web_export.hpp"
#include <algorithm>

struct AudibleLinks : Module {
  enum ParamIds { NUM_PARAMS };
  enum InputIds { A1_INPUT, B1_INPUT, B2_INPUT, C1_INPUT, C2_INPUT, C3_INPUT, NUM_INPUTS };
  enum OutputIds { A1_OUTPUT, A2_OUTPUT, A3_OUTPUT, B1_OUTPUT, B2_OUTPUT, C1_OUTPUT, NUM_OUTPUTS };
  enum LightIds { A_POS_LIGHT, A_NEG_LIGHT, B_POS_LIGHT, B_NEG_LIGHT, C_POS_LIGHT, C_NEG_LIGHT, NUM_LIGHTS };

  AudibleLinks() { config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS); }

  void process(const ProcessArgs&) override {
    const float a = inputs[A1_INPUT].getVoltage();
    outputs[A1_OUTPUT].setVoltage(a);
    outputs[A2_OUTPUT].setVoltage(a);
    outputs[A3_OUTPUT].setVoltage(a);
    lights[A_POS_LIGHT].setBrightness(std::fmax(0.f, a / 5.f));
    lights[A_NEG_LIGHT].setBrightness(std::fmax(0.f, -a / 5.f));

    const float b = inputs[B1_INPUT].getVoltage() + inputs[B2_INPUT].getVoltage();
    outputs[B1_OUTPUT].setVoltage(b);
    outputs[B2_OUTPUT].setVoltage(b);
    lights[B_POS_LIGHT].setBrightness(std::fmax(0.f, b / 5.f));
    lights[B_NEG_LIGHT].setBrightness(std::fmax(0.f, -b / 5.f));

    const float c = inputs[C1_INPUT].getVoltage() + inputs[C2_INPUT].getVoltage() + inputs[C3_INPUT].getVoltage();
    outputs[C1_OUTPUT].setVoltage(c);
    lights[C_POS_LIGHT].setBrightness(std::fmax(0.f, c / 5.f));
    lights[C_NEG_LIGHT].setBrightness(std::fmax(0.f, -c / 5.f));
  }
};

RACK_WEB_EXPORTS(AudibleLinks)
