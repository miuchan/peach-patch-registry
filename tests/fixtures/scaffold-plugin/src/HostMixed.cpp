#include "plugin.hpp"
#include "HostRegistry.hpp"

struct HostMixed : Module {
  enum ParamIds { RATIO_PARAM, ENUMS(EXTRA_PARAM, HostRegistry::slots), NUM_PARAMS };
  enum InputIds { SIGNAL_INPUT, NUM_INPUTS };
  enum OutputIds { SIGNAL_OUTPUT, NUM_OUTPUTS };
  enum LightIds { NUM_LIGHTS };

  float offset = 0.f;
  float jsonOffset = 0.f;

  HostMixed() {
    config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS);
    configParam<FixtureRatioParam>(RATIO_PARAM, (float)(fixtureMin), (float)(fixtureMax), 2.f, "Ratio");
    for (int index = 0; index < HostRegistry::slots; index++) {
      configParam(EXTRA_PARAM + index, 0.f, 1.f, 0.f, string::f("Extra %i", index + 1));
    }
    configInput(SIGNAL_INPUT, string::f("Track %c", 'A'));
    configOutput(SIGNAL_OUTPUT, "Signal");
    loadHostDefault(&offset);
  }

  void process(const ProcessArgs&) override {
    int division = 0;
    int modulus = 0;
    eucDivMod(-1, 2, &division, &modulus);
    const int mods = APP->window->getMods() & RACK_MOD_MASK;
    const float hostPenalty = hostRegistry.validateHost() ? 100.f : 0.f;
    outputs[SIGNAL_OUTPUT].setVoltage(inputs[SIGNAL_INPUT].getVoltage() + hostRegistry.selected + offset + jsonOffset + division + modulus + mods + HostRegistry::pattern[0] + HostRegistry::pattern[1] + hostPenalty);
  }

  void dataFromJson(json_t* root) override {
    json_t* bank = json_object_get(root, "bank");
    json_t* slots = json_object_get(bank, "slots");
    json_t* step = json_array_get(slots, 1);
    jsonOffset = json_real_value(json_object_get(step, "voltage"));
  }

  json_t* dataToJson() override {
    json_t* root = json_object();
    const std::string dynamicKey = std::string("bank-") + std::to_string(hostRegistry.selected);
    json_object_set_new(root, dynamicKey.c_str(), json_real(jsonOffset));
    return root;
  }
};

struct HostMixedWidget : ModuleWidget {};
Model* modelHostMixed = createModel<HostMixed, HostMixedWidget>("HostMixed");
