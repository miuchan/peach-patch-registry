#pragma once

namespace fixture {
struct NamespacedGain final {
  static const float bias;
  explicit NamespacedGain(float scale = 2.f);
  float apply(float value) const;

private:
  float _scale;
};

template <int Scale>
struct NamespacedTemplateGain {
  float apply(float value) const;
};
}
