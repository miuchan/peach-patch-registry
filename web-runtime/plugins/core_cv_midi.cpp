#include "core_midi_common.hpp"

struct CoreCvMidi : Module {
  enum ParamIds { NUM_PARAMS };
  enum InputIds { PITCH_INPUT, GATE_INPUT, VEL_INPUT, AFT_INPUT, PW_INPUT, MW_INPUT, CLK_INPUT, VOL_INPUT, PAN_INPUT, START_INPUT, STOP_INPUT, CONTINUE_INPUT, NUM_INPUTS };
  enum OutputIds { NUM_OUTPUTS };
  enum LightIds { NUM_LIGHTS };

  CoreMidiPortState midi{.channel = 0};
  CoreMidiRateLimiter limiter;
  int channels = 16;
  int notes[16]{};
  int velocities[16]{};
  int pressures[16]{};
  bool gates[16]{};
  int pitchWheel = 0x2000, modWheel = -1, volume = -1, pan = -1;
  bool clock = false, start = false, stop = false, cont = false;

  CoreCvMidi() {
    config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS);
    const char* names[] = {"1V/octave pitch","Gate","Velocity","Aftertouch","Pitch wheel","Mod wheel","Clock","Volume","Pan","Start trigger","Stop trigger","Continue trigger"};
    for (int id = 0; id < NUM_INPUTS; id++) configInput(id, names[id]);
    for (int channel = 0; channel < 16; channel++) { notes[channel] = 60; velocities[channel] = 100; pressures[channel] = -1; }
  }

  void setGate(int channel, int note, bool gate) {
    const bool changedNote = gate && gates[channel] && note != notes[channel];
    if (changedNote || (!gate && gates[channel])) coreMidiEmit(*this, midi, 0x80, notes[channel], velocities[channel]);
    if (changedNote || (gate && !gates[channel])) coreMidiEmit(*this, midi, 0x90, note, velocities[channel]);
    notes[channel] = note;
    gates[channel] = gate;
  }

  void edge(bool next, bool& previous, int status) {
    if (next && !previous) coreMidiEmit(*this, midi, status, 0, 0, 1);
    previous = next;
  }

  void process(const ProcessArgs& args) override {
    const int nextChannels = std::clamp(inputs[PITCH_INPUT].getChannels(), 0, 16);
    if (nextChannels < channels) for (int channel = nextChannels; channel < channels; channel++) setGate(channel, notes[channel], false);
    channels = nextChannels;
    for (int channel = 0; channel < channels; channel++) {
      const float velocityVoltage = inputs[VEL_INPUT].isConnected() ? inputs[VEL_INPUT].getPolyVoltage(channel) : 10.f * 100.f / 127.f;
      velocities[channel] = coreMidiClamp7(velocityVoltage / 10.f * 127.f);
      const int note = std::clamp(static_cast<int>(std::lround(inputs[PITCH_INPUT].getVoltage(channel) * 12.f + 60.f)), 0, 127);
      setGate(channel, note, inputs[GATE_INPUT].getPolyVoltage(channel) >= 1.f);
      const int pressure = coreMidiClamp7(inputs[AFT_INPUT].getPolyVoltage(channel) / 10.f * 127.f);
      if (pressure != pressures[channel]) { pressures[channel] = pressure; coreMidiEmit(*this, midi, 0xa0, notes[channel], pressure); }
    }
    if (limiter.process(args.sampleTime)) {
      const int pw = std::clamp(static_cast<int>(std::lround((inputs[PW_INPUT].getVoltage() + 5.f) / 10.f * 0x4000)), 0, 0x3fff);
      if (pw != pitchWheel) { pitchWheel = pw; coreMidiEmit(*this, midi, 0xe0, pw & 0x7f, (pw >> 7) & 0x7f); }
      const int mw = coreMidiClamp7(inputs[MW_INPUT].getVoltage() / 10.f * 127.f);
      if (mw != modWheel) { modWheel = mw; coreMidiEmit(*this, midi, 0xb0, 1, mw); }
      const float volV = inputs[VOL_INPUT].isConnected() ? inputs[VOL_INPUT].getVoltage() : 10.f;
      const int vol = coreMidiClamp7(volV / 10.f * 127.f);
      if (vol != volume) { volume = vol; coreMidiEmit(*this, midi, 0xb0, 7, vol); }
      const int nextPan = coreMidiClamp7((inputs[PAN_INPUT].getVoltage() + 5.f) / 10.f * 127.f);
      if (nextPan != pan) { pan = nextPan; coreMidiEmit(*this, midi, 0xb0, 10, pan); }
    }
    edge(inputs[CLK_INPUT].getVoltage() >= 1.f, clock, 0xf8);
    edge(inputs[START_INPUT].getVoltage() >= 1.f, start, 0xfa);
    edge(inputs[STOP_INPUT].getVoltage() >= 1.f, stop, 0xfc);
    edge(inputs[CONTINUE_INPUT].getVoltage() >= 1.f, cont, 0xfb);
  }

  json_t* dataToJson() override { json_t* root = json_object(); json_object_set_new(root, "midi", midi.toJson()); return root; }
  void dataFromJson(json_t* root) override { midi.fromJson(root); }
};

RACK_WEB_EXPORTS(CoreCvMidi)

