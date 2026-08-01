#include "core_midi_common.hpp"

struct CoreCvMidiCc : Module {
  enum ParamIds { NUM_PARAMS };
  enum InputIds { CC_INPUTS, NUM_INPUTS = CC_INPUTS + 16 };
  enum OutputIds { NUM_OUTPUTS };
  enum LightIds { NUM_LIGHTS };

  CoreMidiPortState midi{.channel = 0};
  CoreMidiRateLimiter limiter;
  int8_t learned[16]{};
  int16_t last[128]{};

  CoreCvMidiCc() {
    config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS);
    for (int cc = 0; cc < 128; cc++) last[cc] = -1;
    for (int id = 0; id < 16; id++) { learned[id] = id + 1; configInput(id, string::f("Cell %d", id + 1)); }
  }
  void process(const ProcessArgs& args) override {
    if (!limiter.process(args.sampleTime)) return;
    for (int id = 0; id < 16; id++) {
      const int cc = learned[id];
      if (cc < 0) continue;
      const int value = coreMidiClamp7(inputs[id].getVoltage() / 10.f * 127.f);
      if (last[cc] == value) continue;
      last[cc] = value;
      coreMidiEmit(*this, midi, 0xb0, cc, value);
    }
  }
  json_t* dataToJson() override {
    json_t* root = json_object();
    json_object_set_new(root, "ccs", coreMidiIntArray(learned, 16));
    json_object_set_new(root, "midi", midi.toJson());
    return root;
  }
  void dataFromJson(json_t* root) override { coreMidiReadIntArray(root, "ccs", learned, 16); midi.fromJson(root); }
};

RACK_WEB_EXPORTS(CoreCvMidiCc)

