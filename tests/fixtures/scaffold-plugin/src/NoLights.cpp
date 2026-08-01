#include "plugin.hpp"
#include "UiUmbrella.hpp"

struct ForeignLightUser {
  Light lights[1];
  void update() { lights[0].setBrightness(1.f); }
};

struct NoLights : Module {
  enum ParamIds { LEVEL_PARAM, NUM_PARAMS };
  enum InputIds { SIGNAL_INPUT, NUM_INPUTS };
  enum OutputIds { SIGNAL_OUTPUT, NUM_OUTPUTS };
  fixture::NamespacedGain gain;
  fixture::NamespacedTemplateGain<1> templateGain;

  NoLights() {
    const float initialLevel = 1.25f;
    config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS);
    configParam(LEVEL_PARAM, 0.f, 2.f, initialLevel, "Level");
    configInput(SIGNAL_INPUT, "Signal");
    configOutput(SIGNAL_OUTPUT, "Signal");
  }

  void process(const ProcessArgs&) override {
    outputs[SIGNAL_OUTPUT].setVoltage(gain.apply(templateGain.apply(inputs[SIGNAL_INPUT].getVoltage())) * params[LEVEL_PARAM].getValue());
  }
};

struct NoLightsWidget : ModuleWidget {};
Model* modelNoLights = createModel<NoLights, NoLightsWidget>("NoLights");
