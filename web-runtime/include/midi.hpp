#pragma once

#include "rack_web.hpp"

#include <algorithm>
#include <cstdint>
#include <deque>
#include <set>
#include <unordered_map>
#include <vector>

namespace rack::midi {

struct Message {
  std::vector<uint8_t> bytes;
  int64_t frame = -1;

  Message() : bytes(3) {}
  int getSize() const { return static_cast<int>(bytes.size()); }
  void setSize(int size) { bytes.resize(static_cast<size_t>(std::max(size, 0))); }
  uint8_t getChannel() const { return bytes.empty() ? 0 : bytes[0] & 0x0f; }
  void setChannel(uint8_t channel) { if (!bytes.empty()) bytes[0] = static_cast<uint8_t>((bytes[0] & 0xf0) | (channel & 0x0f)); }
  uint8_t getStatus() const { return bytes.empty() ? 0 : bytes[0] >> 4; }
  void setStatus(uint8_t status) { if (!bytes.empty()) bytes[0] = static_cast<uint8_t>((bytes[0] & 0x0f) | (status << 4)); }
  uint8_t getNote() const { return bytes.size() < 2 ? 0 : bytes[1]; }
  void setNote(uint8_t note) { if (bytes.size() >= 2) bytes[1] = note & 0x7f; }
  uint8_t getValue() const { return bytes.size() < 3 ? 0 : bytes[2]; }
  void setValue(uint8_t value) { if (bytes.size() >= 3) bytes[2] = value & 0x7f; }
  int64_t getFrame() const { return frame; }
  void setFrame(int64_t next) { frame = next; }
  std::string toString() const {
    std::string result;
    for (size_t index = 0; index < bytes.size(); ++index) {
      if (index) result += " ";
      char value[4]{};
      std::snprintf(value, sizeof(value), "%02x", bytes[index]);
      result += value;
    }
    return result;
  }
};

struct InputDevice;
struct Input;
struct InputQueue;
struct OutputDevice;
struct Output;

inline std::set<InputQueue*>& inputQueueRegistry() {
  static std::set<InputQueue*> queues;
  return queues;
}

inline std::set<Output*>& outputRegistry() {
  static std::set<Output*> outputs;
  return outputs;
}

inline Module*& rackWebOutputModule() {
  static Module* module = nullptr;
  return module;
}

inline void rackWebSetOutputModule(Module* module) {
  rackWebOutputModule() = module;
}

struct Driver {
  virtual ~Driver() = default;
  virtual std::string getName() { return ""; }
  virtual std::vector<int> getInputDeviceIds() { return {}; }
  virtual int getDefaultInputDeviceId() { return -1; }
  virtual std::string getInputDeviceName(int) { return ""; }
  virtual InputDevice* subscribeInput(int, Input*) { return nullptr; }
  virtual void unsubscribeInput(int, Input*) {}
  virtual std::vector<int> getOutputDeviceIds() { return {}; }
  virtual int getDefaultOutputDeviceId() { return -1; }
  virtual std::string getOutputDeviceName(int) { return ""; }
  virtual OutputDevice* subscribeOutput(int, Output*) { return nullptr; }
  virtual void unsubscribeOutput(int, Output*) {}
};

struct Device {
  virtual ~Device() = default;
  virtual std::string getName() { return ""; }
};

struct InputDevice : Device {
  std::set<Input*> subscribed;
  void subscribe(Input* input) { if (input) subscribed.insert(input); }
  void unsubscribe(Input* input) { subscribed.erase(input); }
  void onMessage(const Message& message);
};

struct OutputDevice : Device {
  std::set<Output*> subscribed;
  void subscribe(Output* output) { if (output) subscribed.insert(output); }
  void unsubscribe(Output* output) { subscribed.erase(output); }
  virtual void sendMessage(const Message&) {}
};

inline std::unordered_map<int, Driver*>& driverRegistry() {
  static std::unordered_map<int, Driver*> drivers;
  return drivers;
}
inline void addDriver(int driverId, Driver* driver) { if (driver) driverRegistry()[driverId] = driver; }
inline std::vector<int> getDriverIds() { std::vector<int> result; for (const auto& [id, _] : driverRegistry()) result.push_back(id); std::sort(result.begin(), result.end()); return result; }
inline Driver* getDriver(int driverId) { const auto found = driverRegistry().find(driverId); return found == driverRegistry().end() ? nullptr : found->second; }
inline void init() {}
inline void destroy() { driverRegistry().clear(); }

struct Port {
  int channel = -1;
  int driverId = -1;
  int deviceId = -1;
  Driver* driver = nullptr;
  Device* device = nullptr;

  virtual ~Port() = default;
  Driver* getDriver() { return driver; }
  int getDriverId() { return driverId; }
  void setDriverId(int next) { driverId = next; driver = midi::getDriver(next); if (next < 0) setDeviceId(-1); }
  Device* getDevice() { return device; }
  virtual std::vector<int> getDeviceIds() = 0;
  virtual int getDefaultDeviceId() = 0;
  int getDeviceId() { return deviceId; }
  virtual void setDeviceId(int) = 0;
  virtual std::string getDeviceName(int) = 0;
  virtual std::vector<int> getChannels() = 0;
  int getChannel() { return channel; }
  void setChannel(int next) { channel = next; }
  std::string getChannelName(int value) { return value < 0 ? "All channels" : "Channel " + std::to_string(value + 1); }
  json_t* toJson() {
    json_t* root = json_object();
    json_object_set_new(root, "driver", json_integer(driverId));
    json_object_set_new(root, "device", json_integer(deviceId));
    json_object_set_new(root, "channel", json_integer(channel));
    return root;
  }
  void fromJson(json_t* root) {
    if (!json_is_object(root)) return;
    if (json_t* value = json_object_get(root, "driver")) setDriverId(static_cast<int>(json_integer_value(value)));
    if (json_t* value = json_object_get(root, "device")) setDeviceId(static_cast<int>(json_integer_value(value)));
    if (json_t* value = json_object_get(root, "channel")) setChannel(static_cast<int>(json_integer_value(value)));
  }
};

struct Input : Port {
  InputDevice* inputDevice = nullptr;
  ~Input() override { reset(); }
  void reset() { if (driver && deviceId >= 0) driver->unsubscribeInput(deviceId, this); inputDevice = nullptr; device = nullptr; deviceId = -1; }
  std::vector<int> getDeviceIds() override { return driver ? driver->getInputDeviceIds() : std::vector<int>{}; }
  int getDefaultDeviceId() override { return driver ? driver->getDefaultInputDeviceId() : -1; }
  void setDeviceId(int next) override { reset(); deviceId = next; if (driver && next >= 0) { inputDevice = driver->subscribeInput(next, this); device = inputDevice; } }
  std::string getDeviceName(int id) override { return driver ? driver->getInputDeviceName(id) : ""; }
  std::vector<int> getChannels() override { std::vector<int> result{-1}; for (int value = 0; value < 16; ++value) result.push_back(value); return result; }
  virtual void onMessage(const Message&) {}
};

inline void InputDevice::onMessage(const Message& message) {
  for (Input* input : subscribed) if (input && (input->channel < 0 || input->channel == message.getChannel())) input->onMessage(message);
}

struct InputQueue : Input {
  std::deque<Message> messages;
  bool rackWebBrowserInput = true;
  explicit InputQueue(bool browserInput = true) : rackWebBrowserInput(browserInput) { inputQueueRegistry().insert(this); }
  InputQueue(const InputQueue& source) : Input(source), messages(source.messages), rackWebBrowserInput(source.rackWebBrowserInput) {
    inputDevice = nullptr;
    device = nullptr;
    inputQueueRegistry().insert(this);
  }
  InputQueue(InputQueue&& source) noexcept : Input(source), messages(std::move(source.messages)), rackWebBrowserInput(source.rackWebBrowserInput) {
    inputDevice = nullptr;
    device = nullptr;
    inputQueueRegistry().insert(this);
  }
  InputQueue& operator=(const InputQueue& source) {
    if (this != &source) {
      channel = source.channel;
      driverId = source.driverId;
      deviceId = source.deviceId;
      messages = source.messages;
      rackWebBrowserInput = source.rackWebBrowserInput;
    }
    return *this;
  }
  InputQueue& operator=(InputQueue&& source) noexcept {
    if (this != &source) {
      channel = source.channel;
      driverId = source.driverId;
      deviceId = source.deviceId;
      messages = std::move(source.messages);
      rackWebBrowserInput = source.rackWebBrowserInput;
    }
    return *this;
  }
  ~InputQueue() override { inputQueueRegistry().erase(this); }
  void onMessage(const Message& message) override {
    if (channel >= 0 && channel != message.getChannel()) return;
    const auto position = std::upper_bound(messages.begin(), messages.end(), message.frame, [](int64_t frame, const Message& queued) { return frame < queued.frame; });
    messages.insert(position, message);
  }
  bool tryPop(Message* output, int64_t maxFrame) {
    if (messages.empty() || (messages.front().frame >= 0 && messages.front().frame > maxFrame)) return false;
    if (output) *output = messages.front();
    messages.pop_front();
    return true;
  }
  bool shift(Message* output) { return tryPop(output, INT64_MAX); }
  size_t size() { return messages.size(); }
};

inline void rackWebPushToInputs(int size, int status, int data1, int data2, int64_t frame) {
  Message message;
  message.setSize(std::clamp(size, 1, 3));
  message.bytes[0] = static_cast<uint8_t>(status & 0xff);
  if (message.bytes.size() > 1) message.bytes[1] = static_cast<uint8_t>(data1 & 0x7f);
  if (message.bytes.size() > 2) message.bytes[2] = static_cast<uint8_t>(data2 & 0x7f);
  message.frame = frame;
  for (InputQueue* queue : inputQueueRegistry()) if (queue && queue->rackWebBrowserInput) queue->onMessage(message);
}

struct Output : Port {
  OutputDevice* outputDevice = nullptr;
  Output() { outputRegistry().insert(this); }
  Output(const Output& source) : Port(source) {
    outputDevice = nullptr;
    device = nullptr;
    outputRegistry().insert(this);
  }
  Output(Output&& source) noexcept : Port(source) {
    outputDevice = nullptr;
    device = nullptr;
    outputRegistry().insert(this);
  }
  Output& operator=(const Output& source) {
    if (this != &source) {
      channel = source.channel;
      driverId = source.driverId;
      deviceId = source.deviceId;
    }
    return *this;
  }
  Output& operator=(Output&& source) noexcept {
    if (this != &source) {
      channel = source.channel;
      driverId = source.driverId;
      deviceId = source.deviceId;
    }
    return *this;
  }
  ~Output() override { outputRegistry().erase(this); reset(); }
  void reset() { if (driver && deviceId >= 0) driver->unsubscribeOutput(deviceId, this); outputDevice = nullptr; device = nullptr; deviceId = -1; }
  std::vector<int> getDeviceIds() override { return driver ? driver->getOutputDeviceIds() : std::vector<int>{}; }
  int getDefaultDeviceId() override { return driver ? driver->getDefaultOutputDeviceId() : -1; }
  void setDeviceId(int next) override { reset(); deviceId = next; if (driver && next >= 0) { outputDevice = driver->subscribeOutput(next, this); device = outputDevice; } }
  std::string getDeviceName(int id) override { return driver ? driver->getOutputDeviceName(id) : ""; }
  std::vector<int> getChannels() override { std::vector<int> result{-1}; for (int value = 0; value < 16; ++value) result.push_back(value); return result; }
  void sendMessage(const Message& source) {
    Message message = source;
    if (channel >= 0) message.setChannel(static_cast<uint8_t>(channel));
    if (outputDevice) {
      outputDevice->sendMessage(message);
      return;
    }
    if (Module* module = rackWebOutputModule()) {
      module->rackWebEmitMidiBytes(message.bytes.data(), message.getSize());
    }
  }
};

inline void rackWebActivateModule(Module* module) {
  rackWebSetOutputModule(module);
  // Browser MIDI is one virtual host device. Binding it when the WASM module
  // becomes active preserves plugins that explicitly guard their queue work
  // with driverId/deviceId connection checks.
  for (InputQueue* input : inputQueueRegistry()) if (input && input->rackWebBrowserInput) {
    input->driverId = 0;
    input->deviceId = 0;
  }
  for (Output* output : outputRegistry()) if (output) {
    output->driverId = 0;
    output->deviceId = 0;
  }
}

} // namespace rack::midi
