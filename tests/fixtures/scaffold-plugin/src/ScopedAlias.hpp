#pragma once
#include "rack.hpp"

namespace fixture::dsp {
struct ScopedAlias final : rack::Module {
  enum ParamIds { LEVEL_PARAM, NUM_PARAMS };
  enum InputIds { SIGNAL_INPUT, NUM_INPUTS };
  enum OutputIds { SIGNAL_OUTPUT, NUM_OUTPUTS };
  enum LightIds { NUM_LIGHTS };

  ScopedAlias() {
    config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS);
    configParam(ScopedAlias::LEVEL_PARAM, 0.f, 2.f, 1.f, "Level");
    configInput(ScopedAlias::SIGNAL_INPUT, "Signal");
    configOutput(ScopedAlias::SIGNAL_OUTPUT, "Signal");
  }

  void process(const ProcessArgs&) override {
    // Rack 1-era plugins frequently access channel zero through the public
    // `value` member. Keep this fixture on that ABI so the web host cannot
    // accidentally regress while modern getVoltage()/setVoltage() still pass.
    outputs[SIGNAL_OUTPUT].value = inputs[SIGNAL_INPUT].value * params[LEVEL_PARAM].getValue();
  }
};
}
