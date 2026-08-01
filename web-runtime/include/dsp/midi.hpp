#pragma once

#include "../midi.hpp"

#include <algorithm>
#include <cstdint>

namespace rack::dsp {

// Rack's official state-diffing gate/CV-to-MIDI generator. Keeping this
// contract here lets source modules retain their original onMessage() bridge.
template <int CHANNELS>
struct MidiGenerator {
  uint8_t channels;
  int8_t vels[CHANNELS];
  int8_t notes[CHANNELS];
  bool gates[CHANNELS];
  int8_t keyPressures[CHANNELS];
  int8_t channelPressure;
  int8_t ccs[128];
  int16_t pw;
  bool clk;
  bool start;
  bool stop;
  bool cont;
  int64_t frame = -1;

  MidiGenerator() { reset(); }
  virtual ~MidiGenerator() = default;

  void reset() {
    channels = CHANNELS;
    for (int channel = 0; channel < CHANNELS; ++channel) {
      vels[channel] = 100;
      notes[channel] = 60;
      gates[channel] = false;
      keyPressures[channel] = -1;
    }
    channelPressure = -1;
    std::fill(std::begin(ccs), std::end(ccs), int8_t{-1});
    pw = 0x2000;
    clk = start = stop = cont = false;
  }

  void panic() {
    reset();
    for (int note = 0; note <= 127; ++note) {
      midi::Message message;
      message.setStatus(0x8);
      message.setNote(static_cast<uint8_t>(note));
      message.setValue(0);
      message.setFrame(frame);
      onMessage(message);
    }
  }

  void setChannels(uint8_t nextChannels) {
    if (channels == nextChannels) return;
    for (uint8_t channel = nextChannels; channel < channels; ++channel)
      setNoteGate(notes[channel], false, channel);
    channels = nextChannels;
  }

  void setVelocity(int8_t velocity, int channel) { vels[channel] = velocity; }

  void setNoteGate(int8_t note, bool gate, int channel) {
    const bool changedNote = gate && gates[channel] && note != notes[channel];
    const bool enabledGate = gate && !gates[channel];
    const bool disabledGate = !gate && gates[channel];
    if (changedNote || disabledGate) {
      midi::Message message;
      message.setStatus(0x8);
      message.setNote(static_cast<uint8_t>(notes[channel]));
      message.setValue(static_cast<uint8_t>(vels[channel]));
      message.setFrame(frame);
      onMessage(message);
    }
    if (changedNote || enabledGate) {
      midi::Message message;
      message.setStatus(0x9);
      message.setNote(static_cast<uint8_t>(note));
      message.setValue(static_cast<uint8_t>(vels[channel]));
      message.setFrame(frame);
      onMessage(message);
    }
    notes[channel] = note;
    gates[channel] = gate;
  }

  void setKeyPressure(int8_t value, int channel) {
    if (keyPressures[channel] == value) return;
    keyPressures[channel] = value;
    midi::Message message;
    message.setStatus(0xa);
    message.setNote(static_cast<uint8_t>(notes[channel]));
    message.setValue(static_cast<uint8_t>(value));
    message.setFrame(frame);
    onMessage(message);
  }

  void setChannelPressure(int8_t value) {
    if (channelPressure == value) return;
    channelPressure = value;
    midi::Message message;
    message.setSize(2);
    message.setStatus(0xd);
    message.setNote(static_cast<uint8_t>(value));
    message.setFrame(frame);
    onMessage(message);
  }

  void setCc(int8_t value, int id) {
    if (ccs[id] == value) return;
    ccs[id] = value;
    midi::Message message;
    message.setStatus(0xb);
    message.setNote(static_cast<uint8_t>(id));
    message.setValue(static_cast<uint8_t>(value));
    message.setFrame(frame);
    onMessage(message);
  }

  void setModWheel(int8_t value) { setCc(value, 0x01); }
  void setVolume(int8_t value) { setCc(value, 0x07); }
  void setBalance(int8_t value) { setCc(value, 0x08); }
  void setPan(int8_t value) { setCc(value, 0x0a); }
  void setSustainPedal(int8_t value) { setCc(value, 0x40); }

  void setPitchWheel(int16_t value) {
    if (pw == value) return;
    pw = value;
    midi::Message message;
    message.setStatus(0xe);
    message.setNote(static_cast<uint8_t>(value & 0x7f));
    message.setValue(static_cast<uint8_t>((value >> 7) & 0x7f));
    message.setFrame(frame);
    onMessage(message);
  }

  void setSystemMessage(bool& state, bool next, uint8_t status) {
    if (state == next) return;
    state = next;
    if (!next) return;
    midi::Message message;
    message.setSize(1);
    message.setStatus(0xf);
    message.setChannel(status & 0x0f);
    message.setFrame(frame);
    onMessage(message);
  }

  void setClock(bool value) { setSystemMessage(clk, value, 0xf8); }
  void setStart(bool value) { setSystemMessage(start, value, 0xfa); }
  void setContinue(bool value) { setSystemMessage(cont, value, 0xfb); }
  void setStop(bool value) { setSystemMessage(stop, value, 0xfc); }
  void setFrame(int64_t nextFrame) { frame = nextFrame; }
  virtual void onMessage(const midi::Message&) {}
};

} // namespace rack::dsp
