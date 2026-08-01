#include "plugin.hpp"

struct FixtureExpanderBase : Module {
  struct Message { float value = 0.f; };
  enum ExpanderParamId { EXP_LEVEL_PARAM, EXP_PARAMS_LEN };
  enum ExpanderInputId { EXP_CV_INPUT, EXP_INPUTS_LEN };
  enum ExpanderOutputId { EXP_OUTPUTS_LEN };
  enum ExpanderLightId { EXP_CONNECTED_LIGHT, EXP_LIGHTS_LEN };
};

struct ExpanderOnlyModule : FixtureExpanderBase {
  ExpanderOnlyModule() {
    config(EXP_PARAMS_LEN, EXP_INPUTS_LEN, EXP_OUTPUTS_LEN, EXP_LIGHTS_LEN);
    configParam(EXP_LEVEL_PARAM, 0.f, 1.f, 0.5f, "Level");
    configInput(EXP_CV_INPUT, "CV");
    configLight(EXP_CONNECTED_LIGHT, "Connected");
  }
  void process(const ProcessArgs&) override {
    if (leftExpander.module) {
      auto* message = static_cast<Message*>(leftExpander.producerMessage);
      message->value = 1.f + 3.f * params[EXP_LEVEL_PARAM].getValue();
      leftExpander.requestMessageFlip();
      lights[EXP_CONNECTED_LIGHT].setBrightness(1.f);
    }
  }
};

struct ExpanderOnlyWidget : ModuleWidget {};
Model* modelExpanderOnly = createModel<ExpanderOnlyModule, ExpanderOnlyWidget>("ExpanderOnly");
