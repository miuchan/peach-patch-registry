#pragma once
#include "rack_web_export.hpp"

template <int Channels, bool HasLevel>
struct CoreAudioBoundary : Module {
  enum ParamIds { LEVEL_PARAM, NUM_PARAMS = HasLevel ? 1 : 0 };
  enum InputIds { AUDIO_INPUTS, NUM_INPUTS = Channels };
  enum OutputIds { AUDIO_OUTPUTS, NUM_OUTPUTS = Channels };
  enum LightIds { NUM_LIGHTS = HasLevel ? 12 : Channels * 2 };
  CoreAudioBoundary() {
    config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS);
    if constexpr (HasLevel) configParam(LEVEL_PARAM, 0.f, 2.f, 1.f, "Level");
    for (int id = 0; id < Channels; id++) {
      configInput(id, string::f("To device output %d", id + 1));
      configOutput(id, string::f("From device input %d", id + 1));
    }
  }
  void process(const ProcessArgs&) override {
    for (int id = 0; id < Channels; id++) outputs[id].setVoltage(0.f);
  }
};

