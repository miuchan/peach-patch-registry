#include "core_midi_common.hpp"

struct CoreMidiCcCv : Module {
  enum ParamIds { NUM_PARAMS };
  enum InputIds { NUM_INPUTS };
  enum OutputIds { CC_OUTPUTS, NUM_OUTPUTS = CC_OUTPUTS + 16 };
  enum LightIds { NUM_LIGHTS };

  CoreMidiPortState midi;
  int8_t values[128][16]{};
  int8_t msb[32][16]{};
  int8_t learned[16]{};
  float filtered[16][16]{};
  bool smooth = true;
  bool mpeMode = false;
  bool lsbMode = false;

  CoreMidiCcCv() {
    config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS);
    for (int id = 0; id < 16; id++) { learned[id] = id + 1; configOutput(id, string::f("Cell %d", id + 1)); }
  }

  void rackWebPushMidi(int size, int status, int data1, int data2) override {
    if (size < 3 || !midi.accepts(status) || (status & 0xf0) != 0xb0) return;
    const int channel = mpeMode ? (status & 0xf) : 0;
    const int cc = data1 & 0x7f;
    const int8_t value = static_cast<int8_t>(data2 & 0xff);
    if (lsbMode && cc < 32) msb[cc][channel] = value;
    else if (lsbMode && cc < 64) { values[cc - 32][channel] = msb[cc - 32][channel]; values[cc][channel] = value; }
    else values[cc][channel] = value;
  }

  void process(const ProcessArgs& args) override {
    const int channels = mpeMode ? 16 : 1;
    for (int id = 0; id < 16; id++) {
      outputs[id].setChannels(channels);
      const int cc = learned[id];
      for (int channel = 0; channel < channels; channel++) {
        if (cc < 0) { outputs[id].setVoltage(0.f, channel); continue; }
        int cell = static_cast<int>(values[cc][channel]) * 128;
        if (lsbMode && cc < 32) cell += values[cc + 32][channel];
        const float target = std::clamp(static_cast<float>(cell) / (128.f * 127.f), -1.f, 1.f);
        if (!smooth || std::fabs(filtered[id][channel] - target) >= 1.f) filtered[id][channel] = target;
        else filtered[id][channel] += (target - filtered[id][channel]) * std::min(1.f, 30.f * args.sampleTime);
        outputs[id].setVoltage(filtered[id][channel] * 10.f, channel);
      }
    }
  }

  json_t* dataToJson() override {
    json_t* root = json_object();
    json_object_set_new(root, "ccs", coreMidiIntArray(learned, 16));
    json_t* stored = json_array();
    for (int cc = 0; cc < 128; cc++) json_array_append_new(stored, json_integer(values[cc][0]));
    json_object_set_new(root, "values", stored);
    json_object_set_new(root, "midi", midi.toJson());
    json_object_set_new(root, "smooth", json_boolean(smooth));
    json_object_set_new(root, "mpeMode", json_boolean(mpeMode));
    json_object_set_new(root, "lsbMode", json_boolean(lsbMode));
    return root;
  }

  void dataFromJson(json_t* root) override {
    coreMidiReadIntArray(root, "ccs", learned, 16);
    json_t* stored = json_object_get(root, "values");
    if (json_is_array(stored)) for (int cc = 0; cc < 128; cc++) if (json_t* value = json_array_get(stored, cc)) values[cc][0] = static_cast<int8_t>(json_integer_value(value));
    midi.fromJson(root);
    smooth = coreMidiBool(root, "smooth", smooth);
    mpeMode = coreMidiBool(root, "mpeMode", mpeMode);
    lsbMode = coreMidiBool(root, "lsbMode", lsbMode);
  }
};

RACK_WEB_EXPORTS(CoreMidiCcCv)

