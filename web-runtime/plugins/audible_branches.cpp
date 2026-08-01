// DSP-only monophonic web translation of Audible Instruments Branches 2.0.0.
// Original source: https://github.com/VCVRack/AudibleInstruments
// Copyright Emilie Gillet and VCV, licensed GPL-3.0-or-later.

#include "rack_web_export.hpp"

struct AudibleBranches : Module {
  enum ParamIds { THRESHOLD1_PARAM, THRESHOLD2_PARAM, MODE1_PARAM, MODE2_PARAM, NUM_PARAMS };
  enum InputIds { IN1_INPUT, IN2_INPUT, P1_INPUT, P2_INPUT, NUM_INPUTS };
  enum OutputIds { OUT1A_OUTPUT, OUT2A_OUTPUT, OUT1B_OUTPUT, OUT2B_OUTPUT, NUM_OUTPUTS };
  enum LightIds { STATE1_B_LIGHT, STATE1_A_LIGHT, STATE2_B_LIGHT, STATE2_A_LIGHT, NUM_LIGHTS };
  bool gateHigh[2]{};
  bool modeButtonHigh[2]{};
  bool modes[2]{};
  bool outcomes[2]{};

  AudibleBranches() {
    config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS);
    configParam(THRESHOLD1_PARAM, 0.f, 1.f, .5f, "Channel 1 probability");
    configParam(THRESHOLD2_PARAM, 0.f, 1.f, .5f, "Channel 2 probability");
    configParam(MODE1_PARAM, 0.f, 1.f, 0.f, "Channel 1 mode");
    configParam(MODE2_PARAM, 0.f, 1.f, 0.f, "Channel 2 mode");
  }

  void setState(int id, float value) override { if (id >= 0 && id < 2) modes[id] = value != 0.f; }

  void process(const ProcessArgs&) override {
    for (int channel = 0; channel < 2; channel++) {
      const bool nextButton = params[MODE1_PARAM + channel].getValue() > 0.f;
      if (nextButton && !modeButtonHigh[channel]) modes[channel] = !modes[channel];
      modeButtonHigh[channel] = nextButton;
      const int inputId = IN1_INPUT + channel;
      const float voltage = channel == 1 && !inputs[inputId].isConnected() ? inputs[IN1_INPUT].getVoltage() : inputs[inputId].getVoltage();
      const bool gate = voltage >= 2.f;
      if (gate && !gateHigh[channel]) {
        const float threshold = params[THRESHOLD1_PARAM + channel].getValue() + inputs[P1_INPUT + channel].getVoltage() / 10.f;
        const bool toss = rack::random::uniform() < threshold;
        if (!modes[channel]) outcomes[channel] = toss;
        else if (toss) outcomes[channel] = !outcomes[channel];
      }
      gateHigh[channel] = gate;
      const bool gateA = !outcomes[channel] && (modes[channel] || gate);
      const bool gateB = outcomes[channel] && (modes[channel] || gate);
      outputs[OUT1A_OUTPUT + channel].setVoltage(gateA ? 10.f : 0.f);
      outputs[OUT1B_OUTPUT + channel].setVoltage(gateB ? 10.f : 0.f);
      lights[channel * 2 + 1].setBrightness(gateA ? 1.f : 0.f);
      lights[channel * 2].setBrightness(gateB ? 1.f : 0.f);
    }
  }
};

RACK_WEB_EXPORTS(AudibleBranches)
