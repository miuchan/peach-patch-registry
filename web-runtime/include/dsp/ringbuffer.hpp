#pragma once

// Rack keeps RingBuffer and DoubleRingBuffer in this public compatibility
// header. The browser host defines the same templates in rack_web.hpp; retain
// the include path so plugins that include Rack's header directly compile
// without duplicating the types.
#include <rack_web.hpp>
