#pragma once

// Rack plugins commonly include this SDK path only when their build enables
// RACK_SIMD. The browser runtime provides the compatible scalar four-lane
// implementation in rack_web.hpp.
#include "rack_web.hpp"
