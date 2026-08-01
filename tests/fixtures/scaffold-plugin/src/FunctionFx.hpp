#pragma once
#include "plugin.hpp"

namespace fixture::fx {

enum FxType {
  fxt_fixture,
};

constexpr int n_fx_params = 12;

template <int fxType>
struct FXConfig {
  static constexpr int extraInputs() { return 0; }
  static constexpr int extraOutputs() { return 0; }
  static constexpr int specificParamCount() { return 0; }
  static constexpr int numParams() { return n_fx_params; }
  static void configSpecificParams(auto*) {}
};

template <int fxType>
struct FX : Module {
  static constexpr int n_mod_inputs = 4;

  enum ParamIds {
    FX_PARAM_0,
    DRIVE_PARAM = FX_PARAM_0,
    FEEDBACK_PARAM,
    TONE_PARAM,
    FX_MOD_PARAM_0 = FX_PARAM_0 + n_fx_params,
    FX_SPECIFIC_PARAM_0 = FX_MOD_PARAM_0 + n_fx_params * n_mod_inputs,
    NUM_PARAMS = FX_SPECIFIC_PARAM_0 + FXConfig<fxType>::specificParamCount(),
  };
  enum InputIds {
    INPUT_L,
    INPUT_R,
    SIDEBAND_L,
    SIDEBAND_R,
    INPUT_CLOCK,
    MOD_INPUT_0,
    INPUT_SPECIFIC_0 = MOD_INPUT_0 + n_mod_inputs,
    NUM_INPUTS = INPUT_SPECIFIC_0 + FXConfig<fxType>::extraInputs(),
  };
  enum OutputIds {
    OUTPUT_L,
    OUTPUT_R,
    EXTRA_OUTPUT_0,
    NUM_OUTPUTS = EXTRA_OUTPUT_0 + FXConfig<fxType>::extraOutputs(),
  };
  enum LightIds { NUM_LIGHTS };

  struct LegacyParameter { void set_name(const char*) {} };
  struct LegacyFxData { LegacyParameter p[n_fx_params]; } legacyFxData;
  LegacyFxData* fxdata = &legacyFxData;

  FX() {
    config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS);
    FXConfig<fxType>::configSpecificParams(this);
    configInput(INPUT_L, "Left");
    configInput(INPUT_R, "Right");
    configInput(SIDEBAND_L, "Left Sideband");
    configInput(SIDEBAND_R, "Right Sideband");
    configInput(INPUT_CLOCK, "Clock/Tempo CV");
    for (int index = 0; index < n_mod_inputs; ++index)
      configInput(MOD_INPUT_0 + index, "Modulation Signal");
    configOutput(OUTPUT_L, "Left");
    configOutput(OUTPUT_R, "Right");
    fxdata->p[DRIVE_PARAM].set_name("Drive");
    fxdata->p[FEEDBACK_PARAM].set_name("Feedback");
    fxdata->p[TONE_PARAM].set_name("Tone");
  }

  void process(const ProcessArgs&) override {}
};

} // namespace fixture::fx
