// DSP-only web translation of Bruer SEQ1 2.0.3.
// Original source: https://github.com/bruer80/bruer-vcv
// Copyright Bruer, licensed GPL-3.0-or-later.

#include "rack_web_export.hpp"

struct SEQ1 : Module {
  enum ParamIds { GENERATE_PARAM, LENGTH_PARAM, SCALE_PARAM, CLEAR_PARAM, EUCL1_PARAM, EUCL2_PARAM, EUCL3_PARAM, NOTE_C_PARAM, NOTE_CS_PARAM, NOTE_D_PARAM, NOTE_DS_PARAM, NOTE_E_PARAM, NOTE_F_PARAM, NOTE_FS_PARAM, NOTE_G_PARAM, NOTE_GS_PARAM, NOTE_A_PARAM, NOTE_AS_PARAM, NOTE_B_PARAM, NUM_PARAMS };
  enum InputIds { CLOCK_INPUT, RESET_INPUT, NUM_INPUTS };
  enum OutputIds { CV_OUTPUT, TRIG1_OUTPUT, TRIG2_OUTPUT, TRIG3_OUTPUT, NUM_OUTPUTS };
  enum LightIds { CLOCK_LIGHT, BIT1_LIGHT, BIT2_LIGHT, BIT3_LIGHT, BIT4_LIGHT, BIT5_LIGHT, BIT6_LIGHT, BIT7_LIGHT, BIT8_LIGHT, BIT9_LIGHT, BIT10_LIGHT, BIT11_LIGHT, BIT12_LIGHT, BIT13_LIGHT, BIT14_LIGHT, BIT15_LIGHT, BIT16_LIGHT, EUCL1_1_LIGHT, EUCL1_2_LIGHT, EUCL1_3_LIGHT, EUCL1_4_LIGHT, EUCL1_5_LIGHT, EUCL1_6_LIGHT, EUCL1_7_LIGHT, EUCL1_8_LIGHT, EUCL1_9_LIGHT, EUCL1_10_LIGHT, EUCL1_11_LIGHT, EUCL1_12_LIGHT, EUCL1_13_LIGHT, EUCL1_14_LIGHT, EUCL1_15_LIGHT, EUCL1_16_LIGHT, EUCL2_1_LIGHT, EUCL2_2_LIGHT, EUCL2_3_LIGHT, EUCL2_4_LIGHT, EUCL2_5_LIGHT, EUCL2_6_LIGHT, EUCL2_7_LIGHT, EUCL2_8_LIGHT, EUCL2_9_LIGHT, EUCL2_10_LIGHT, EUCL2_11_LIGHT, EUCL2_12_LIGHT, EUCL2_13_LIGHT, EUCL2_14_LIGHT, EUCL2_15_LIGHT, EUCL2_16_LIGHT, EUCL3_1_LIGHT, EUCL3_2_LIGHT, EUCL3_3_LIGHT, EUCL3_4_LIGHT, EUCL3_5_LIGHT, EUCL3_6_LIGHT, EUCL3_7_LIGHT, EUCL3_8_LIGHT, EUCL3_9_LIGHT, EUCL3_10_LIGHT, EUCL3_11_LIGHT, EUCL3_12_LIGHT, EUCL3_13_LIGHT, EUCL3_14_LIGHT, EUCL3_15_LIGHT, EUCL3_16_LIGHT, NOTE_C_LIGHT, NOTE_CS_LIGHT, NOTE_D_LIGHT, NOTE_DS_LIGHT, NOTE_E_LIGHT, NOTE_F_LIGHT, NOTE_FS_LIGHT, NOTE_G_LIGHT, NOTE_GS_LIGHT, NOTE_A_LIGHT, NOTE_AS_LIGHT, NOTE_B_LIGHT, NUM_LIGHTS };

  int step = 0;
  bool shiftRegister[16]{};
  bool noteEnabled[12] = {true,false,true,false,true,true,false,true,false,true,false,true};
  int ranges[24]{};
  dsp::SchmittTrigger clockTrigger, resetTrigger, clearTrigger, noteTriggers[12];
  dsp::PulseGenerator trig1Pulse, trig2Pulse, trig3Pulse;
  int shift1 = 0, shift2 = 0, shift3 = 0;
  float lightTimer = 0.f;

  SEQ1() {
    config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS);
    configParam(GENERATE_PARAM, 0.f, 1.f, 0.f, "Generate");
    configParam(LENGTH_PARAM, 1.f, 16.f, 8.f, "Length");
    configParam(SCALE_PARAM, 1.f, 8.f, 2.f, "Scale");
    configParam(CLEAR_PARAM, 0.f, 1.f, 0.f, "Clear");
    configParam(EUCL1_PARAM, 0.f, 16.f, 4.f, "Euclidean 1");
    configParam(EUCL2_PARAM, 0.f, 16.f, 5.f, "Euclidean 2");
    configParam(EUCL3_PARAM, 0.f, 16.f, 7.f, "Euclidean 3");
    const float defaults[12] = {1,0,1,0,1,1,0,1,0,1,0,1};
    for (int note = 0; note < 12; note++) configParam(NOTE_C_PARAM + note, 0.f, 1.f, defaults[note], "Note");
    updateRanges();
  }

  bool euclid(int position, int hits, int length) const {
    if (hits <= 0) return false;
    if (hits >= length) return true;
    return ((position * hits) % length) < hits;
  }

  void updateRanges() {
    bool anyEnabled = false;
    for (bool enabled : noteEnabled) anyEnabled |= enabled;
    for (int index = 0; index < 24; index++) {
      int closestNote = 0, closestDistance = 999;
      for (int note = -12; note <= 24; note++) {
        const int distance = std::abs((index + 1) / 2 - note);
        if (anyEnabled && !noteEnabled[(note % 12 + 12) % 12]) continue;
        if (distance < closestDistance) { closestDistance = distance; closestNote = note; }
        else break;
      }
      ranges[index] = closestNote;
    }
  }

  void process(const ProcessArgs& args) override {
    lightTimer = std::fmax(0.f, lightTimer - args.sampleTime);
    lights[CLOCK_LIGHT].setBrightness(lightTimer > 0.f ? 1.f : 0.f);
    const int length = static_cast<int>(params[LENGTH_PARAM].getValue());
    for (int index = 0; index < 16; index++) lights[BIT1_LIGHT + index].setBrightness(index < length ? (shiftRegister[index] ? 1.f : .1f) : 0.f);
    lights[BIT1_LIGHT + step].setBrightness(3.f);
    if (resetTrigger.process(inputs[RESET_INPUT].getVoltage())) step = 0;
    if (clearTrigger.process(params[CLEAR_PARAM].getValue())) { for (bool& bit : shiftRegister) bit = false; step = 0; }

    if (clockTrigger.process(inputs[CLOCK_INPUT].getVoltage())) {
      lightTimer = .05f;
      const int probability = static_cast<int>(params[GENERATE_PARAM].getValue() * 10.f);
      const bool incoming = static_cast<int>(rack::random::uniform() * 10.f) < probability ? rack::random::uniform() > .5f : shiftRegister[length - 1];
      for (int index = 15; index > 0; index--) shiftRegister[index] = shiftRegister[index - 1];
      shiftRegister[0] = incoming;
      if (euclid((step + shift1) % length, static_cast<int>(params[EUCL1_PARAM].getValue()), length)) trig1Pulse.trigger(.005f);
      if (euclid((step + shift2) % length, static_cast<int>(params[EUCL2_PARAM].getValue()), length)) trig2Pulse.trigger(.005f);
      if (euclid((step + shift3) % length, static_cast<int>(params[EUCL3_PARAM].getValue()), length)) trig3Pulse.trigger(.005f);
      step = (step + 1) % length;
    }

    for (int note = 0; note < 12; note++) {
      if (noteTriggers[note].process(params[NOTE_C_PARAM + note].getValue())) { noteEnabled[note] = !noteEnabled[note]; updateRanges(); }
      lights[NOTE_C_LIGHT + note].setBrightness(noteEnabled[note] ? 1.f : 0.f);
    }
    outputs[TRIG1_OUTPUT].setVoltage(trig1Pulse.process(args.sampleTime) ? 10.f : 0.f);
    outputs[TRIG2_OUTPUT].setVoltage(trig2Pulse.process(args.sampleTime) ? 10.f : 0.f);
    outputs[TRIG3_OUTPUT].setVoltage(trig3Pulse.process(args.sampleTime) ? 10.f : 0.f);

    int value = 0;
    for (int index = 0; index < length; index++) if (shiftRegister[index]) value += 1 << index;
    const float normalized = static_cast<float>(value) / static_cast<float>((1 << length) - 1);
    const int rawNote = static_cast<int>(normalized * (static_cast<int>(params[SCALE_PARAM].getValue()) * 12 - 1));
    const int note = ranges[(rawNote % 12) * 2] + (rawNote / 12) * 12;
    outputs[CV_OUTPUT].setVoltage(note / 12.f);
  }
};

RACK_WEB_EXPORTS(SEQ1)
