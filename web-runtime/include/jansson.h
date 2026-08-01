#pragma once

// Rack re-exports Jansson through its host headers. The browser runtime keeps
// the compatible JSON ABI in rack_web.hpp and exposes it at the canonical path.
#include "rack_web.hpp"
