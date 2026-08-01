#pragma once

// Rack Web exposes the small libsamplerate surface used by VCV modules from
// rack_web.hpp. Keeping this compatibility header lets unchanged module source
// retain its original <samplerate.h> include inside standalone WASM builds.
#include "rack_web.hpp"
