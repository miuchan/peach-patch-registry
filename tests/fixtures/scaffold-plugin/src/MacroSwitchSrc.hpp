struct FixtureCenteredLabel : Widget {
  void updateText();
};
inline void FixtureCenteredLabel::updateText() {}

struct STRUCT_NAME : Module {
  enum ParamIds { SELECT_PARAM, NUM_PARAMS };
  enum InputIds {
#ifdef ROUTE_TO_ONE
    ENUMS(SIGNAL_INPUTS, ROUTE_COUNT),
#else
    SIGNAL_INPUT,
#endif
    NUM_INPUTS
  };
  enum OutputIds {
#ifdef ROUTE_TO_ONE
    SIGNAL_OUTPUT,
#else
    ENUMS(SIGNAL_OUTPUTS, ROUTE_COUNT),
#endif
    NUM_OUTPUTS
  };
  enum LightIds { ENUMS(ROUTE_LIGHTS, ROUTE_COUNT), NUM_LIGHTS };

  #include "MacroSwitchMacros.hpp"
  #include "MacroSwitchMembers.hpp"

  STRUCT_NAME() {
    config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS);
    configSwitch(SELECT_PARAM, 0.f, ROUTE_COUNT - 1, 0.f, "Route", {"One", "Two"});
#ifdef ROUTE_TO_ONE
    for (int index = 0; index < ROUTE_COUNT; index++) configInput(SIGNAL_INPUTS + index, "Signal");
    configOutput(SIGNAL_OUTPUT, "Signal");
#else
    configInput(SIGNAL_INPUT, "Signal");
    for (int index = 0; index < ROUTE_COUNT; index++) configOutput(SIGNAL_OUTPUTS + index, "Signal");
#endif
  }

  json_t* dataToJson() override {
    json_t* root = json_object();
    #include "MacroSwitchStateToJson.hpp"
    return root;
  }

  void dataFromJson(json_t* root) override {
    #include "MacroSwitchStateFromJson.hpp"
  }

  void process(const ProcessArgs&) override {
    selected = clamp(static_cast<int>(params[SELECT_PARAM].getValue()), 0, ROUTE_COUNT - 1);
#ifdef ROUTE_TO_ONE
    outputs[SIGNAL_OUTPUT].setVoltage(inputs[SIGNAL_INPUTS + selected].getVoltage());
#else
    for (int index = 0; index < ROUTE_COUNT; index++)
      outputs[SIGNAL_OUTPUTS + index].setVoltage(index == selected ? inputs[SIGNAL_INPUT].getVoltage() : 0.f);
#endif
    for (int index = 0; index < ROUTE_COUNT; index++) lights[ROUTE_LIGHTS + index].setBrightness(index == selected);
  }
};

struct WIDGET_NAME : ModuleWidget {};
Model* MODEL_NAME = createModel<STRUCT_NAME, WIDGET_NAME>(MODULE_NAME);
