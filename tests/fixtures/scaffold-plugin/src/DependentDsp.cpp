#include "DependentDsp.hpp"

static float fixtureDependentShape(float value);

const float fixtureDependentTwo = 2.f;
static const float fixtureDependentScale[1][1][1] = {
  {{fixtureDependentTwo}},
};

float FixtureDependentDsp::process(float value) {
  return fixtureDependentShape(fixtureHeaderSaturate(value));
}

static float fixtureDependentShape(float value) {
  return value * fixtureDependentScale[0][0][0];
}
