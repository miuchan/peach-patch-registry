// DSP-only monophonic web translation of Audible Instruments Shades 2.0.0.
// Original source: https://github.com/VCVRack/AudibleInstruments
// Copyright Emilie Gillet and VCV, licensed GPL-3.0-or-later.

#include "rack_web_export.hpp"
#include <algorithm>

struct AudibleShades : Module {
  enum ParamIds { GAIN1_PARAM, GAIN2_PARAM, GAIN3_PARAM, MODE1_PARAM, MODE2_PARAM, MODE3_PARAM, NUM_PARAMS };
  enum InputIds { IN1_INPUT, IN2_INPUT, IN3_INPUT, NUM_INPUTS };
  enum OutputIds { OUT1_OUTPUT, OUT2_OUTPUT, OUT3_OUTPUT, NUM_OUTPUTS };
  enum LightIds { OUT1_POS_LIGHT, OUT1_NEG_LIGHT, OUT2_POS_LIGHT, OUT2_NEG_LIGHT, OUT3_POS_LIGHT, OUT3_NEG_LIGHT, NUM_LIGHTS };

  AudibleShades() {
    config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS);
    for (int channel = 0; channel < 3; channel++) {
      configParam(GAIN1_PARAM + channel, 0.f, 1.f, .5f, "Gain");
      configParam(MODE1_PARAM + channel, 0.f, 1.f, 1.f, "Mode");
    }
  }

  void process(const ProcessArgs&) override {
    float sum = 0.f;
    for (int channel = 0; channel < 3; channel++) {
      float value = inputs[IN1_INPUT + channel].getNormalVoltage(5.f);
      if (static_cast<int>(params[MODE1_PARAM + channel].getValue()) == 1) value *= 2.f * params[GAIN1_PARAM + channel].getValue() - 1.f;
      else value *= params[GAIN1_PARAM + channel].getValue();
      sum += value;
      lights[OUT1_POS_LIGHT + 2 * channel].setBrightness(std::fmax(0.f, sum / 5.f));
      lights[OUT1_NEG_LIGHT + 2 * channel].setBrightness(std::fmax(0.f, -sum / 5.f));
      if (outputs[OUT1_OUTPUT + channel].isConnected()) {
        outputs[OUT1_OUTPUT + channel].setVoltage(sum);
        sum = 0.f;
      }
    }
  }
};

RACK_WEB_EXPORTS(AudibleShades)
