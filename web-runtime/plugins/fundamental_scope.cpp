// DSP/pass-through portion of Fundamental Scope 2.6.4 for the browser.
// The ordered controls, ports, and lights match Rack; waveform rendering is
// handled by the web UI rather than the native NanoVG widget.
// Original source: https://github.com/VCVRack/Fundamental (GPL-3.0-or-later).

#include "rack_web_export.hpp"

struct FundamentalScope : Module {
  enum ParamIds { X_SCALE_PARAM, X_POS_PARAM, Y_SCALE_PARAM, Y_POS_PARAM, TIME_PARAM, LISSAJOUS_PARAM, THRESH_PARAM, TRIG_PARAM, NUM_PARAMS };
  enum InputIds { X_INPUT, Y_INPUT, TRIG_INPUT, NUM_INPUTS };
  enum OutputIds { X_OUTPUT, Y_OUTPUT, NUM_OUTPUTS };
  enum LightIds { LISSAJOUS_LIGHT, TRIG_LIGHT, NUM_LIGHTS };
  FundamentalScope() {
    config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS);
    configParam(X_SCALE_PARAM, 0.f, 8.f, 0.f, "Gain 1");
    configParam(X_POS_PARAM, -10.f, 10.f, 0.f, "Offset 1");
    configParam(Y_SCALE_PARAM, 0.f, 8.f, 0.f, "Gain 2");
    configParam(Y_POS_PARAM, -10.f, 10.f, 0.f, "Offset 2");
    configParam(TIME_PARAM, -5.643856f, 7.643856f, 1.f, "Time");
    configParam(LISSAJOUS_PARAM, 0.f, 1.f, 0.f, "Scope mode");
    configParam(THRESH_PARAM, -10.f, 10.f, 0.f, "Trigger threshold");
    configParam(TRIG_PARAM, 0.f, 1.f, 1.f, "Trigger");
  }
  void process(const ProcessArgs&) override {
    outputs[X_OUTPUT].setVoltage(inputs[X_INPUT].getVoltage());
    outputs[Y_OUTPUT].setVoltage(inputs[Y_INPUT].getVoltage());
    lights[LISSAJOUS_LIGHT].setBrightness(params[LISSAJOUS_PARAM].getValue() > 0.f);
    lights[TRIG_LIGHT].setBrightness(params[TRIG_PARAM].getValue() <= 0.f);
  }
};

RACK_WEB_EXPORTS(FundamentalScope)
