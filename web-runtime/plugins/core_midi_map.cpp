#include "core_midi_common.hpp"

// MIDI-Map's cross-module parameter handles belong to the Rack host rather
// than to module DSP. The AudioWorklet implements those handles; this adapter
// owns the exact .vcv JSON so import, save, undo, and redo stay lossless.
struct CoreMidiMap : Module {
  enum ParamIds { NUM_PARAMS };
  enum InputIds { NUM_INPUTS };
  enum OutputIds { NUM_OUTPUTS };
  enum LightIds { NUM_LIGHTS };
  json_t* state = json_object();
  CoreMidiMap() { config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS); }
  ~CoreMidiMap() override { json_decref(state); }
  json_t* dataToJson() override { return json_deep_copy(state); }
  void dataFromJson(json_t* root) override {
    json_t* next = json_deep_copy(root);
    if (!json_is_object(next)) { json_decref(next); next = json_object(); }
    json_decref(state);
    state = next;
  }
};

RACK_WEB_EXPORTS(CoreMidiMap)

