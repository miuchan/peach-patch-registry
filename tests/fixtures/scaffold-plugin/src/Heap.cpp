#include "plugin.hpp"

struct HeapModule : Module {
  enum ParamId { NUM_PARAMS };
  enum InputId { SIGNAL_INPUT, NUM_INPUTS };
  enum OutputId { SIGNAL_OUTPUT, NUM_OUTPUTS };
  enum LightId { NUM_LIGHTS };
  std::vector<float> storage;

  HeapModule() : storage(1100000, 0.f) {
    std::printf("heap fixture initialized\n");
    config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS);
    configInput(SIGNAL_INPUT, "Signal");
    configOutput(SIGNAL_OUTPUT, "Signal");
  }

  void process(const ProcessArgs&) override {
    outputs[SIGNAL_OUTPUT].setChannels(1);
    outputs[SIGNAL_OUTPUT].setVoltage(inputs[SIGNAL_INPUT].getVoltage() + storage[0]);
  }
};

struct HeapWidget : ModuleWidget {};
Model* modelHeap = createModel<HeapModule, HeapWidget>("Heap");
