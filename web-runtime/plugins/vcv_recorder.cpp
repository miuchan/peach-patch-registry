// Browser recording adapter for VCV Recorder 2.6.6.
//
// The Rack module's trigger/gate, gain, channel selection, VU, and state
// contracts are preserved. Native FFmpeg/filesystem work is intentionally
// replaced by Rack Web's bounded PCM capture ABI; the browser host encodes and
// saves the result after it leaves the real-time AudioWorklet.
// Original source: https://github.com/VCVRack/Recorder (GPL-3.0-or-later).

#include "rack_web_export.hpp"
#include <algorithm>
#include <cmath>
#include <cstring>

struct VcvRecorder : Module {
  static constexpr int CAPTURE_FRAMES = 2048;
  enum ParamIds { GAIN_PARAM, REC_PARAM, NUM_PARAMS };
  enum InputIds { GATE_INPUT, TRIG_INPUT, LEFT_INPUT, RIGHT_INPUT, NUM_INPUTS };
  enum OutputIds { NUM_OUTPUTS };
  enum LightIds { VU_LIGHTS, REC_LIGHT = VU_LIGHTS + 12, NUM_LIGHTS };

  dsp::SchmittTrigger trigger;
  dsp::SchmittTrigger recordButton;
  dsp::VuMeter2 meters[2];
  float captured[CAPTURE_FRAMES * 2]{};
  int capturedFrames = 0;
  int captureChannels = 2;
  bool captureActive = false;
  bool hostCaptureEnabled = false;

  VcvRecorder() {
    config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS);
    configParam(GAIN_PARAM, 0.f, 2.f, 1.f, "Level", " dB", -10, 40);
    configButton(REC_PARAM, "Record");
    configInput(GATE_INPUT, "Gate");
    configInput(TRIG_INPUT, "Trigger");
    configInput(LEFT_INPUT, "Left/mono");
    configInput(RIGHT_INPUT, "Right");
  }

  int rackWebCaptureCapacity() const override { return CAPTURE_FRAMES; }
  float* rackWebCaptureBuffer() override { return captured; }
  int rackWebCaptureFrames() const override { return capturedFrames; }
  int rackWebCaptureChannels() const override { return captureChannels; }
  bool rackWebCaptureActive() const override { return captureActive; }

  void rackWebSetCaptureEnabled(bool enabled) override {
    hostCaptureEnabled = enabled;
  }

  void rackWebConsumeCapture(int frames) override {
    frames = std::clamp(frames, 0, capturedFrames);
    const int remaining = capturedFrames - frames;
    if (remaining > 0)
      std::memmove(captured, captured + frames * captureChannels,
                   remaining * captureChannels * sizeof(float));
    capturedFrames = remaining;
  }

  void process(const ProcessArgs& args) override {
    bool requested = hostCaptureEnabled;
    if (recordButton.process(params[REC_PARAM].getValue(), .1f, .9f)) {
      requested = !captureActive;
      hostCaptureEnabled = requested;
    }
    if (trigger.process(inputs[TRIG_INPUT].getVoltage(), .1f, 2.f)) {
      requested = !captureActive;
      hostCaptureEnabled = requested;
    }
    if (inputs[GATE_INPUT].isConnected())
      requested = inputs[GATE_INPUT].getVoltage() >= 2.f;

    if (requested != captureActive) {
      captureActive = requested;
      if (captureActive) {
        captureChannels = inputs[RIGHT_INPUT].isConnected() ? 2 : 1;
        capturedFrames = 0;
      }
    }

    const float gain = std::pow(params[GAIN_PARAM].getValue(), 2.f);
    const float left = inputs[LEFT_INPUT].getVoltageSum() * .1f * gain;
    const float right = inputs[RIGHT_INPUT].isConnected()
      ? inputs[RIGHT_INPUT].getVoltageSum() * .1f * gain
      : left;
    meters[0].process(args.sampleTime, left);
    meters[1].process(args.sampleTime, right);

    if (captureActive && capturedFrames < CAPTURE_FRAMES) {
      captured[capturedFrames * captureChannels] = left;
      if (captureChannels > 1)
        captured[capturedFrames * captureChannels + 1] = right;
      capturedFrames++;
    }

    for (int channel = 0; channel < 2; channel++) {
      lights[VU_LIGHTS + channel * 6 + 0].setBrightness(meters[channel].getBrightness(0, 0));
      lights[VU_LIGHTS + channel * 6 + 1].setBrightness(meters[channel].getBrightness(-3, 0));
      lights[VU_LIGHTS + channel * 6 + 2].setBrightness(meters[channel].getBrightness(-6, -3));
      lights[VU_LIGHTS + channel * 6 + 3].setBrightness(meters[channel].getBrightness(-12, -6));
      lights[VU_LIGHTS + channel * 6 + 4].setBrightness(meters[channel].getBrightness(-24, -12));
      lights[VU_LIGHTS + channel * 6 + 5].setBrightness(meters[channel].getBrightness(-36, -24));
    }
    lights[REC_LIGHT].setBrightness(captureActive ? 1.f : 0.f);
  }
};

RACK_WEB_EXPORTS(VcvRecorder)
