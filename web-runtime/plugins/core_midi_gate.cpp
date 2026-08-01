#include "core_midi_common.hpp"

struct CoreMidiGate : Module {
  enum ParamIds { NUM_PARAMS };
  enum InputIds { NUM_INPUTS };
  enum OutputIds { GATE_OUTPUTS, NUM_OUTPUTS = GATE_OUTPUTS + 16 };
  enum LightIds { NUM_LIGHTS };

  CoreMidiPortState midi;
  bool gates[16][16]{};
  uint8_t velocities[16][16]{};
  float pulses[16][16]{};
  int8_t learned[16]{};
  int velocityMode = 0;
  bool mpeMode = false;
  bool trigMode = false;

  CoreMidiGate() {
    config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS);
    for (int y = 0; y < 4; y++) for (int x = 0; x < 4; x++) learned[4 * y + x] = 36 + 4 * (3 - y) + x;
    for (int id = 0; id < 16; id++) { configOutput(id, string::f("Gate %d", id + 1)); for (auto& velocity : velocities[id]) velocity = 127; }
  }

  void rackWebPushMidi(int size, int status, int data1, int data2) override {
    if (size < 2 || !midi.accepts(status)) return;
    const int kind = status & 0xf0, channel = mpeMode ? (status & 0xf) : 0, note = data1 & 0x7f;
    if (kind == 0x90 && data2 > 0) {
      for (int id = 0; id < 16; id++) if (learned[id] == note) { gates[id][channel] = true; if (velocityMode == 1) velocities[id][channel] = data2 & 0x7f; pulses[id][channel] = 1e-3f; }
    } else if (kind == 0x80 || (kind == 0x90 && data2 == 0)) {
      for (int id = 0; id < 16; id++) if (learned[id] == note) gates[id][channel] = false;
    } else if (kind == 0xa0 && velocityMode == 2) {
      for (int id = 0; id < 16; id++) if (learned[id] == note) velocities[id][channel] = data2 & 0x7f;
    } else if (kind == 0xd0 && velocityMode == 2) {
      for (int id = 0; id < 16; id++) velocities[id][channel] = data1 & 0x7f;
    }
  }

  void process(const ProcessArgs& args) override {
    const int channels = mpeMode ? 16 : 1;
    for (int id = 0; id < 16; id++) {
      outputs[id].setChannels(channels);
      for (int channel = 0; channel < channels; channel++) {
        const bool pulse = pulses[id][channel] > 0.f;
        pulses[id][channel] = std::max(0.f, pulses[id][channel] - args.sampleTime);
        const bool high = pulse || (!trigMode && gates[id][channel]);
        const float amplitude = velocityMode == 0 ? 1.f : velocities[id][channel] / 127.f;
        outputs[id].setVoltage(high ? amplitude * 10.f : 0.f, channel);
      }
    }
  }

  json_t* dataToJson() override {
    json_t* root = json_object();
    json_object_set_new(root, "notes", coreMidiIntArray(learned, 16));
    json_object_set_new(root, "velocity", json_integer(velocityMode));
    json_object_set_new(root, "mpeMode", json_boolean(mpeMode));
    json_object_set_new(root, "trigMode", json_boolean(trigMode));
    json_object_set_new(root, "midi", midi.toJson());
    return root;
  }
  void dataFromJson(json_t* root) override {
    coreMidiReadIntArray(root, "notes", learned, 16);
    json_t* velocity = json_object_get(root, "velocity");
    if (velocity && velocity->type == json_t::Type::Boolean) velocityMode = json_boolean_value(velocity) ? 1 : 0;
    else if (velocity) velocityMode = std::clamp(static_cast<int>(json_integer_value(velocity)), 0, 2);
    mpeMode = coreMidiBool(root, "mpeMode", mpeMode);
    trigMode = coreMidiBool(root, "trigMode", trigMode);
    midi.fromJson(root);
  }
};

RACK_WEB_EXPORTS(CoreMidiGate)
