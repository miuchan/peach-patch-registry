// DSP-only monophonic web translation of Fundamental SEQ3 2.6.4.
// Original source: https://github.com/VCVRack/Fundamental
// Copyright VCV, licensed GPL-3.0-or-later.

#include "rack_web_export.hpp"
#include <algorithm>

struct FundamentalSEQ3 : Module {
  enum ParamIds { TEMPO_PARAM, RUN_PARAM, RESET_PARAM, TRIG_PARAM, CV_PARAMS, GATE_PARAMS = CV_PARAMS + 24, TEMPO_CV_PARAM = GATE_PARAMS + 8, STEPS_CV_PARAM, CLOCK_PARAM, NUM_PARAMS };
  enum InputIds { TEMPO_INPUT, CLOCK_INPUT, RESET_INPUT, STEPS_INPUT, RUN_INPUT, NUM_INPUTS };
  enum OutputIds { TRIG_OUTPUT, CV_OUTPUTS, STEP_OUTPUTS = CV_OUTPUTS + 3, STEPS_OUTPUT = STEP_OUTPUTS + 8, CLOCK_OUTPUT, RUN_OUTPUT, RESET_OUTPUT, NUM_OUTPUTS };
  enum LightIds { CLOCK_LIGHT, RUN_LIGHT, RESET_LIGHT, GATE_LIGHTS, STEP_LIGHTS = GATE_LIGHTS + 8, NUM_LIGHTS = STEP_LIGHTS + 16 };

  bool running = true;
  bool clockPassthrough = false;
  bool clockButtonHigh = false, runButtonHigh = false, resetButtonHigh = false;
  bool gateButtonHigh[8]{}, gates[8]{true,true,true,true,true,true,true,true};
  dsp::SchmittTrigger clockTrigger, runTrigger, resetTrigger;
  dsp::PulseGenerator runPulse, clockPulse, resetPulse;
  float phase = 0.f;
  int index = 0;

  FundamentalSEQ3() {
    config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS);
    configParam(TEMPO_PARAM, -2.f, 4.f, 1.f, "Tempo");
    configParam(RUN_PARAM, 0.f, 1.f, 0.f, "Run");
    configParam(RESET_PARAM, 0.f, 1.f, 0.f, "Reset");
    configParam(TRIG_PARAM, 1.f, 8.f, 8.f, "Steps");
    for (int id = 0; id < 24; id++) configParam(CV_PARAMS + id, -10.f, 10.f, 0.f, "CV");
    for (int id = 0; id < 8; id++) configParam(GATE_PARAMS + id, 0.f, 1.f, 0.f, "Gate");
    configParam(TEMPO_CV_PARAM, 0.f, 1.f, 1.f, "Tempo CV");
    configParam(STEPS_CV_PARAM, 0.f, 1.f, 1.f, "Steps CV");
    configParam(CLOCK_PARAM, 0.f, 1.f, 0.f, "Clock");
  }

  static bool risingButton(float value, bool& previous) {
    const bool high = value > 0.f;
    const bool rising = high && !previous;
    previous = high;
    return rising;
  }

  void setState(int id, float value) override {
    if (id == 0) running = value != 0.f;
    else if (id == 1) clockPassthrough = value != 0.f;
    else if (id >= 2 && id < 10) gates[id - 2] = value != 0.f;
  }

  void process(const ProcessArgs& args) override {
    if (risingButton(params[RUN_PARAM].getValue(), runButtonHigh) || runTrigger.process(inputs[RUN_INPUT].getVoltage(), .1f, 2.f)) {
      running = !running;
      runPulse.trigger(1e-3f);
    }
    const bool runGate = runPulse.process(args.sampleTime);
    const int oldIndex = index;
    if (risingButton(params[RESET_PARAM].getValue(), resetButtonHigh) || resetTrigger.process(inputs[RESET_INPUT].getVoltage(), .1f, 2.f)) {
      resetPulse.trigger(1e-3f);
      index = 0;
      phase = 0.f;
    }
    const bool resetGate = resetPulse.process(args.sampleTime);

    bool clock = false, clockGate = false;
    if (running) {
      const bool clockButton = risingButton(params[CLOCK_PARAM].getValue(), clockButtonHigh);
      if (inputs[CLOCK_INPUT].isConnected()) {
        if (clockTrigger.process(inputs[CLOCK_INPUT].getVoltage(), .1f, 2.f) && !resetGate) clock = true;
        if (clockButton) clock = true;
        clockGate = clockTrigger.isHigh() || clockButtonHigh;
      } else {
        const float clockPitch = params[TEMPO_PARAM].getValue() + inputs[TEMPO_INPUT].getVoltage() * params[TEMPO_CV_PARAM].getValue();
        phase += std::exp2(clockPitch) * args.sampleTime;
        if (phase >= 1.f && !resetGate) { clock = true; phase -= std::trunc(phase); }
        if (clockButton) { clock = true; phase = 0.f; }
        clockGate = phase < .5f;
      }
    }
    const float stepValue = params[TRIG_PARAM].getValue() + inputs[STEPS_INPUT].getVoltage() * params[STEPS_CV_PARAM].getValue();
    const int numSteps = std::clamp(static_cast<int>(std::round(stepValue)), 1, 8);
    if (clock && ++index >= numSteps) index = 0;
    if (index != oldIndex) clockPulse.trigger(1e-3f);
    if (!clockPassthrough) clockGate = clockPulse.process(args.sampleTime);

    for (int step = 0; step < 8; step++) {
      if (risingButton(params[GATE_PARAMS + step].getValue(), gateButtonHigh[step])) gates[step] = !gates[step];
      lights[GATE_LIGHTS + step].setBrightness(gates[step]);
      outputs[STEP_OUTPUTS + step].setVoltage(index == step ? 10.f : 0.f);
      lights[STEP_LIGHTS + step * 2].setBrightness(index == step);
      lights[STEP_LIGHTS + step * 2 + 1].setBrightness(step >= numSteps);
    }
    for (int row = 0; row < 3; row++) outputs[CV_OUTPUTS + row].setVoltage(params[CV_PARAMS + row * 8 + index].getValue());
    outputs[TRIG_OUTPUT].setVoltage(clockGate && gates[index] ? 10.f : 0.f);
    outputs[STEPS_OUTPUT].setVoltage(static_cast<float>(numSteps - 1));
    outputs[CLOCK_OUTPUT].setVoltage(clockGate ? 10.f : 0.f);
    outputs[RUN_OUTPUT].setVoltage(runGate ? 10.f : 0.f);
    outputs[RESET_OUTPUT].setVoltage(resetGate ? 10.f : 0.f);
    lights[CLOCK_LIGHT].setBrightness(clockGate);
    lights[RUN_LIGHT].setBrightness(running);
    lights[RESET_LIGHT].setBrightness(resetGate);
  }
};

RACK_WEB_EXPORTS(FundamentalSEQ3)
