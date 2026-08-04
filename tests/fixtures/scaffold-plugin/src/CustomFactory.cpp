#include "plugin.hpp"

struct CustomFactoryDsp : Module {
  enum ParamIds { OFFSET_PARAM, NUM_PARAMS };
  enum InputIds { SIGNAL_INPUT, NUM_INPUTS };
  enum OutputIds { SIGNAL_OUTPUT, NUM_OUTPUTS };
  enum LightIds { NUM_LIGHTS };

  CustomFactoryDsp() {
    config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS);
    configParam(OFFSET_PARAM, -5.f, 5.f, 1.f, "Offset");
    configInput(SIGNAL_INPUT, "Signal");
    configOutput(SIGNAL_OUTPUT, "Signal");
  }

  void process(const ProcessArgs&) override {
    outputs[SIGNAL_OUTPUT].setVoltage(
      inputs[SIGNAL_INPUT].getVoltage() + params[OFFSET_PARAM].getValue()
    );
  }
};

struct CustomFactoryWidget : ModuleWidget {};

struct CustomFactoryModel : plugin::Model {
  engine::Module* createModule() override { return new CustomFactoryDsp; }
  app::ModuleWidget* createModuleWidget(engine::Module* module) override {
    return createCustomFactoryWidget(static_cast<CustomFactoryDsp*>(module));
  }
};

Model* modelCustomFactory = []() {
  plugin::Model* model = new CustomFactoryModel;
  model->slug = "CustomFactory";
  return model;
}();
