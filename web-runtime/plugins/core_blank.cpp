// DSP-only compatibility module for Rack Core Blank 2.6.6.
// Original source: https://github.com/VCVRack/Rack
// Copyright VCV, licensed GPL-3.0-or-later.

#include "rack_web_export.hpp"

struct CoreBlank : Module {
  enum ParamIds { NUM_PARAMS };
  enum InputIds { NUM_INPUTS };
  enum OutputIds { NUM_OUTPUTS };
  enum LightIds { NUM_LIGHTS };
  CoreBlank() { config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS); }
};

RACK_WEB_EXPORTS(CoreBlank)
