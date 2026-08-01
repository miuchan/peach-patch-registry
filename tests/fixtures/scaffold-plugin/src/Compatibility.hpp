#pragma once

#include <rack.hpp>

using namespace rack::dsp;

inline bool fixtureAnyConnected(std::vector<Input>* ports) {
  return !ports->empty() && (*ports)[0].isConnected();
}

enum FixtureVoltageRange {
  FIXTURE_ZERO_TO_TEN,
  FIXTURE_MINUS_PLUS_FIVE,
};

const extern float _PI;

inline float fixtureHeaderSaturate(float value) {
  return clamp(value, -10.f, 10.f);
}

template <typename T = float>
T fixtureDefaultTemplate(T value) {
  return value;
}

union FixtureSimdUnion {
  simd::float_4 lanes[2];
  float scalars[8];
};
