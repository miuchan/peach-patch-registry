#include "Simple.hpp"

struct FixtureWidget : ModuleWidget {
  FixtureWidget(FixtureModule* module) {
    addParam(createParamCentered<RoundBlackKnob>(mm2px(Vec(10, 20)), module, FixtureModule::LEVEL_PARAM));
    addInput(createInput<PJ301MPort>(Vec(12, 300), module, FixtureModule::SIGNAL_INPUT));
    addOutput(createOutputCentered<PJ301MPort>(Vec(150, 330), module, FixtureModule::SIGNAL_OUTPUT));
  }
};
Model* modelFixture = createModel<FixtureModule, FixtureWidget>("Simple");
