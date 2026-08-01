#include "plugin.hpp"

struct Buffered : Module {
  enum ParamIds { NUM_PARAMS };
  enum InputIds { SIGNAL_INPUT, NUM_INPUTS };
  enum OutputIds { SIGNAL_OUTPUT, NUM_OUTPUTS };
  enum LightIds { NUM_LIGHTS };

  constexpr static size_t BUFFER_SIZE = 1 << 2;
  dsp::DoubleRingBuffer<float, BUFFER_SIZE> buffer;

  Buffered() {
    config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS);
    configInput(SIGNAL_INPUT, "Signal");
    configOutput(SIGNAL_OUTPUT, "Delayed signal");
  }

  void process(const ProcessArgs&) override {
    if (!buffer.full()) buffer.push(inputs[SIGNAL_INPUT].getVoltage());
    outputs[SIGNAL_OUTPUT].setVoltage(buffer.size() > 2 ? buffer.shift() : 0.f);
  }
};

struct BufferedWidget : ModuleWidget {};
Model* modelBuffered = createModel<Buffered, BufferedWidget>("Buffered");
