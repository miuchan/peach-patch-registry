#include "plugin.hpp"
//#define FIXTURE_UNUSED_IMPLEMENTATION
//#include "Unrelated.hpp"

struct FixtureDspBase : Module {
  float bias = 0.75f;
  std::string skin = "default";
  float transform(float value) const { return value * 2.f + bias; }
  json_t* dataToJson() override {
    json_t* root = json_object();
    json_object_set_new(root, "skin", json_string(skin.c_str()));
    return root;
  }
};

template<class BASE>
struct FixtureForwardingBase : BASE {
  float forwarded(float value) const { return BASE::transform(value); }
};

typedef FixtureForwardingBase<FixtureDspBase> FixtureForwardedBase;

struct InheritedModule : FixtureForwardedBase {
  enum ParamIds { LEVEL_PARAM, NUM_PARAMS };
  enum InputIds { VALUE_INPUT, NUM_INPUTS };
  enum OutputIds { VALUE_OUTPUT, NUM_OUTPUTS };
  enum LightIds { NUM_LIGHTS };
  float sampleRateScale = 1.f;

  InheritedModule() {
    config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS);
    configParam(LEVEL_PARAM, 0.f, 2.f, 1.f, "Level");
    configInput(VALUE_INPUT, "Value");
    configOutput(VALUE_OUTPUT, "Value");
  }

  void onSampleRateChange() override {
    sampleRateScale = APP->engine->getSampleRate() / 48000.f;
  }

  void process(const ProcessArgs&) override {
    outputs[VALUE_OUTPUT].setChannels(1);
    outputs[VALUE_OUTPUT].setVoltage(forwarded(inputs[VALUE_INPUT].getVoltage()) * params[LEVEL_PARAM].getValue() * sampleRateScale);
  }
};

struct InheritedWidget : ModuleWidget {};
Model* modelInherited = createModel<InheritedModule, InheritedWidget>("Inherited");
