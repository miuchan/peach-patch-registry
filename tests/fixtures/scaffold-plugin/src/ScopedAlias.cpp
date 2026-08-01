#include "ScopedAlias.hpp"

namespace fixture::ui {
struct ScopedAliasWidget {
  typedef dsp::ScopedAlias M;
};
}

rack::Model* modelScopedAlias =
  rack::createModel<fixture::ui::ScopedAliasWidget::M, fixture::ui::ScopedAliasWidget>("ScopedAlias");
