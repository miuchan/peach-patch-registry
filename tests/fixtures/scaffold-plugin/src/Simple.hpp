#pragma once

#include "plugin.hpp"

struct FixtureModule : Module {
  enum ParamIds { LEVEL_PARAM, NUM_PARAMS };
  enum InputIds { SIGNAL_INPUT, NUM_INPUTS };
  enum OutputIds {
    SIGNAL_OUTPUT,
#ifdef FIXTURE_DEBUG_OUTPUTS
    DEBUG_OUTPUT,
#endif
    NUM_OUTPUTS
  };
  enum LightIds { ACTIVE_LIGHT, NUM_LIGHTS };

  FixtureModule() {
    config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS);
    configParam(LEVEL_PARAM, 0.f, 1.f, 1.f, "Level");
    configInput(SIGNAL_INPUT, "Signal");
    configOutput(SIGNAL_OUTPUT, "Signal");
    configBypass(SIGNAL_INPUT, SIGNAL_OUTPUT);
  }

  void process(const ProcessArgs&) override {
    outputs[SIGNAL_OUTPUT].setVoltage(inputs[SIGNAL_INPUT].getVoltage() * params[LEVEL_PARAM].getValue());
  }
};
