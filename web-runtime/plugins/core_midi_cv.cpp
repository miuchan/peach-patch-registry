#include "core_midi_common.hpp"

struct CoreMidiCv : Module {
  enum ParamIds { NUM_PARAMS };
  enum InputIds { NUM_INPUTS };
  enum OutputIds { PITCH_OUTPUT, GATE_OUTPUT, VELOCITY_OUTPUT, AFTERTOUCH_OUTPUT, PW_OUTPUT, MOD_OUTPUT, RETRIGGER_OUTPUT, CLOCK_OUTPUT, CLOCK_DIV_OUTPUT, START_OUTPUT, STOP_OUTPUT, CONTINUE_OUTPUT, NUM_OUTPUTS };
  enum LightIds { NUM_LIGHTS };

  CoreMidiPortState midi;
  int channels = 1, monoMode = 0, polyMode = 0, rotateIndex = -1;
  bool retriggerOnResume = false, releaseVelocityEnabled = false, smooth = true, pedal = false;
  float pwRange = 2.f, filterLambda = 30.f;
  int clockDivision = 24;
  int64_t clock = 0;
  uint8_t notes[16]{}, velocities[16]{}, aftertouches[16]{}, mods[16]{};
  int pws[16]{};
  bool gates[16]{};
  float pwFiltered[16]{}, modFiltered[16]{}, retrigger[16]{};
  float clockPulse = 0.f, dividerPulse = 0.f, startPulse = 0.f, stopPulse = 0.f, continuePulse = 0.f;
  std::vector<uint8_t> held;

  CoreMidiCv() {
    config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS);
    const char* names[] = {"1V/octave pitch","Gate","Velocity","Aftertouch","Pitch wheel","Mod wheel","Retrigger","Clock","Clock divider","Start trigger","Stop trigger","Continue trigger"};
    for (int id = 0; id < NUM_OUTPUTS; id++) configOutput(id, names[id]);
    for (auto& note : notes) note = 60;
  }

  int assignChannel(uint8_t note) {
    if (channels <= 1) return 0;
    if (polyMode == 1) for (int channel = 0; channel < channels; channel++) if (notes[channel] == note) return channel;
    if (polyMode == 0 || polyMode == 1) {
      for (int index = 0; index < channels; index++) { rotateIndex = (rotateIndex + 1) % channels; if (!gates[rotateIndex]) return rotateIndex; }
      return rotateIndex = (rotateIndex + 1) % channels;
    }
    if (polyMode == 2) { for (int channel = 0; channel < channels; channel++) if (!gates[channel]) return channel; return channels - 1; }
    return 0;
  }

  void press(uint8_t note, int channel, uint8_t velocity) {
    held.erase(std::remove(held.begin(), held.end(), note), held.end()); held.push_back(note);
    if (channels > 1) channel = polyMode == 3 ? channel : assignChannel(note);
    else {
      channel = 0;
      if (monoMode == 1 && held.size() > 1) return;
      if (monoMode == 2 && note != *std::min_element(held.begin(), held.end())) return;
      if (monoMode == 3 && note != *std::max_element(held.begin(), held.end())) return;
    }
    if (channel >= channels) return;
    notes[channel] = note; gates[channel] = true; velocities[channel] = velocity; retrigger[channel] = 1e-3f;
  }

  void refreshHeld() {
    if (channels <= 1) {
      if (held.empty()) { gates[0] = false; return; }
      notes[0] = monoMode == 1 ? held.front() : monoMode == 2 ? *std::min_element(held.begin(), held.end()) : monoMode == 3 ? *std::max_element(held.begin(), held.end()) : held.back();
      gates[0] = true; if (retriggerOnResume) retrigger[0] = 1e-3f;
    } else for (int channel = 0; channel < channels; channel++) if (gates[channel] && std::find(held.begin(), held.end(), notes[channel]) == held.end()) gates[channel] = false;
  }

  void release(uint8_t note, int channel, int velocity) {
    held.erase(std::remove(held.begin(), held.end(), note), held.end());
    if (pedal) return;
    if (!(channels > 1 && polyMode == 3)) { channel = -1; for (int c = 0; c < channels; c++) if (gates[c] && notes[c] == note) { channel = c; break; } }
    if (channel < 0 || channel >= channels) return;
    gates[channel] = false; refreshHeld(); if (releaseVelocityEnabled && velocity >= 0) velocities[channel] = velocity;
  }

  void panic() {
    held.clear(); pedal = false; clock = 0; rotateIndex = -1;
    for (int channel = 0; channel < 16; channel++) { notes[channel] = 60; gates[channel] = false; velocities[channel] = aftertouches[channel] = mods[channel] = 0; pws[channel] = 0; pwFiltered[channel] = modFiltered[channel] = retrigger[channel] = 0.f; }
  }

  void rackWebPushMidi(int size, int status, int data1, int data2) override {
    if (!midi.accepts(status)) return;
    const int kind = status & 0xf0, channel = status & 0xf;
    if (kind == 0x80 && size >= 3) release(data1 & 0x7f, channel, data2 & 0x7f);
    else if (kind == 0x90 && size >= 3) { if (data2) press(data1 & 0x7f, channel, data2 & 0x7f); else release(data1 & 0x7f, channel, -1); }
    else if (kind == 0xa0 && size >= 3) {
      for (int c = 0; c < 16; c++)
        if (notes[c] == (data1 & 0x7f)) aftertouches[c] = data2 & 0x7f;
    }
    else if (kind == 0xb0 && size >= 3) {
      if ((data1 & 0x7f) == 1) mods[channels > 1 && polyMode == 3 ? channel : 0] = data2 & 0x7f;
      else if ((data1 & 0x7f) == 64) { if (data2 >= 64) pedal = true; else { pedal = false; refreshHeld(); } }
      else if ((data1 & 0x7f) == 123 && data2 == 0) panic();
    } else if (kind == 0xd0 && size >= 2) {
      if (channels > 1 && polyMode == 3) aftertouches[channel] = data1 & 0x7f; else for (auto& aftertouch : aftertouches) aftertouch = data1 & 0x7f;
    } else if (kind == 0xe0 && size >= 3) pws[channels > 1 && polyMode == 3 ? channel : 0] = ((data2 & 0x7f) << 7 | (data1 & 0x7f)) - 8192;
    else if (kind == 0xf0) {
      switch (status & 0xf) {
        case 2: if (size >= 3) clock = ((data2 & 0x7f) << 7 | (data1 & 0x7f)) * 6; break;
        case 8: clockPulse = 1e-3f; if (clock % std::max(1, clockDivision) == 0) dividerPulse = 1e-3f; clock++; break;
        case 10: startPulse = 1e-3f; clock = 0; break;
        case 11: continuePulse = 1e-3f; break;
        case 12: stopPulse = 1e-3f; break;
      }
    }
  }

  void process(const ProcessArgs& args) override {
    const int wheelChannels = channels > 1 && polyMode == 3 ? 16 : 1;
    for (int channel = 0; channel < wheelChannels; channel++) {
      const float pw = std::clamp(pws[channel] / 8191.f, -1.f, 1.f), mod = std::clamp(mods[channel] / 127.f, 0.f, 1.f);
      if (smooth) { pwFiltered[channel] += (pw - pwFiltered[channel]) * std::min(1.f, filterLambda * args.sampleTime); modFiltered[channel] += (mod - modFiltered[channel]) * std::min(1.f, filterLambda * args.sampleTime); }
      else { pwFiltered[channel] = pw; modFiltered[channel] = mod; }
    }
    for (int port : {PITCH_OUTPUT,GATE_OUTPUT,VELOCITY_OUTPUT,AFTERTOUCH_OUTPUT,RETRIGGER_OUTPUT}) outputs[port].setChannels(channels);
    for (int channel = 0; channel < channels; channel++) {
      const int wheel = channels > 1 && polyMode == 3 ? channel : 0;
      outputs[PITCH_OUTPUT].setVoltage((notes[channel] - 60.f + pwFiltered[wheel] * pwRange) / 12.f, channel);
      outputs[GATE_OUTPUT].setVoltage(gates[channel] ? 10.f : 0.f, channel);
      outputs[VELOCITY_OUTPUT].setVoltage(velocities[channel] / 127.f * 10.f, channel);
      outputs[AFTERTOUCH_OUTPUT].setVoltage(aftertouches[channel] / 127.f * 10.f, channel);
      outputs[RETRIGGER_OUTPUT].setVoltage(retrigger[channel] > 0.f ? 10.f : 0.f, channel);
      retrigger[channel] = std::max(0.f, retrigger[channel] - args.sampleTime);
    }
    outputs[PW_OUTPUT].setChannels(wheelChannels); outputs[MOD_OUTPUT].setChannels(wheelChannels);
    for (int channel = 0; channel < wheelChannels; channel++) { outputs[PW_OUTPUT].setVoltage(pwFiltered[channel] * 5.f, channel); outputs[MOD_OUTPUT].setVoltage(modFiltered[channel] * 10.f, channel); }
    outputs[CLOCK_OUTPUT].setVoltage(clockPulse > 0.f ? 10.f : 0.f); outputs[CLOCK_DIV_OUTPUT].setVoltage(dividerPulse > 0.f ? 10.f : 0.f); outputs[START_OUTPUT].setVoltage(startPulse > 0.f ? 10.f : 0.f); outputs[STOP_OUTPUT].setVoltage(stopPulse > 0.f ? 10.f : 0.f); outputs[CONTINUE_OUTPUT].setVoltage(continuePulse > 0.f ? 10.f : 0.f);
    for (float* pulse : {&clockPulse,&dividerPulse,&startPulse,&stopPulse,&continuePulse}) *pulse = std::max(0.f, *pulse - args.sampleTime);
  }

  json_t* dataToJson() override {
    json_t* root = json_object();
    json_object_set_new(root,"channels",json_integer(channels)); json_object_set_new(root,"monoMode",json_integer(monoMode)); json_object_set_new(root,"retriggerOnResume",json_boolean(retriggerOnResume)); json_object_set_new(root,"polyMode",json_integer(polyMode)); json_object_set_new(root,"releaseVelocityEnabled",json_boolean(releaseVelocityEnabled)); json_object_set_new(root,"pwRange",json_real(pwRange)); json_object_set_new(root,"smooth",json_boolean(smooth)); json_object_set_new(root,"clockDivision",json_integer(clockDivision)); json_object_set_new(root,"lastPw",json_integer(pws[0])); json_object_set_new(root,"lastMod",json_integer(mods[0])); json_object_set_new(root,"filterLambda",json_real(filterLambda)); json_object_set_new(root,"midi",midi.toJson()); return root;
  }
  void dataFromJson(json_t* root) override {
    channels = std::clamp(coreMidiInt(root,"channels",channels),1,16); monoMode = std::clamp(coreMidiInt(root,"monoMode",monoMode),0,3); retriggerOnResume = coreMidiBool(root,"retriggerOnResume",retriggerOnResume); polyMode = std::clamp(coreMidiInt(root,"polyMode",polyMode),0,3); releaseVelocityEnabled = coreMidiBool(root,"releaseVelocityEnabled",releaseVelocityEnabled); pwRange = coreMidiFloat(root,"pwRange",0.f); smooth = coreMidiBool(root,"smooth",smooth); clockDivision = std::max(1,coreMidiInt(root,"clockDivision",clockDivision)); pws[0] = coreMidiInt(root,"lastPw",pws[0]); if (json_object_get(root,"lastPitch")) pws[0] = coreMidiInt(root,"lastPitch",8192)-8192; mods[0] = coreMidiInt(root,"lastMod",mods[0]); filterLambda = coreMidiFloat(root,"filterLambda",filterLambda); midi.fromJson(root);
  }
};

RACK_WEB_EXPORTS(CoreMidiCv)
