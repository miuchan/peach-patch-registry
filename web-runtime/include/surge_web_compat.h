#pragma once

#include <strings.h>

#ifndef _stricmp
#define _stricmp strcasecmp
#endif

#ifdef __cplusplus
static inline bool _BitScanReverse(unsigned int* result, unsigned int bits) {
  if (!result || !bits) return false;
  *result = static_cast<unsigned int>(__builtin_ctz(bits));
  return true;
}
#endif
