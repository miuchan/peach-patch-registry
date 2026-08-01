#pragma once

#include "rack_web_export.hpp"
#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <string>
#include <vector>

struct CoreMidiPortState {
  int driver = -1;
  int channel = -1;
  std::string deviceName;

  void fromJson(json_t* root) {
    json_t* midi = json_object_get(root, "midi");
    if (!json_is_object(midi)) return;
    if (json_t* value = json_object_get(midi, "driver")) driver = json_integer_value(value);
    if (json_t* value = json_object_get(midi, "channel")) channel = json_integer_value(value);
    if (json_t* value = json_object_get(midi, "deviceName")) {
      const char* text = json_string_value(value);
      deviceName = text ? text : "";
    }
  }

  json_t* toJson() const {
    json_t* midi = json_object();
    json_object_set_new(midi, "driver", json_integer(driver));
    if (!deviceName.empty()) json_object_set_new(midi, "deviceName", json_string(deviceName.c_str()));
    json_object_set_new(midi, "channel", json_integer(channel));
    return midi;
  }

  bool accepts(int status) const {
    return (status & 0xf0) == 0xf0 || channel < 0 || (status & 0xf) == channel;
  }

  int outboundStatus(int status) const {
    return (status & 0xf0) == 0xf0 || channel < 0 ? status : ((status & 0xf0) | (channel & 0xf));
  }
};

inline int coreMidiInt(json_t* root, const char* key, int fallback) {
  json_t* value = json_object_get(root, key);
  return value ? static_cast<int>(json_integer_value(value)) : fallback;
}

inline float coreMidiFloat(json_t* root, const char* key, float fallback) {
  json_t* value = json_object_get(root, key);
  return value ? static_cast<float>(json_number_value(value)) : fallback;
}

inline bool coreMidiBool(json_t* root, const char* key, bool fallback) {
  json_t* value = json_object_get(root, key);
  return value ? json_boolean_value(value) : fallback;
}

inline void coreMidiReadIntArray(json_t* root, const char* key, int8_t* target, int count) {
  json_t* array = json_object_get(root, key);
  if (!json_is_array(array)) return;
  for (int index = 0; index < count; index++)
    if (json_t* value = json_array_get(array, index)) target[index] = static_cast<int8_t>(json_integer_value(value));
}

inline json_t* coreMidiIntArray(const int8_t* values, int count) {
  json_t* array = json_array();
  for (int index = 0; index < count; index++) json_array_append_new(array, json_integer(values[index]));
  return array;
}

inline uint8_t coreMidiClamp7(float value) {
  return static_cast<uint8_t>(std::clamp(std::lround(value), 0l, 127l));
}

inline void coreMidiEmit(Module& module, const CoreMidiPortState& port, int status, int data1 = 0, int data2 = 0, int size = 3) {
  module.rackWebEmitMidi(size, port.outboundStatus(status), data1, data2);
}

struct CoreMidiRateLimiter {
  float time = 0.f;
  bool process(float sampleTime, float hz = 200.f) {
    time += sampleTime;
    const float period = 1.f / hz;
    if (time < period) return false;
    time -= period;
    return true;
  }
};

