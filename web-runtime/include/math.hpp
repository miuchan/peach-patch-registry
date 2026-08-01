#pragma once

// Rack plugins sometimes include this public SDK header directly instead of
// including rack.hpp. The browser host provides the same DSP-side math API in
// rack_web.hpp, so this compatibility header keeps the original include valid.
#include "rack_web.hpp"
