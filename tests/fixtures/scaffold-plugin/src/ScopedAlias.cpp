#include "ScopedAlias.hpp"

namespace fixture::ui {
template <typename ModuleType>
struct ScopedAliasWidget {
  // typedef WrongCommentModule M;
  using M = ModuleType;
};
}

rack::Model* modelScopedAlias =
  rack::createModel<fixture::ui::ScopedAliasWidget<fixture::dsp::ScopedAlias>::M, fixture::ui::ScopedAliasWidget<fixture::dsp::ScopedAlias>>("ScopedAlias");
