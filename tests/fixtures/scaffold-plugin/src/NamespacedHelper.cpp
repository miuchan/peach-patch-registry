#include "NamespacedHelper.hpp"

namespace fixture {
const float NamespacedGain::bias = 0.f;

float helperLeaf(float value) {
  return value;
}

float helperBridge(float value) {
  return helperLeaf(value);
}

NamespacedGain::NamespacedGain(float scale) : _scale(scale) {
  // A comment brace must not terminate extraction: }
}

float NamespacedGain::apply(float value) const {
  return helperBridge(value * _scale + bias);
}

template<int Scale> float NamespacedTemplateGain<Scale>::apply(float value) const {
  return value * Scale;
}
}
