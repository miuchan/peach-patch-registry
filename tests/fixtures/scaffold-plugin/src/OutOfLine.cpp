#include "plugin.hpp"

struct OutOfLineModule : Module {
  enum ParamIds { NUM_PARAMS };
  enum InputIds { VALUE_INPUT, NUM_INPUTS };
  enum OutputIds { VALUE_OUTPUT, NUM_OUTPUTS };
  enum LightIds { VALUE_LIGHT, NUM_LIGHTS = VALUE_LIGHT + 4 };

  float values[40]{};

  OutOfLineModule() {
    config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS);
    configInput(VALUE_INPUT, "Value");
    configOutput(VALUE_OUTPUT, "Value");
  }

  json_t* dataToJson() override {
    json_t* root = json_object();
    json_t* valuesJson = json_array();
    for (int index = 0; index < 40; index++)
      json_array_append_new(valuesJson, json_real(values[index]));
    json_object_set_new(root, "values", valuesJson);
    return root;
  }

  void dataFromJson(json_t* root) override {
    json_t* valuesJson = json_object_get(root, "values");
    if (json_is_array(valuesJson)) for (int index = 0; index < 40; index++)
      values[index] = json_number_value(json_array_get(valuesJson, index));
  }

  void process(const ProcessArgs&) override;
};

static const float fixtureOutOfLineScale = 2.f;

/*
int OutOfLineModule::removedMethod() {
  int values = 7;
  json_righteal(values);
  return values;
}
*/

static float fixtureOutOfLineHelper(float value) {
  return value * fixtureOutOfLineScale;
}

void OutOfLineModule::process(const ProcessArgs&) {
  outputs[VALUE_OUTPUT].setChannels(1);
  outputs[VALUE_OUTPUT].setVoltage(fixtureOutOfLineHelper(inputs[VALUE_INPUT].getVoltage() + values[0] + values[39]));
  lights[VALUE_LIGHT + 3].value = 0.5f;
}

struct OutOfLineWidget : ModuleWidget {};
Model* modelOutOfLine = createModel<OutOfLineModule, OutOfLineWidget>("OutOfLine");
