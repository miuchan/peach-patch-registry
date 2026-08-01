#include "plugin.hpp"

struct FixtureDisplay : TransparentWidget {
  void draw(const DrawArgs&) override {
    APP->window->loadFont(asset::plugin(pluginInstance, "res/font.ttf"));
  }
};

struct WidgetAssetsModule : rack::Module {
  enum ParamIds { NUM_PARAMS };
  enum InputIds { SIGNAL_INPUT, NUM_INPUTS };
  enum OutputIds { SIGNAL_OUTPUT, NUM_OUTPUTS };
  enum LightIds { NUM_LIGHTS };
  float rate = 0.f;

  WidgetAssetsModule() {
    config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS);
    configInput(SIGNAL_INPUT, "Signal");
    configOutput(SIGNAL_OUTPUT, "Signal");
    rate = APP->engine->getSampleRate();
  }
  void onSampleRateChange(const SampleRateChangeEvent& event) override {
    rate = event.sampleRate;
  }
  void process(const ProcessArgs&) override {
    outputs[SIGNAL_OUTPUT].setVoltage(inputs[SIGNAL_INPUT].getVoltage() * rate / 48000.f);
  }
};

struct WidgetAssetsWidget : ModuleWidget {
  WidgetAssetsWidget(WidgetAssetsModule* module) {
    setModule(module);
    setPanel(createPanel(asset::plugin(pluginInstance, "res/WidgetAssets.svg")));
  }
};

Model* modelWidgetAssets = createModel<WidgetAssetsModule, WidgetAssetsWidget>("WidgetAssets");
