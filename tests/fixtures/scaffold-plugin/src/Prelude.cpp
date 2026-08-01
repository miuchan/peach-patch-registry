#include "plugin.hpp"

template <typename T>
T preludeScale(T value) {
  return value * 1.5f;
}

struct Prelude : Module {
  enum ParamIds { NUM_PARAMS };
  enum InputIds { SIGNAL_INPUT, NUM_INPUTS };
  enum OutputIds { SIGNAL_OUTPUT, NUM_OUTPUTS };
  enum LightIds { NUM_LIGHTS };

  Prelude() {
    config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS);
    configInput(SIGNAL_INPUT, "Signal");
    configOutput(SIGNAL_OUTPUT, "Signal");
  }

  void process(const ProcessArgs&) override {
    outputs[SIGNAL_OUTPUT].setVoltage(preludeScale(inputs[SIGNAL_INPUT].getVoltage()));
  }
};

struct PreludeWidget : ModuleWidget {
  int nativeUiOnly = 42;
};
Model* modelPrelude = createModel<Prelude, PreludeWidget>("Prelude");
