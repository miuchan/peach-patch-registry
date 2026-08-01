#pragma once
#include "FunctionFx.hpp"

namespace fixture::fx {

template <>
constexpr int FXConfig<fxt_fixture>::numParams() { return 11; }

template <>
constexpr int FXConfig<fxt_fixture>::specificParamCount() { return 2; }

template <>
void FXConfig<fxt_fixture>::configSpecificParams(FX<fxt_fixture>* module) {
  module->configOnOff(FX<fxt_fixture>::FX_SPECIFIC_PARAM_0, 1, "Enable Low Cut");
  module->configOnOff(FX<fxt_fixture>::FX_SPECIFIC_PARAM_0 + 1, 1, "Enable High Cut");
}

} // namespace fixture::fx
