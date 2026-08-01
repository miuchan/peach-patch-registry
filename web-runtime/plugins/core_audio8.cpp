// Browser boundary adapter for Rack Core AudioInterface (Audio-8) 2.6.6.
// Eight Rack inputs are consumed by the Web Audio destination. Eight outputs
// are reserved for future browser media-device inputs and currently emit 0V.
// Original source: https://github.com/VCVRack/Rack (GPL-3.0-or-later).

#include "rack_web_export.hpp"
#include <algorithm>

struct CoreAudio8 : Module {
  enum ParamIds { NUM_PARAMS };
  enum InputIds { AUDIO_INPUTS, NUM_INPUTS = AUDIO_INPUTS + 8 };
  enum OutputIds { AUDIO_OUTPUTS, NUM_OUTPUTS = AUDIO_OUTPUTS + 8 };
  enum LightIds { INPUT_LIGHTS, OUTPUT_LIGHTS = INPUT_LIGHTS + 8, NUM_LIGHTS = OUTPUT_LIGHTS + 8 };
  CoreAudio8() { config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS); }
  void process(const ProcessArgs&) override {
    for (int id = 0; id < 8; id++) {
      outputs[id].setVoltage(0.f);
      const float level = std::fabs(inputs[id].getVoltage()) / 10.f;
      lights[(id / 2) * 2].setBrightness(std::min(1.f, level));
      lights[8 + (id / 2) * 2].setBrightness(0.f);
    }
  }
};

RACK_WEB_EXPORTS(CoreAudio8)
