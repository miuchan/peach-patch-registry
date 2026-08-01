#pragma once
#include "rack.hpp"

namespace fixture {

const double PI = 3.14159265358979323846;

struct VisualBase : Module {
  VisualBase() {
    config(0, 0, 0, 2);
  }
};

}
