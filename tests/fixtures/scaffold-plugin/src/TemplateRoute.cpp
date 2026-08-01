#include "plugin.hpp"

template <int INPUTS, int OUTPUTS>
struct TemplateRoute : Module {
  enum ParamIds { NUM_PARAMS };
  enum InputIds { ENUMS(IN_INPUTS, INPUTS), NUM_INPUTS };
  enum OutputIds { ENUMS(OUT_OUTPUTS, OUTPUTS), NUM_OUTPUTS };
  enum LightIds { NUM_LIGHTS };

  TemplateRoute() {
    config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS);
    for (int index = 0; index < INPUTS; index++) configInput(IN_INPUTS + index, string::f("Input %d", index + 1));
    for (int index = 0; index < OUTPUTS; index++) configOutput(OUT_OUTPUTS + index, string::f("Output %d", index + 1));
  }

  void process(const ProcessArgs&) override {
    const int channels = std::max(1, inputs[IN_INPUTS].getChannels());
    for (int output = 0; output < OUTPUTS; output++) {
      outputs[OUT_OUTPUTS + output].setChannels(channels);
      outputs[OUT_OUTPUTS + output].writeVoltages(inputs[IN_INPUTS + output % INPUTS].getVoltages());
    }
  }
};

Model* modelTemplateRoute = createModel<TemplateRoute<1, 4>, TemplateRouteWidget<1, 4>>("TemplateRoute");
