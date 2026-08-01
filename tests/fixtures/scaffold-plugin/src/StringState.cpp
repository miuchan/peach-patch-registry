#include "plugin.hpp"

#define LINEAR_MODE "linear"
#define PITCHED_MODE "pitched"

struct StringState : Module {
  enum ParamIds { NUM_PARAMS };
  enum InputIds { SIGNAL_INPUT, NUM_INPUTS };
  enum OutputIds { SIGNAL_OUTPUT, NUM_OUTPUTS };
  enum LightIds { NUM_LIGHTS };
  bool pitched = false;

  StringState() {
    config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS);
    configInput(SIGNAL_INPUT, "Signal");
    configOutput(SIGNAL_OUTPUT, "Signal");
  }

  void process(const ProcessArgs&) override {
    outputs[SIGNAL_OUTPUT].setVoltage(inputs[SIGNAL_INPUT].getVoltage() * (pitched ? 2.f : 1.f));
  }

  json_t* dataToJson() override {
    json_t* root = json_object();
    if (pitched) json_object_set_new(root, "mode", json_string(PITCHED_MODE));
    else json_object_set_new(root, "mode", json_string(LINEAR_MODE));
    return root;
  }

  void dataFromJson(json_t* root) override {
    json_t* mode = json_object_get(root, "mode");
    if (mode) pitched = strcmp(json_string_value(mode), PITCHED_MODE) == 0;
  }
};

struct StringStateWidget : ModuleWidget {};
Model* modelStringState = createModel<StringState, StringStateWidget>("StringState");
