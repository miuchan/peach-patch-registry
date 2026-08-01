// DSP-only monophonic web translation of Audible Instruments Kinks 2.0.0.
// Original source: https://github.com/VCVRack/AudibleInstruments
// Copyright Emilie Gillet and VCV, licensed GPL-3.0-or-later.

#include "rack_web_export.hpp"
#include <algorithm>

struct AudibleKinks : Module {
  enum ParamIds { NUM_PARAMS };
  enum InputIds { SIGN_INPUT, LOGIC_A_INPUT, LOGIC_B_INPUT, SH_INPUT, TRIG_INPUT, NUM_INPUTS };
  enum OutputIds { INVERT_OUTPUT, HALF_RECTIFY_OUTPUT, FULL_RECTIFY_OUTPUT, MAX_OUTPUT, MIN_OUTPUT, NOISE_OUTPUT, SH_OUTPUT, NUM_OUTPUTS };
  enum LightIds { SIGN_POS_LIGHT, SIGN_NEG_LIGHT, LOGIC_POS_LIGHT, LOGIC_NEG_LIGHT, SH_POS_LIGHT, SH_NEG_LIGHT, NUM_LIGHTS };
  dsp::SchmittTrigger trigger;
  float sample = 0.f;

  AudibleKinks() { config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS); }

  void process(const ProcessArgs&) override {
    const float noise = 2.f * rack::random::normal();
    if (trigger.process(inputs[TRIG_INPUT].getVoltage() / .7f)) sample = inputs[SH_INPUT].getNormalVoltage(noise);
    const float sign = inputs[SIGN_INPUT].getVoltage();
    const float logicA = inputs[LOGIC_A_INPUT].getVoltage();
    const float logicB = inputs[LOGIC_B_INPUT].getVoltage();
    outputs[INVERT_OUTPUT].setVoltage(-sign);
    outputs[HALF_RECTIFY_OUTPUT].setVoltage(std::fmax(0.f, sign));
    outputs[FULL_RECTIFY_OUTPUT].setVoltage(std::fabs(sign));
    outputs[MAX_OUTPUT].setVoltage(std::fmax(logicA, logicB));
    outputs[MIN_OUTPUT].setVoltage(std::fmin(logicA, logicB));
    outputs[NOISE_OUTPUT].setVoltage(noise);
    outputs[SH_OUTPUT].setVoltage(sample);
    lights[SIGN_POS_LIGHT].setBrightness(std::fmax(0.f, sign / 5.f));
    lights[SIGN_NEG_LIGHT].setBrightness(std::fmax(0.f, -sign / 5.f));
    const float logicSum = logicA + logicB;
    lights[LOGIC_POS_LIGHT].setBrightness(std::fmax(0.f, logicSum / 5.f));
    lights[LOGIC_NEG_LIGHT].setBrightness(std::fmax(0.f, -logicSum / 5.f));
    lights[SH_POS_LIGHT].setBrightness(std::fmax(0.f, sample / 5.f));
    lights[SH_NEG_LIGHT].setBrightness(std::fmax(0.f, -sample / 5.f));
  }
};

RACK_WEB_EXPORTS(AudibleKinks)
