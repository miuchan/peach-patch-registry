#include "core_midi_common.hpp"

struct CoreGateMidi : Module {
  enum ParamIds { NUM_PARAMS };
  enum InputIds { GATE_INPUTS, NUM_INPUTS = GATE_INPUTS + 16 };
  enum OutputIds { NUM_OUTPUTS };
  enum LightIds { NUM_LIGHTS };

  CoreMidiPortState midi{.channel = 0};
  int8_t learned[16]{};
  bool velocityMode = false;
  bool high[128]{};

  CoreGateMidi() {
    config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS);
    for (int y = 0; y < 4; y++) for (int x = 0; x < 4; x++) learned[4 * y + x] = 36 + 4 * (3 - y) + x;
    for (int id = 0; id < 16; id++) configInput(id, string::f("Cell %d", id + 1));
  }
  void process(const ProcessArgs&) override {
    for (int id = 0; id < 16; id++) {
      const int note = learned[id];
      if (note < 0) continue;
      const float voltage = inputs[id].getVoltage();
      const int velocity = velocityMode ? coreMidiClamp7(voltage / 10.f * 127.f) : 100;
      const bool gate = velocityMode ? velocity > 0 : (high[note] ? voltage > .1f : voltage >= 2.f);
      if (gate == high[note]) continue;
      high[note] = gate;
      coreMidiEmit(*this, midi, gate ? 0x90 : 0x80, note, velocity);
    }
  }
  json_t* dataToJson() override {
    json_t* root = json_object();
    json_object_set_new(root, "notes", coreMidiIntArray(learned, 16));
    json_object_set_new(root, "velocity", json_boolean(velocityMode));
    json_object_set_new(root, "midi", midi.toJson());
    return root;
  }
  void dataFromJson(json_t* root) override { coreMidiReadIntArray(root, "notes", learned, 16); velocityMode = coreMidiBool(root, "velocity", velocityMode); midi.fromJson(root); }
};

RACK_WEB_EXPORTS(CoreGateMidi)

