#include "FunctionFx.hpp"
#include "FunctionFxConfig.hpp"

namespace fixture::fxui {

template <int fxType>
struct FXWidget : ModuleWidget {
  using M = fixture::fx::FX<fxType>;
};

} // namespace fixture::fxui

using fixture::fx::fxt_fixture;

#define FXMODEL(type, name) \
  Model* modelFX##name = createModel<fixture::fxui::FXWidget<type>::M, fixture::fxui::FXWidget<type>>( \
    std::string("SurgeXTFX") + #name);

FXMODEL(fxt_fixture, Fixture);
