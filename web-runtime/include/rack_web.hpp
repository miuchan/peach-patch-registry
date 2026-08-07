#pragma once

#include <cmath>
#include <cstddef>
#include <cstdint>
#include <algorithm>
#include <array>
#include <atomic>
#include <cassert>
#include <cctype>
#include <complex>
#include <cstdarg>
#include <cstdlib>
#include <cstring>
#include <cstdio>
#include <initializer_list>
#include <iostream>
#include <list>
#include <map>
#include <random>
#include <set>
#include <stdexcept>
#include <string>
#include <type_traits>
#include <utility>
#include <vector>
#include "osdialog.h"

#if __cplusplus >= 201703L
namespace std {
template <typename RandomIterator>
void random_shuffle(RandomIterator first, RandomIterator last) {
  static mt19937 generator{0x50454143u};
  shuffle(first, last, generator);
}
}
#endif

#ifndef DEBUG
#define DEBUG(...) ((void)0)
#endif
#ifndef INFO
#define INFO(...) ((void)0)
#endif
#ifndef WARN
#define WARN(...) ((void)0)
#endif

#ifndef LENGTHOF
#define LENGTHOF(array) (sizeof(array) / sizeof((array)[0]))
#endif

#ifndef ENUMS
#define ENUMS(name, count) name, name##_LAST = name + (count) - 1
#endif
#ifndef JSON_INDENT
#define JSON_INDENT(n) ((n) & 0x1f)
#endif
#ifndef JSON_REAL_PRECISION
#define JSON_REAL_PRECISION(n) (((n) & 0x1f) << 11)
#endif

#ifndef __forceinline
#define __forceinline inline __attribute__((always_inline))
#endif

#ifdef __EMSCRIPTEN__
template <typename Vector, typename Mask>
inline Vector rackWebBuiltinShuffle(const Vector& first, const Vector& second, const Mask& mask) {
  Vector result{};
  constexpr int lanes = sizeof(Vector) / sizeof(first[0]);
  for (int index = 0; index < lanes; index++) {
    const int source = mask[index];
    result[index] = source < lanes ? first[source] : second[source - lanes];
  }
  return result;
}
#define __builtin_shuffle(first, second, mask) rackWebBuiltinShuffle((first), (second), (mask))
#endif

template <typename Function>
struct RackWebDefer {
  Function function;
  ~RackWebDefer() { function(); }
};
template <typename Function>
RackWebDefer(Function) -> RackWebDefer<Function>;
#define RACK_WEB_JOIN_INNER(a, b) a##b
#define RACK_WEB_JOIN(a, b) RACK_WEB_JOIN_INNER(a, b)
#ifndef DEFER
#define DEFER(body) auto RACK_WEB_JOIN(rackWebDefer_, __LINE__) = RackWebDefer([&]() body)
#endif

#ifdef RACK_WEB_EXTERNAL_PFFFT
#include "pffft.h"
#else
extern "C" {
typedef enum {
  PFFFT_REAL,
  PFFFT_COMPLEX,
} pffft_transform_t;

typedef enum {
  PFFFT_FORWARD,
  PFFFT_BACKWARD,
} pffft_direction_t;

typedef struct PFFFT_Setup {
  int size;
  pffft_transform_t transform;
  mutable std::vector<std::complex<float>> scratch;
} PFFFT_Setup;

inline void* pffft_aligned_malloc(size_t bytes) {
  if (bytes == 0) return nullptr;
  constexpr size_t alignment = 16;
  return std::aligned_alloc(alignment, (bytes + alignment - 1) & ~(alignment - 1));
}
inline void pffft_aligned_free(void* pointer) {
  std::free(pointer);
}

inline PFFFT_Setup* pffft_new_setup(int size, pffft_transform_t transform) {
  if (size <= 0 || (size & (size - 1)) != 0) return nullptr;
  return new PFFFT_Setup{size, transform, std::vector<std::complex<float>>(static_cast<size_t>(size))};
}

inline void pffft_destroy_setup(PFFFT_Setup* setup) {
  delete setup;
}
}

inline void rackWebPffftTransform(std::vector<std::complex<float>>& values, bool inverse) {
  const size_t count = values.size();
  for (size_t index = 1, reversed = 0; index < count; ++index) {
    size_t bit = count >> 1;
    for (; reversed & bit; bit >>= 1) reversed ^= bit;
    reversed ^= bit;
    if (index < reversed) std::swap(values[index], values[reversed]);
  }
  for (size_t length = 2; length <= count; length <<= 1) {
    const float angle = (inverse ? 2.f : -2.f) * 3.14159265358979323846f / static_cast<float>(length);
    const std::complex<float> step(std::cos(angle), std::sin(angle));
    for (size_t offset = 0; offset < count; offset += length) {
      std::complex<float> twiddle(1.f, 0.f);
      for (size_t index = 0; index < length / 2; ++index) {
        const std::complex<float> even = values[offset + index];
        const std::complex<float> odd = values[offset + index + length / 2] * twiddle;
        values[offset + index] = even + odd;
        values[offset + index + length / 2] = even - odd;
        twiddle *= step;
      }
    }
  }
}

extern "C" inline void pffft_transform_ordered(
    const PFFFT_Setup* setup,
    const float* input,
    float* output,
    float*,
    pffft_direction_t direction) {
  if (!setup || !input || !output) return;
  const size_t count = static_cast<size_t>(setup->size);
  auto& values = setup->scratch;
  const bool inverse = direction == PFFFT_BACKWARD;

  if (setup->transform == PFFFT_REAL) {
    if (!inverse) {
      for (size_t index = 0; index < count; ++index) values[index] = {input[index], 0.f};
      rackWebPffftTransform(values, false);
      output[0] = values[0].real();
      output[1] = values[count / 2].real();
      for (size_t index = 1; index < count / 2; ++index) {
        output[index * 2] = values[index].real();
        output[index * 2 + 1] = values[index].imag();
      }
    }
    else {
      values[0] = {input[0], 0.f};
      values[count / 2] = {input[1], 0.f};
      for (size_t index = 1; index < count / 2; ++index) {
        values[index] = {input[index * 2], input[index * 2 + 1]};
        values[count - index] = std::conj(values[index]);
      }
      rackWebPffftTransform(values, true);
      for (size_t index = 0; index < count; ++index) output[index] = values[index].real();
    }
    return;
  }

  for (size_t index = 0; index < count; ++index)
    values[index] = {input[index * 2], input[index * 2 + 1]};
  rackWebPffftTransform(values, inverse);
  for (size_t index = 0; index < count; ++index) {
    output[index * 2] = values[index].real();
    output[index * 2 + 1] = values[index].imag();
  }
}
#endif

struct json_t {
  enum class Type { Object, Array, Integer, Real, Boolean, String, Null } type = Type::Object;
  int refs = 1;
  double number = 0.0;
  std::string text;
  std::vector<std::string> keys;
  std::vector<json_t*> values;
  int size = 0;
};
struct json_error_t { int line = 0; int column = 0; int position = 0; char source[80]{}; char text[160]{}; };
using json_int_t = long long;
enum json_type { JSON_OBJECT, JSON_ARRAY, JSON_STRING, JSON_INTEGER, JSON_REAL, JSON_TRUE, JSON_FALSE, JSON_NULL };

// Minimal, stateful libsamplerate-compatible surface used by Rack modules.
// The browser runtime uses linear interpolation because the native library is
// not available inside standalone WASM, while preserving its streaming and
// frame-accounting contract.
static constexpr int SRC_SINC_FASTEST = 2;
struct SRC_STATE {
  double inputPosition = 0.0;
  float delay[20]{};
  int delayCursor = 0;
  int delaySize = 0;
};
struct SRC_DATA {
  const float* data_in = nullptr;
  float* data_out = nullptr;
  long input_frames = 0;
  long output_frames = 0;
  long input_frames_used = 0;
  long output_frames_gen = 0;
  int end_of_input = 0;
  double src_ratio = 1.0;
};
inline SRC_STATE* src_new(int, int channels, int* error) {
  if (error) *error = channels == 1 ? 0 : 1;
  return channels == 1 ? new SRC_STATE() : nullptr;
}
inline SRC_STATE* src_delete(SRC_STATE* state) { delete state; return nullptr; }
inline int src_process(SRC_STATE* state, SRC_DATA* data) {
  if (!state || !data || !data->data_in || !data->data_out || data->src_ratio <= 0.0) return 1;
  double position = state->inputPosition;
  const double step = 1.0 / data->src_ratio;
  long generated = 0;
  while (generated < data->output_frames && position < data->input_frames) {
    const long first = static_cast<long>(position);
    const long second = std::min(first + 1, data->input_frames - 1);
    const float fraction = static_cast<float>(position - first);
    const float interpolated = data->data_in[first] + (data->data_in[second] - data->data_in[first]) * fraction;
    float delayed = 0.f;
    if (state->delaySize < 20) {
      state->delay[state->delaySize++] = interpolated;
    }
    else {
      delayed = state->delay[state->delayCursor];
      state->delay[state->delayCursor] = interpolated;
      state->delayCursor = (state->delayCursor + 1) % 20;
    }
    data->data_out[generated++] = delayed;
    position += step;
  }
  const long used = std::min(data->input_frames, static_cast<long>(position));
  state->inputPosition = position - used;
  data->input_frames_used = used;
  data->output_frames_gen = generated;
  return 0;
}
inline json_t* json_object() { return new json_t(); }
inline json_t* json_array() { auto* result = new json_t(); result->type = json_t::Type::Array; return result; }
inline json_t* json_integer(long long value) { auto* result = new json_t(); result->type = json_t::Type::Integer; result->number = static_cast<double>(value); return result; }
inline json_t* json_real(double value) { auto* result = new json_t(); result->type = json_t::Type::Real; result->number = value; return result; }
inline json_t* json_boolean(int value) { auto* result = new json_t(); result->type = json_t::Type::Boolean; result->number = value ? 1.0 : 0.0; return result; }
inline json_t* json_true() { return json_boolean(1); }
inline json_t* json_false() { return json_boolean(0); }
inline json_t* json_bool(int value) { return json_boolean(value); }
inline json_t* json_null() { auto* result = new json_t(); result->type = json_t::Type::Null; return result; }
inline json_t* json_string(const char* value) { auto* result = new json_t(); result->type = json_t::Type::String; result->text = value ? value : ""; return result; }
inline json_t* json_stringn(const char* value, size_t size) { auto* result = new json_t(); result->type = json_t::Type::String; if (value) result->text.assign(value, size); return result; }
inline void json_decref(json_t* value);
inline json_t* json_deep_copy(const json_t* value) {
  if (!value) return nullptr;
  auto* copy = new json_t();
  copy->type = value->type;
  copy->number = value->number;
  copy->text = value->text;
  copy->keys = value->keys;
  copy->values.reserve(value->values.size());
  for (const json_t* child : value->values) copy->values.push_back(json_deep_copy(child));
  copy->size = static_cast<int>(copy->values.size());
  return copy;
}
inline void json_object_set_new(json_t* object, const char* key, json_t* value) {
  if (!object || object->type != json_t::Type::Object || !key) { json_decref(value); return; }
  for (int index = 0; index < object->size; index++) {
    if (object->keys[index] == key) { json_decref(object->values[index]); object->values[index] = value; return; }
  }
  object->keys.emplace_back(key);
  object->values.push_back(value);
  object->size = static_cast<int>(object->values.size());
}
// Jansson's json_object_set() retains its argument while json_object_set_new()
// steals it. Rack Web owns a tree without shared references, so preserve the
// observable contract by storing an independent copy.
inline void json_object_set(json_t* object, const char* key, json_t* value) {
  json_object_set_new(object, key, json_deep_copy(value));
}
inline json_t* json_object_get(json_t* object, const char* key) { if (!object || object->type != json_t::Type::Object) return nullptr; for (int index = 0; index < object->size; index++) if (object->keys[index] == key) return object->values[index]; return nullptr; }
inline json_t* json_object_get(const json_t* object, const char* key) { return json_object_get(const_cast<json_t*>(object), key); }
inline void json_array_insert_new(json_t* array, int index, json_t* value) {
  if (!array || array->type != json_t::Type::Array || index < 0) { json_decref(value); return; }
  if (index >= static_cast<int>(array->values.size())) array->values.resize(index + 1, nullptr);
  json_decref(array->values[index]);
  array->values[index] = value;
  array->size = static_cast<int>(array->values.size());
}
inline int json_array_set_new(json_t* array, size_t index, json_t* value) {
  if (!array || array->type != json_t::Type::Array) { json_decref(value); return -1; }
  if (index >= array->values.size()) array->values.resize(index + 1, nullptr);
  json_decref(array->values[index]);
  array->values[index] = value;
  array->size = static_cast<int>(array->values.size());
  return 0;
}
inline void json_array_append_new(json_t* array, json_t* value) {
  if (!array || array->type != json_t::Type::Array) { json_decref(value); return; }
  array->values.push_back(value);
  array->size = static_cast<int>(array->values.size());
}
inline int json_array_append(json_t* array, const json_t* value) {
  if (!array || array->type != json_t::Type::Array) return -1;
  json_array_append_new(array, json_deep_copy(value));
  return 0;
}
inline json_t* json_array_get(json_t* array, int index) { return array && array->type == json_t::Type::Array && index >= 0 && index < array->size ? array->values[index] : nullptr; }
inline json_t* json_array_get(const json_t* array, int index) { return json_array_get(const_cast<json_t*>(array), index); }
inline size_t json_array_size(const json_t* array) { return array && array->type == json_t::Type::Array ? array->values.size() : 0; }
#define json_array_foreach(array, index, value) for ((index) = 0; (index) < json_array_size(array) && (((value) = json_array_get((array), static_cast<int>(index))), true); (index)++)
#define json_object_foreach(object, key, value) for (size_t rack_web_json_object_index = 0; (object) && (object)->type == json_t::Type::Object && rack_web_json_object_index < (object)->keys.size() && (((key) = (object)->keys[rack_web_json_object_index].c_str()), ((value) = (object)->values[rack_web_json_object_index]), true); rack_web_json_object_index++)
inline int json_is_array(const json_t* value) { return value && value->type == json_t::Type::Array; }
inline int json_is_object(const json_t* value) { return value && value->type == json_t::Type::Object; }
inline int json_is_string(const json_t* value) { return value && value->type == json_t::Type::String; }
inline int json_is_integer(const json_t* value) { return value && value->type == json_t::Type::Integer; }
inline int json_is_real(const json_t* value) { return value && value->type == json_t::Type::Real; }
inline int json_is_number(const json_t* value) { return json_is_integer(value) || json_is_real(value); }
inline int json_is_boolean(const json_t* value) { return value && value->type == json_t::Type::Boolean; }
inline int json_is_null(const json_t* value) { return value && value->type == json_t::Type::Null; }
inline json_type json_typeof(const json_t* value) {
  if (!value) return JSON_NULL;
  if (value->type == json_t::Type::Object) return JSON_OBJECT;
  if (value->type == json_t::Type::Array) return JSON_ARRAY;
  if (value->type == json_t::Type::String) return JSON_STRING;
  if (value->type == json_t::Type::Integer) return JSON_INTEGER;
  if (value->type == json_t::Type::Real) return JSON_REAL;
  if (value->type == json_t::Type::Null) return JSON_NULL;
  return value->number != 0.0 ? JSON_TRUE : JSON_FALSE;
}
inline void json_object_update(json_t* object, const json_t* source) {
  if (!object || object->type != json_t::Type::Object || !source || source->type != json_t::Type::Object) return;
  for (int index = 0; index < source->size; index++) json_object_set_new(object, source->keys[index].c_str(), json_deep_copy(source->values[index]));
}
inline long long json_integer_value(const json_t* value) { return value ? static_cast<long long>(value->number) : 0; }
inline double json_real_value(const json_t* value) { return value ? value->number : 0.0; }
inline double json_number_value(const json_t* value) { return value ? value->number : 0.0; }
inline int json_boolean_value(const json_t* value) { return value && value->number != 0.0; }
inline int json_bool_value(const json_t* value) { return value && value->number != 0.0; }
inline int json_is_true(const json_t* value) { return value && value->number != 0.0; }
inline int json_is_false(const json_t* value) { return json_is_boolean(value) && value->number == 0.0; }
inline const char* json_string_value(const json_t* value) { return value && value->type == json_t::Type::String ? value->text.c_str() : ""; }
// Rack plugins commonly use Jansson's compact array helpers for small numeric
// state tuples. Preserve the scalar subset used by open-source modules while
// keeping ownership identical to json_array_append_new().
inline json_t* json_pack(const char* format, ...) {
  if (!format || std::strchr(format, '[') == nullptr || std::strchr(format, ']') == nullptr) return nullptr;
  auto* array = json_array();
  va_list values;
  va_start(values, format);
  for (const char* cursor = format; *cursor; ++cursor) {
    switch (*cursor) {
      case 'f': case 'F': json_array_append_new(array, json_real(va_arg(values, double))); break;
      case 'i': json_array_append_new(array, json_integer(va_arg(values, int))); break;
      case 'I': json_array_append_new(array, json_integer(va_arg(values, json_int_t))); break;
      case 'b': json_array_append_new(array, json_boolean(va_arg(values, int))); break;
      case 's': json_array_append_new(array, json_string(va_arg(values, const char*))); break;
      default: break;
    }
  }
  va_end(values);
  return array;
}
inline int json_unpack(const json_t* array, const char* format, ...) {
  if (!json_is_array(array) || !format) return -1;
  va_list outputs;
  va_start(outputs, format);
  int index = 0, result = 0;
  for (const char* cursor = format; *cursor; ++cursor) {
    const char type = *cursor;
    if (type != 'f' && type != 'F' && type != 'i' && type != 'I' && type != 'b' && type != 's') continue;
    const json_t* value = json_array_get(const_cast<json_t*>(array), index++);
    if (!value) { result = -1; break; }
    switch (type) {
      case 'f': case 'F': { auto* output = va_arg(outputs, double*); if (output) *output = json_number_value(value); break; }
      case 'i': { auto* output = va_arg(outputs, int*); if (output) *output = static_cast<int>(json_integer_value(value)); break; }
      case 'I': { auto* output = va_arg(outputs, json_int_t*); if (output) *output = json_integer_value(value); break; }
      case 'b': { auto* output = va_arg(outputs, int*); if (output) *output = json_boolean_value(value); break; }
      case 's': { auto* output = va_arg(outputs, const char**); if (output) *output = json_string_value(value); break; }
      default: break;
    }
  }
  va_end(outputs);
  return result;
}
inline json_t* json_incref(json_t* value) { if (value) value->refs++; return value; }
inline void json_decref(json_t* value) { if (!value || --value->refs > 0) return; if (value->type == json_t::Type::Object || value->type == json_t::Type::Array) for (json_t* child : value->values) json_decref(child); delete value; }

// A bounded JSON reader for VCV module `data`. Rack normally delegates this
// to Jansson; standalone browser modules cannot link that native dependency.
// It deliberately accepts the complete JSON value grammar while requiring the
// exported state root to be an object.
struct RackWebJsonReader {
  const char* cursor = nullptr;
  const char* end = nullptr;
  int depth = 0;
  size_t nodes = 0;
  bool valid = true;

  RackWebJsonReader(const char* data, size_t size) : cursor(data), end(data + size) {}
  void whitespace() { while (cursor < end && std::isspace(static_cast<unsigned char>(*cursor))) cursor++; }
  bool take(char wanted) { whitespace(); if (cursor >= end || *cursor != wanted) return false; cursor++; return true; }
  static void appendUtf8(std::string& result, uint32_t codepoint) {
    if (codepoint <= 0x7f) result.push_back(static_cast<char>(codepoint));
    else if (codepoint <= 0x7ff) { result.push_back(static_cast<char>(0xc0 | (codepoint >> 6))); result.push_back(static_cast<char>(0x80 | (codepoint & 0x3f))); }
    else if (codepoint <= 0xffff) { result.push_back(static_cast<char>(0xe0 | (codepoint >> 12))); result.push_back(static_cast<char>(0x80 | ((codepoint >> 6) & 0x3f))); result.push_back(static_cast<char>(0x80 | (codepoint & 0x3f))); }
    else { result.push_back(static_cast<char>(0xf0 | (codepoint >> 18))); result.push_back(static_cast<char>(0x80 | ((codepoint >> 12) & 0x3f))); result.push_back(static_cast<char>(0x80 | ((codepoint >> 6) & 0x3f))); result.push_back(static_cast<char>(0x80 | (codepoint & 0x3f))); }
  }
  bool hex4(uint32_t& result) {
    result = 0;
    for (int index = 0; index < 4; index++) {
      if (cursor >= end) return false;
      const char value = *cursor++;
      const int digit = value >= '0' && value <= '9' ? value - '0' : value >= 'a' && value <= 'f' ? value - 'a' + 10 : value >= 'A' && value <= 'F' ? value - 'A' + 10 : -1;
      if (digit < 0) return false;
      result = (result << 4) | static_cast<uint32_t>(digit);
    }
    return true;
  }
  bool string(std::string& result) {
    whitespace();
    if (cursor >= end || *cursor++ != '"') return false;
    while (cursor < end) {
      const unsigned char value = static_cast<unsigned char>(*cursor++);
      if (value == '"') return true;
      if (value < 0x20) return false;
      if (value != '\\') { result.push_back(static_cast<char>(value)); continue; }
      if (cursor >= end) return false;
      const char escape = *cursor++;
      if (escape == '"' || escape == '\\' || escape == '/') result.push_back(escape);
      else if (escape == 'b') result.push_back('\b');
      else if (escape == 'f') result.push_back('\f');
      else if (escape == 'n') result.push_back('\n');
      else if (escape == 'r') result.push_back('\r');
      else if (escape == 't') result.push_back('\t');
      else if (escape == 'u') {
        uint32_t codepoint = 0;
        if (!hex4(codepoint)) return false;
        if (codepoint >= 0xd800 && codepoint <= 0xdbff) {
          if (end - cursor < 6 || cursor[0] != '\\' || cursor[1] != 'u') return false;
          cursor += 2;
          uint32_t low = 0;
          if (!hex4(low) || low < 0xdc00 || low > 0xdfff) return false;
          codepoint = 0x10000 + ((codepoint - 0xd800) << 10) + (low - 0xdc00);
        }
        else if (codepoint >= 0xdc00 && codepoint <= 0xdfff) return false;
        appendUtf8(result, codepoint);
      }
      else return false;
    }
    return false;
  }
  json_t* value() {
    whitespace();
    if (!valid || cursor >= end || depth >= 128 || nodes++ >= 1000000) { valid = false; return nullptr; }
    if (*cursor == '{') return object();
    if (*cursor == '[') return array();
    if (*cursor == '"') { std::string text; if (!string(text)) { valid = false; return nullptr; } return json_string(text.c_str()); }
    if (end - cursor >= 4 && std::memcmp(cursor, "true", 4) == 0) { cursor += 4; return json_boolean(1); }
    if (end - cursor >= 5 && std::memcmp(cursor, "false", 5) == 0) { cursor += 5; return json_boolean(0); }
    if (end - cursor >= 4 && std::memcmp(cursor, "null", 4) == 0) { cursor += 4; return json_null(); }
    const char* numberStart = cursor;
    char* numberEnd = nullptr;
    const double number = std::strtod(cursor, &numberEnd);
    if (numberEnd == cursor || numberEnd > end || !std::isfinite(number)) { valid = false; return nullptr; }
    cursor = numberEnd;
    bool integer = true;
    for (const char* current = numberStart; current < numberEnd; current++) if (*current == '.' || *current == 'e' || *current == 'E') integer = false;
    return integer ? json_integer(static_cast<long long>(number)) : json_real(number);
  }
  json_t* object() {
    if (!take('{')) { valid = false; return nullptr; }
    auto* result = json_object();
    depth++;
    whitespace();
    if (take('}')) { depth--; return result; }
    while (valid) {
      std::string key;
      if (!string(key) || !take(':')) { valid = false; break; }
      whitespace();
      const bool isNull = end - cursor >= 4 && std::memcmp(cursor, "null", 4) == 0;
      json_t* child = value();
      if (!valid) { json_decref(child); break; }
      json_object_set_new(result, key.c_str(), child);
      if (take('}')) { depth--; return result; }
      if (!take(',')) { valid = false; break; }
      (void)isNull;
    }
    depth--;
    json_decref(result);
    return nullptr;
  }
  json_t* array() {
    if (!take('[')) { valid = false; return nullptr; }
    auto* result = json_array();
    depth++;
    whitespace();
    if (take(']')) { depth--; return result; }
    while (valid) {
      json_t* child = value();
      if (!valid) { json_decref(child); break; }
      json_array_append_new(result, child);
      if (take(']')) { depth--; return result; }
      if (!take(',')) { valid = false; break; }
    }
    depth--;
    json_decref(result);
    return nullptr;
  }
};
inline json_t* rack_web_parse_json(const char* data, size_t size) {
  if (!data || size == 0) return nullptr;
  RackWebJsonReader reader(data, size);
  json_t* result = reader.value();
  reader.whitespace();
  if (!reader.valid || reader.cursor != reader.end) { json_decref(result); return nullptr; }
  return result;
}
inline json_t* json_loads(const char* input, size_t, json_error_t*) {
  return input ? rack_web_parse_json(input, std::strlen(input)) : nullptr;
}
inline json_t* json_loadf(std::FILE* input, size_t, json_error_t*) {
  if (!input) return nullptr;
  std::string contents;
  char chunk[4096];
  while (contents.size() <= 4 * 1024 * 1024) {
    const size_t count = std::fread(chunk, 1, sizeof(chunk), input);
    contents.append(chunk, count);
    if (count < sizeof(chunk)) break;
  }
  return contents.size() <= 4 * 1024 * 1024 ? rack_web_parse_json(contents.data(), contents.size()) : nullptr;
}
inline void rack_web_append_json_string(std::string& output, const std::string& value) {
  output.push_back('"');
  for (const unsigned char byte : value) {
    switch (byte) {
      case '"': output += "\\\""; break;
      case '\\': output += "\\\\"; break;
      case '\b': output += "\\b"; break;
      case '\f': output += "\\f"; break;
      case '\n': output += "\\n"; break;
      case '\r': output += "\\r"; break;
      case '\t': output += "\\t"; break;
      default:
        if (byte < 0x20) { char escaped[7]{}; std::snprintf(escaped, sizeof(escaped), "\\u%04x", byte); output += escaped; }
        else output.push_back(static_cast<char>(byte));
    }
  }
  output.push_back('"');
}
inline void rack_web_dump_json(const json_t* value, std::string& output) {
  if (!value) { output += "null"; return; }
  if (value->type == json_t::Type::Object) {
    output.push_back('{');
    for (int index = 0; index < value->size; index++) {
      if (index) output.push_back(',');
      rack_web_append_json_string(output, value->keys[index]);
      output.push_back(':');
      rack_web_dump_json(value->values[index], output);
    }
    output.push_back('}');
  }
  else if (value->type == json_t::Type::Array) {
    output.push_back('[');
    for (int index = 0; index < value->size; index++) { if (index) output.push_back(','); rack_web_dump_json(value->values[index], output); }
    output.push_back(']');
  }
  else if (value->type == json_t::Type::String) rack_web_append_json_string(output, value->text);
  else if (value->type == json_t::Type::Boolean) output += value->number != 0.0 ? "true" : "false";
  else {
    char number[40]{};
    std::snprintf(number, sizeof(number), "%.17g", std::isfinite(value->number) ? value->number : 0.0);
    output += number;
  }
}
inline char* json_dumps(const json_t* value, size_t) {
  std::string output;
  rack_web_dump_json(value, output);
  auto* result = static_cast<char*>(std::malloc(output.size() + 1));
  if (!result) return nullptr;
  std::memcpy(result, output.c_str(), output.size() + 1);
  return result;
}
inline int json_dumpf(const json_t* value, std::FILE* output, size_t) {
  if (!output) return -1;
  std::string encoded;
  rack_web_dump_json(value, encoded);
  return std::fwrite(encoded.data(), 1, encoded.size(), output) == encoded.size() ? 0 : -1;
}

struct SkinChangeListener { virtual ~SkinChangeListener() = default; virtual void skinChanged(const std::string&) {} };
struct RackWebSkinRegistry { bool validKey(const std::string&) const { return true; } };
struct Skins { static RackWebSkinRegistry& skins() { static RackWebSkinRegistry registry; return registry; } };

namespace rack {

struct Menu;
namespace event {
struct Action {};
}
struct MenuItem {
  virtual ~MenuItem() = default;
  std::string text;
  std::string rightText;
  virtual Menu* createChildMenu() { return nullptr; }
  virtual void onAction(const event::Action&) {}
};
struct Menu {
  std::vector<MenuItem*> children;
  ~Menu() { for (auto* child : children) delete child; }
  void addChild(MenuItem* child) { if (child) children.push_back(child); }
};
inline constexpr const char* RIGHT_ARROW = "›";

static constexpr int PORT_MAX_CHANNELS = 16;
static constexpr int RACK_GRID_WIDTH = 15;
static constexpr int RACK_GRID_HEIGHT = 380;
inline float tanpif(float value) { return std::tan(static_cast<float>(M_PI) * value); }
namespace logger {}
template <typename T = void> inline T* appGet() { return nullptr; }

namespace plugin {
struct Model {
  std::string slug;
  bool hidden = false;
  std::string getFullName() const { return slug; }
  std::string getFactoryPresetDirectory() const { return std::string("/rack-web/plugin/presets/") + slug; }
};
struct Plugin {
  std::vector<Model*> models;
  void addModel(Model* model) {
    if (model) models.push_back(model);
  }
};
}

using Model = plugin::Model;
using Plugin = plugin::Plugin;

// Rack source adapters run in Emscripten's virtual filesystem. These paths
// preserve the host API contract; modules can use packaged or uploaded files
// without depending on a native Rack installation.
namespace asset {
inline std::string user(const std::string& relative) { return std::string("/rack-web/user/") + relative; }
inline std::string plugin(Plugin*, const std::string& relative) { return std::string("/rack-web/plugin/") + relative; }
inline std::string system(const std::string& relative) { return std::string("/rack-web/system/") + relative; }
}

// Pure path helpers remain useful when restoring desktop patch JSON even
// though browser modules receive file contents through the asset ABI.
namespace system {
inline std::string getFilename(const std::string& value) { const auto slash=value.find_last_of("/\\"); return slash==std::string::npos?value:value.substr(slash+1); }
inline std::string getDirectory(const std::string& value) { const auto slash=value.find_last_of("/\\"); return slash==std::string::npos?std::string():value.substr(0,slash); }
inline std::string getExtension(const std::string& value) { const std::string filename=getFilename(value); const auto dot=filename.find_last_of('.'); return dot==std::string::npos?std::string():filename.substr(dot+1); }
inline std::string getStem(const std::string& value) { const std::string filename=getFilename(value); const auto dot=filename.find_last_of('.'); return dot==std::string::npos?filename:filename.substr(0,dot); }
inline std::string join(const std::string& directory, const std::string& name) { if(directory.empty())return name;if(name.empty())return directory;const char tail=directory.back();return tail=='/'||tail=='\\'?directory+name:directory+"/"+name; }
inline bool isFile(const std::string&) { return false; }
inline bool isDirectory(const std::string&) { return false; }
inline void createDirectories(const std::string&) {}
inline std::vector<std::string> getEntries(const std::string&) { return {}; }
inline double getTime() { static double time = 0.; time += 1. / 60.; return time; }
}

struct ModuleWidget;

template <typename TModule, typename TWidget>
plugin::Model* createModel(const std::string&) {
  static plugin::Model model;
  return &model;
}

namespace simd {
inline uint32_t rackWebFloatBits(float value) {
  uint32_t bits = 0;
  std::memcpy(&bits, &value, sizeof(bits));
  return bits;
}

inline float rackWebFloatFromBits(uint32_t bits) {
  float value = 0.f;
  std::memcpy(&value, &bits, sizeof(value));
  return value;
}

inline float rackWebFloatMask(bool value) {
  return rackWebFloatFromBits(value ? UINT32_MAX : 0u);
}

struct float_4 {
  static constexpr int size = 4;
#ifdef __SSE__
  union { float values[4]; __m128 v; float s[4]; };
#else
  union { float values[4]; float v[4]; float s[4]; };
#endif

  float_4() = default;
  float_4(float value) : values{value, value, value, value} {}
  float_4(float first, float second, float third, float fourth) : values{first, second, third, fourth} {}
#ifdef __SSE__
  float_4(__m128 value) : v(value) {}
  float_4& operator=(__m128 value) { v = value; return *this; }
#endif
  static float_4 zero() { return float_4(0.f); }
  static float_4 load(const float* source) { float_4 result; for (int index = 0; index < 4; index++) result[index] = source[index]; return result; }
  static float_4 mask() { return float_4(rackWebFloatMask(true)); }
  void store(float* target) const { for (int index = 0; index < 4; index++) target[index] = values[index]; }
  float& operator[](int index) { return values[index]; }
  float operator[](int index) const { return values[index]; }
  float_4& operator+=(const float_4& other) { for (int index = 0; index < 4; index++) values[index] += other[index]; return *this; }
  float_4& operator-=(const float_4& other) { for (int index = 0; index < 4; index++) values[index] -= other[index]; return *this; }
  float_4& operator*=(const float_4& other) { for (int index = 0; index < 4; index++) values[index] *= other[index]; return *this; }
  float_4& operator/=(const float_4& other) { for (int index = 0; index < 4; index++) values[index] /= other[index]; return *this; }
  float_4& operator&=(const float_4& other) { for (int index = 0; index < 4; index++) values[index] = rackWebFloatFromBits(rackWebFloatBits(values[index]) & rackWebFloatBits(other[index])); return *this; }
  float_4& operator|=(const float_4& other) { for (int index = 0; index < 4; index++) values[index] = rackWebFloatFromBits(rackWebFloatBits(values[index]) | rackWebFloatBits(other[index])); return *this; }
  float_4& operator^=(const float_4& other) { for (int index = 0; index < 4; index++) values[index] = rackWebFloatFromBits(rackWebFloatBits(values[index]) ^ rackWebFloatBits(other[index])); return *this; }
  float_4& operator++() { for (float& value : values) value += 1.f; return *this; }
  float_4 operator++(int) { float_4 previous = *this; ++*this; return previous; }
  float_4& operator--() { for (float& value : values) value -= 1.f; return *this; }
  float_4 operator--(int) { float_4 previous = *this; --*this; return previous; }
};

struct int32_4 {
  int32_t values[4]{};

  int32_4() = default;
  int32_4(int32_t value) : values{value, value, value, value} {}
  int32_4(int32_t x, int32_t y, int32_t z, int32_t w) : values{x, y, z, w} {}
  int32_4(const float_4& value) {
    for (int index = 0; index < 4; index++) values[index] = static_cast<int32_t>(value[index]);
  }
  int32_4& operator=(int32_t value) { for (int index = 0; index < 4; index++) values[index] = value; return *this; }
  int32_4& operator=(const float_4& value) { for (int index = 0; index < 4; index++) values[index] = static_cast<int32_t>(value[index]); return *this; }
  operator float_4() const { float_4 result; for (int index = 0; index < 4; index++) result[index] = static_cast<float>(values[index]); return result; }
  static int32_4 load(const int32_t* source) { int32_4 result; for (int index = 0; index < 4; index++) result[index] = source[index]; return result; }
  void store(int32_t* target) const { for (int index = 0; index < 4; index++) target[index] = values[index]; }
  int32_t& operator[](int index) { return values[index]; }
  int32_t operator[](int index) const { return values[index]; }
  int32_4& operator+=(const int32_4& other) { for (int index = 0; index < 4; index++) values[index] = static_cast<int32_t>(static_cast<uint32_t>(values[index]) + static_cast<uint32_t>(other[index])); return *this; }
  int32_4& operator-=(const int32_4& other) { for (int index = 0; index < 4; index++) values[index] = static_cast<int32_t>(static_cast<uint32_t>(values[index]) - static_cast<uint32_t>(other[index])); return *this; }
  int32_4& operator*=(const int32_4& other) { for (int index = 0; index < 4; index++) values[index] = static_cast<int32_t>(static_cast<uint32_t>(values[index]) * static_cast<uint32_t>(other[index])); return *this; }
  int32_4& operator&=(const int32_4& other) { for (int index = 0; index < 4; index++) values[index] &= other[index]; return *this; }
  int32_4& operator|=(const int32_4& other) { for (int index = 0; index < 4; index++) values[index] |= other[index]; return *this; }
  int32_4& operator^=(const int32_4& other) { for (int index = 0; index < 4; index++) values[index] ^= other[index]; return *this; }
};

inline int32_4 operator+(int32_4 left, const int32_4& right) { return left += right; }
inline int32_4 operator-(int32_4 left, const int32_4& right) { return left -= right; }
inline int32_4 operator*(int32_4 left, const int32_4& right) { return left *= right; }
inline int32_4 operator-(const int32_4& value) { int32_4 result; for (int index = 0; index < 4; index++) result[index] = static_cast<int32_t>(0u - static_cast<uint32_t>(value[index])); return result; }
inline int32_4 operator&(const int32_4& left, const int32_4& right) { int32_4 result; for (int index = 0; index < 4; index++) result[index] = left[index] & right[index]; return result; }
inline int32_4 operator|(const int32_4& left, const int32_4& right) { int32_4 result; for (int index = 0; index < 4; index++) result[index] = left[index] | right[index]; return result; }
inline int32_4 operator^(const int32_4& left, const int32_4& right) { int32_4 result; for (int index = 0; index < 4; index++) result[index] = left[index] ^ right[index]; return result; }
inline int32_4 operator~(const int32_4& value) { int32_4 result; for (int index = 0; index < 4; index++) result[index] = ~value[index]; return result; }
inline int32_4 operator<<(const int32_4& left, const int32_4& right) { int32_4 result; for (int index = 0; index < 4; index++) result[index] = left[index] << (right[index] & 31); return result; }
inline int32_4 operator>>(const int32_4& left, const int32_4& right) { int32_4 result; for (int index = 0; index < 4; index++) result[index] = left[index] >> (right[index] & 31); return result; }
#define RACK_WEB_INT32_SIMD_COMPARE(op) inline int32_4 operator op(const int32_4& left, const int32_4& right) { int32_4 result; for (int index = 0; index < 4; index++) result[index] = left[index] op right[index] ? -1 : 0; return result; }
RACK_WEB_INT32_SIMD_COMPARE(<)
RACK_WEB_INT32_SIMD_COMPARE(<=)
RACK_WEB_INT32_SIMD_COMPARE(>)
RACK_WEB_INT32_SIMD_COMPARE(>=)
RACK_WEB_INT32_SIMD_COMPARE(==)
RACK_WEB_INT32_SIMD_COMPARE(!=)
#undef RACK_WEB_INT32_SIMD_COMPARE

inline float_4 operator+(float_4 left, const float_4& right) { return left += right; }
inline float_4 operator-(float_4 left, const float_4& right) { return left -= right; }
inline float_4 operator*(float_4 left, const float_4& right) { return left *= right; }
inline float_4 operator/(float_4 left, const float_4& right) { return left /= right; }
template <typename Left, std::enable_if_t<std::is_same_v<std::decay_t<Left>, int32_4>, int> = 0>
inline float_4 operator*(Left&& left, const float_4& right) { return float_4(left) * right; }
template <typename Right, std::enable_if_t<std::is_same_v<std::decay_t<Right>, int32_4>, int> = 0>
inline float_4 operator*(const float_4& left, Right&& right) { return left * float_4(right); }
inline float_4 operator-(const float_4& value) { return float_4(0.f) - value; }
inline float_4 operator&(float_4 left, const float_4& right) { return left &= right; }
inline float_4 operator|(float_4 left, const float_4& right) { return left |= right; }
inline float_4 operator^(float_4 left, const float_4& right) { return left ^= right; }
inline float_4 operator~(const float_4& value) { return value ^ float_4::mask(); }
inline int32_4 andnot(const int32_4& left, const int32_4& right) { return ~left & right; }
inline float_4 andnot(const float_4& left, const float_4& right) { return ~left & right; }
#define RACK_WEB_SIMD_COMPARE(op) inline float_4 operator op(const float_4& left, const float_4& right) { float_4 result; for (int index = 0; index < 4; index++) result[index] = rackWebFloatMask(left[index] op right[index]); return result; }
RACK_WEB_SIMD_COMPARE(<)
RACK_WEB_SIMD_COMPARE(<=)
RACK_WEB_SIMD_COMPARE(>)
RACK_WEB_SIMD_COMPARE(>=)
RACK_WEB_SIMD_COMPARE(==)
RACK_WEB_SIMD_COMPARE(!=)
#undef RACK_WEB_SIMD_COMPARE
using std::fmax;
inline float_4 fmax(const float_4& value, float minimum) {
  float_4 result;
  for (int index = 0; index < 4; index++) result[index] = std::fmax(value[index], minimum);
  return result;
}
inline float_4 fmax(float minimum, const float_4& value) { return fmax(value, minimum); }
inline float_4 fmax(const float_4& left, const float_4& right) {
  float_4 result;
  for (int index = 0; index < 4; index++) result[index] = std::fmax(left[index], right[index]);
  return result;
}
using std::fmin;
inline float_4 fmin(const float_4& left, const float_4& right) { float_4 result; for (int index = 0; index < 4; index++) result[index] = std::fmin(left[index], right[index]); return result; }
inline float_4 fmin(const float_4& value, float maximum) { return fmin(value, float_4(maximum)); }
inline float_4 fmin(float maximum, const float_4& value) { return fmin(value, maximum); }
inline float clamp(float value, float minimum = 0.f, float maximum = 1.f) { return std::clamp(value, minimum, maximum); }
inline float_4 clamp(const float_4& value, const float_4& minimum = float_4(0.f), const float_4& maximum = float_4(1.f)) { return fmin(fmax(value, minimum), maximum); }
using std::fabs;
inline float_4 fabs(const float_4& value) { float_4 result; for (int index = 0; index < 4; index++) result[index] = std::fabs(value[index]); return result; }
using std::fmod;
inline float_4 fmod(const float_4& value, const float_4& divisor) { float_4 result; for (int index = 0; index < 4; index++) result[index] = std::fmod(value[index], divisor[index]); return result; }
using std::sqrt;
inline float_4 sqrt(const float_4& value) { float_4 result; for (int index = 0; index < 4; index++) result[index] = std::sqrt(value[index]); return result; }
using std::pow;
inline float_4 pow(const float_4& base, const float_4& exponent) { float_4 result; for (int index = 0; index < 4; index++) result[index] = std::pow(base[index], exponent[index]); return result; }
inline float_4 pow(float base, const float_4& exponent) { return pow(float_4(base), exponent); }
inline float_4 pow(const float_4& base, float exponent) { return pow(base, float_4(exponent)); }
inline float exp(float value) { return std::exp(value); }
inline float_4 exp(const float_4& value) { float_4 result; for (int index = 0; index < 4; index++) result[index] = std::exp(value[index]); return result; }
inline float log(float value) { return std::log(value); }
inline float_4 log(const float_4& value) { float_4 result; for (int index = 0; index < 4; index++) result[index] = std::log(value[index]); return result; }
inline float log10(float value) { return std::log10(value); }
inline float_4 log10(const float_4& value) { float_4 result; for (int index = 0; index < 4; index++) result[index] = std::log10(value[index]); return result; }
using std::sin;
inline float_4 sin(const float_4& value) { float_4 result; for (int index = 0; index < 4; index++) result[index] = std::sin(value[index]); return result; }
using std::cos;
inline float_4 cos(const float_4& value) { float_4 result; for (int index = 0; index < 4; index++) result[index] = std::cos(value[index]); return result; }
inline float_4 atan2(const float_4& y, const float_4& x) { float_4 result; for (int index = 0; index < 4; index++) result[index] = std::atan2(y[index], x[index]); return result; }
using std::atan;
inline float_4 atan(const float_4& value) { float_4 result; for (int index = 0; index < 4; index++) result[index] = std::atan(value[index]); return result; }
using std::log2;
inline float_4 log2(const float_4& value) { float_4 result; for (int index = 0; index < 4; index++) result[index] = std::log2(value[index]); return result; }
using std::tan;
inline float_4 tan(const float_4& value) { float_4 result; for (int index = 0; index < 4; index++) result[index] = std::tan(value[index]); return result; }
using std::round;
inline float_4 round(const float_4& value) { float_4 result; for (int index = 0; index < 4; index++) result[index] = std::round(value[index]); return result; }
using std::floor;
inline float_4 floor(const float_4& value) { float_4 result; for (int index = 0; index < 4; index++) result[index] = std::floor(value[index]); return result; }
using std::ceil;
inline float_4 ceil(const float_4& value) { float_4 result; for (int index = 0; index < 4; index++) result[index] = std::ceil(value[index]); return result; }
using std::hypot;
inline float_4 hypot(const float_4& left, const float_4& right) { float_4 result; for (int index = 0; index < 4; index++) result[index] = std::hypot(left[index], right[index]); return result; }
inline float rcp(float value) { return 1.f / value; }
inline float_4 rcp(const float_4& value) { return float_4(1.f) / value; }
inline float_4 trunc(const float_4& value) { float_4 result; for (int index = 0; index < 4; index++) result[index] = std::trunc(value[index]); return result; }
inline float_4 ifelse(const float_4& condition, const float_4& whenTrue, const float_4& whenFalse) { float_4 result; for (int index = 0; index < 4; index++) result[index] = condition[index] != 0.f ? whenTrue[index] : whenFalse[index]; return result; }
inline float ifelse(bool condition, float whenTrue, float whenFalse) { return condition ? whenTrue : whenFalse; }
inline float sgn(float value) { return value > 0.f ? 1.f : value < 0.f ? -1.f : 0.f; }
inline float_4 sgn(const float_4& value) { float_4 result; for (int index = 0; index < 4; index++) result[index] = value[index] > 0.f ? 1.f : value[index] < 0.f ? -1.f : 0.f; return result; }
using std::abs;
inline float_4 abs(const float_4& value) { return fabs(value); }
inline float_4 abs(const std::complex<float_4>& value) { return sqrt(value.real() * value.real() + value.imag() * value.imag()); }
using std::arg;
inline float_4 arg(const std::complex<float_4>& value) { float_4 result; for (int index = 0; index < 4; index++) result[index] = std::atan2(value.imag()[index], value.real()[index]); return result; }
inline float crossfade(float first, float second, float mix) { return first + (second - first) * mix; }
inline float_4 crossfade(const float_4& first, const float_4& second, const float_4& mix) { return first + (second - first) * mix; }
inline float_4 crossfade(const float_4& first, const float_4& second, float mix) { return crossfade(first, second, float_4(mix)); }
template <typename Value, typename InputMinimum, typename InputMaximum, typename OutputMinimum, typename OutputMaximum, std::enable_if_t<std::is_arithmetic_v<Value> && std::is_arithmetic_v<InputMinimum> && std::is_arithmetic_v<InputMaximum> && std::is_arithmetic_v<OutputMinimum> && std::is_arithmetic_v<OutputMaximum>, int> = 0>
inline auto rescale(const Value& value, const InputMinimum& inputMinimum, const InputMaximum& inputMaximum, const OutputMinimum& outputMinimum, const OutputMaximum& outputMaximum) {
  using Result = std::common_type_t<Value, InputMinimum, InputMaximum, OutputMinimum, OutputMaximum>;
  return static_cast<Result>(outputMinimum)
    + (static_cast<Result>(value) - static_cast<Result>(inputMinimum))
    / (static_cast<Result>(inputMaximum) - static_cast<Result>(inputMinimum))
    * (static_cast<Result>(outputMaximum) - static_cast<Result>(outputMinimum));
}
inline float_4 rescale(const float_4& value, const float_4& inputMinimum, const float_4& inputMaximum, const float_4& outputMinimum, const float_4& outputMaximum) { return outputMinimum + (value - inputMinimum) / (inputMaximum - inputMinimum) * (outputMaximum - outputMinimum); }
inline int movemask(const float_4& value) {
  int result = 0;
  for (int index = 0; index < 4; index++) if (rackWebFloatBits(value[index]) & 0x80000000u) result |= 1 << index;
  return result;
}
template <typename T>
T movemaskInverse(int value);
template <>
inline float_4 movemaskInverse<float_4>(int value) { float_4 result; for (int index = 0; index < 4; index++) result[index] = rackWebFloatMask(value & (1 << index)); return result; }
} // namespace simd

#ifndef RACK_WEB_OMIT_PULSE_GENERATOR_4
struct PulseGenerator_4 {
  simd::float_4 remaining = simd::float_4::zero();
  void trigger(const simd::float_4& mask, float seconds = 1e-3f) {
    remaining = simd::ifelse(mask, simd::float_4(seconds), remaining);
  }
  simd::float_4 process(float sampleTime) {
    const simd::float_4 active = remaining > 0.f;
    remaining = simd::fmax(remaining - sampleTime, 0.f);
    return active;
  }
};
#endif

#ifndef _MM_SHUFFLE
#define _MM_SHUFFLE(z, y, x, w) (((z) << 6) | ((y) << 4) | ((x) << 2) | (w))
#endif
#ifndef _mm_shuffle_ps
inline simd::float_4 _mm_shuffle_ps(const float* first, const float* second, int order) {
  return {first[order & 3], first[(order >> 2) & 3], second[(order >> 4) & 3], second[(order >> 6) & 3]};
}
#endif
inline simd::float_4 _mm_move_ss(const float* first, const float* second) { return {second[0], first[1], first[2], first[3]}; }
inline simd::float_4 _mm_movehl_ps(const float* first, const float* second) { return {second[2], second[3], first[2], first[3]}; }
inline simd::float_4 _mm_movelh_ps(const float* first, const float* second) { return {first[0], first[1], second[0], second[1]}; }

struct ProcessArgs {
  float sampleRate = 48000.f;
  float sampleTime = 1.f / 48000.f;
  int64_t frame = 0;
};

struct AddEvent {};
struct RemoveEvent {};
struct RandomizeEvent {};
struct ResetEvent {};
struct SampleRateChangeEvent {
  float sampleRate = 48000.f;
  float sampleTime = 1.f / 48000.f;
};

struct NVGcolor {
  union {
    struct { float r; float g; float b; float a; };
    float rgba[4];
  };
  constexpr NVGcolor() : r(0.f), g(0.f), b(0.f), a(1.f) {}
  constexpr NVGcolor(float red, float green, float blue, float alpha)
      : r(red), g(green), b(blue), a(alpha) {}
};
enum NVGlineCap {
  NVG_BUTT,
  NVG_ROUND,
  NVG_SQUARE,
  NVG_BEVEL,
  NVG_MITER,
};
inline NVGcolor nvgRGBAf(float red, float green, float blue, float alpha) { return {red, green, blue, alpha}; }
inline NVGcolor nvgRGBf(float red, float green, float blue) { return {red, green, blue, 1.f}; }
inline NVGcolor nvgRGBA(unsigned char red, unsigned char green, unsigned char blue, unsigned char alpha) { return {red / 255.f, green / 255.f, blue / 255.f, alpha / 255.f}; }
inline NVGcolor nvgRGB(unsigned char red, unsigned char green, unsigned char blue) { return nvgRGBA(red, green, blue, 255); }
inline NVGcolor nvgHSL(float hue, float saturation, float lightness) {
  hue -= std::floor(hue);
  const auto channel = [&](float offset) {
    const float key = std::fmod(offset + hue * 12.f, 12.f);
    const float chroma = saturation * std::min(lightness, 1.f - lightness);
    return lightness - chroma * std::max(-1.f, std::min({key - 3.f, 9.f - key, 1.f}));
  };
  return {channel(0.f), channel(8.f), channel(4.f), 1.f};
}

namespace componentlibrary {
inline const NVGcolor SCHEME_BLACK_TRANSPARENT = nvgRGBA(0x00, 0x00, 0x00, 0x00);
inline const NVGcolor SCHEME_BLACK = nvgRGB(0x00, 0x00, 0x00);
inline const NVGcolor SCHEME_WHITE = nvgRGB(0xff, 0xff, 0xff);
inline const NVGcolor SCHEME_RED = nvgRGB(0xed, 0x2c, 0x24);
inline const NVGcolor SCHEME_ORANGE = nvgRGB(0xf2, 0xb1, 0x20);
inline const NVGcolor SCHEME_YELLOW = nvgRGB(0xff, 0xd7, 0x14);
inline const NVGcolor SCHEME_GREEN = nvgRGB(0x90, 0xc7, 0x3e);
inline const NVGcolor SCHEME_CYAN = nvgRGB(0x22, 0xe6, 0xef);
inline const NVGcolor SCHEME_BLUE = nvgRGB(0x29, 0xb2, 0xef);
inline const NVGcolor SCHEME_PURPLE = nvgRGB(0xd5, 0x2b, 0xed);
inline const NVGcolor SCHEME_LIGHT_GRAY = nvgRGB(0xe6, 0xe6, 0xe6);
inline const NVGcolor SCHEME_DARK_GRAY = nvgRGB(0x17, 0x17, 0x17);
} // namespace componentlibrary
using namespace componentlibrary;

namespace color {
inline const NVGcolor BLACK_TRANSPARENT = componentlibrary::SCHEME_BLACK_TRANSPARENT;
inline const NVGcolor BLACK = componentlibrary::SCHEME_BLACK;
inline NVGcolor fromHexString(const std::string& value) {
  unsigned int red = 0, green = 0, blue = 0, alpha = 255;
  const int parsed = std::sscanf(value.c_str(), "#%2x%2x%2x%2x", &red, &green, &blue, &alpha);
  if (parsed < 3) return {};
  return nvgRGBA(static_cast<unsigned char>(red), static_cast<unsigned char>(green), static_cast<unsigned char>(blue), static_cast<unsigned char>(alpha));
}
inline std::string toHexString(NVGcolor value) {
  const auto component = [](float channel) { return static_cast<unsigned int>(std::round(std::clamp(channel, 0.f, 1.f) * 255.f)); };
  const unsigned int red = component(value.r), green = component(value.g), blue = component(value.b), alpha = component(value.a);
  char buffer[10]{};
  if (alpha == 255) std::snprintf(buffer, sizeof(buffer), "#%02x%02x%02x", red, green, blue);
  else std::snprintf(buffer, sizeof(buffer), "#%02x%02x%02x%02x", red, green, blue, alpha);
  return buffer;
}
} // namespace color

struct Module;
namespace midi { void rackWebPushToInputs(int size, int status, int data1, int data2, int64_t frame); }
namespace engine {
struct ParamHandle {
  int64_t moduleId = -1;
  int paramId = 0;
  ::rack::Module* module = nullptr;
  std::string text;
  NVGcolor color;
};

struct Engine {
  float sampleRate = 48000.f;
  int64_t frame = 0;
  ::rack::Module* rackWebModule = nullptr;
  std::set<ParamHandle*> paramHandles;
  float getSampleRate() const { return sampleRate; }
  float getSampleTime() const { return 1.f / sampleRate; }
  int64_t getFrame() const { return frame; }
  void setParamValue(::rack::Module* module, int paramId, float value);
  float getParamValue(::rack::Module* module, int paramId);
  void setParamSmoothValue(::rack::Module* module, int paramId, float value) { setParamValue(module, paramId, value); }
  float getParamSmoothValue(::rack::Module* module, int paramId) { return getParamValue(module, paramId); }
  void addParamHandle(ParamHandle* paramHandle);
  void removeParamHandle(ParamHandle* paramHandle);
  ParamHandle* getParamHandle(int64_t moduleId, int paramId);
  ParamHandle* getParamHandle(::rack::Module* module, int paramId);
  void updateParamHandle(ParamHandle* paramHandle, int64_t moduleId, int paramId, bool overwrite = true);
  std::vector<int64_t> getModuleIds() const { return {}; }
  ::rack::Module* getModule(int64_t) const { return nullptr; }
  void rackWebAttachModule(::rack::Module* module);
  void yieldWorkers() {}
};
}
using ParamHandle = engine::ParamHandle;
extern "C" int rack_web_host_clipboard_size()
    __attribute__((import_module("env"), import_name("rack_web_host_clipboard_size")));
extern "C" int rack_web_host_get_clipboard(char* destination, int capacity)
    __attribute__((import_module("env"), import_name("rack_web_host_get_clipboard")));
extern "C" void rack_web_host_set_clipboard(const char* source, int length)
    __attribute__((import_module("env"), import_name("rack_web_host_set_clipboard")));
extern "C" float rack_web_host_shared_get(int index)
    __attribute__((import_module("env"), import_name("rack_web_host_shared_get")));
extern "C" void rack_web_host_shared_set(int index, float value)
    __attribute__((import_module("env"), import_name("rack_web_host_shared_set")));
extern "C" void rack_web_host_shared_touch(int index)
    __attribute__((import_module("env"), import_name("rack_web_host_shared_touch")));
extern "C" int rack_web_host_shared_active(int index)
    __attribute__((import_module("env"), import_name("rack_web_host_shared_active")));
extern "C" int rack_web_host_shared_count(int index)
    __attribute__((import_module("env"), import_name("rack_web_host_shared_count")));

struct RackWebWindow {
  void* win = nullptr;
  int mods = 0;
  int getMods() const { return mods; }
};
namespace history {
struct Action {
  std::string name;
  virtual ~Action() = default;
  virtual void undo() {}
  virtual void redo() {}
};
struct ModuleAction : Action {
  int64_t moduleId = -1;
};
struct ParamChange : ModuleAction {
  int paramId = -1;
  float oldValue = 0.f;
  float newValue = 0.f;
};
struct History {
  template <typename T>
  void push(T* action) {
    // Browser modules preserve their state directly; desktop undo records do
    // not cross the WASM boundary, so release them after the source action.
    delete action;
  }
};
}
struct AppGlobal {
  engine::Engine* engine = nullptr;
  RackWebWindow* window = nullptr;
  history::History* history = nullptr;
};
inline engine::Engine rackWebEngine;
inline RackWebWindow rackWebWindow;
inline history::History rackWebHistory;
inline AppGlobal rackWebApp{&rackWebEngine, &rackWebWindow, &rackWebHistory};
inline AppGlobal* APP = &rackWebApp;
inline constexpr const char* APP_VERSION = "2.6.6";
inline constexpr int GLFW_RELEASE = 0;
inline constexpr int GLFW_PRESS = 1;
inline constexpr int GLFW_REPEAT = 2;
inline constexpr int GLFW_KEY_UNKNOWN = -1;
inline constexpr int GLFW_KEY_SPACE = 32;
inline constexpr int GLFW_KEY_APOSTROPHE = 39;
inline constexpr int GLFW_KEY_COMMA = 44;
inline constexpr int GLFW_KEY_MINUS = 45;
inline constexpr int GLFW_KEY_PERIOD = 46;
inline constexpr int GLFW_KEY_SLASH = 47;
inline constexpr int GLFW_KEY_0 = 48;
inline constexpr int GLFW_KEY_1 = 49;
inline constexpr int GLFW_KEY_2 = 50;
inline constexpr int GLFW_KEY_3 = 51;
inline constexpr int GLFW_KEY_4 = 52;
inline constexpr int GLFW_KEY_5 = 53;
inline constexpr int GLFW_KEY_6 = 54;
inline constexpr int GLFW_KEY_7 = 55;
inline constexpr int GLFW_KEY_8 = 56;
inline constexpr int GLFW_KEY_9 = 57;
inline constexpr int GLFW_KEY_SEMICOLON = 59;
inline constexpr int GLFW_KEY_EQUAL = 61;
inline constexpr int GLFW_KEY_A = 65;
inline constexpr int GLFW_KEY_B = 66;
inline constexpr int GLFW_KEY_C = 67;
inline constexpr int GLFW_KEY_D = 68;
inline constexpr int GLFW_KEY_E = 69;
inline constexpr int GLFW_KEY_F = 70;
inline constexpr int GLFW_KEY_G = 71;
inline constexpr int GLFW_KEY_H = 72;
inline constexpr int GLFW_KEY_I = 73;
inline constexpr int GLFW_KEY_J = 74;
inline constexpr int GLFW_KEY_K = 75;
inline constexpr int GLFW_KEY_L = 76;
inline constexpr int GLFW_KEY_M = 77;
inline constexpr int GLFW_KEY_N = 78;
inline constexpr int GLFW_KEY_O = 79;
inline constexpr int GLFW_KEY_P = 80;
inline constexpr int GLFW_KEY_Q = 81;
inline constexpr int GLFW_KEY_R = 82;
inline constexpr int GLFW_KEY_S = 83;
inline constexpr int GLFW_KEY_T = 84;
inline constexpr int GLFW_KEY_U = 85;
inline constexpr int GLFW_KEY_V = 86;
inline constexpr int GLFW_KEY_W = 87;
inline constexpr int GLFW_KEY_X = 88;
inline constexpr int GLFW_KEY_Y = 89;
inline constexpr int GLFW_KEY_Z = 90;
inline constexpr int GLFW_KEY_LEFT_BRACKET = 91;
inline constexpr int GLFW_KEY_BACKSLASH = 92;
inline constexpr int GLFW_KEY_RIGHT_BRACKET = 93;
inline constexpr int GLFW_KEY_GRAVE_ACCENT = 96;
inline constexpr int GLFW_KEY_WORLD_1 = 161;
inline constexpr int GLFW_KEY_WORLD_2 = 162;
inline constexpr int GLFW_KEY_ESCAPE = 256;
inline constexpr int GLFW_KEY_ENTER = 257;
inline constexpr int GLFW_KEY_TAB = 258;
inline constexpr int GLFW_KEY_BACKSPACE = 259;
inline constexpr int GLFW_KEY_INSERT = 260;
inline constexpr int GLFW_KEY_DELETE = 261;
inline constexpr int GLFW_KEY_RIGHT = 262;
inline constexpr int GLFW_KEY_LEFT = 263;
inline constexpr int GLFW_KEY_DOWN = 264;
inline constexpr int GLFW_KEY_UP = 265;
inline constexpr int GLFW_KEY_PAGE_UP = 266;
inline constexpr int GLFW_KEY_PAGE_DOWN = 267;
inline constexpr int GLFW_KEY_HOME = 268;
inline constexpr int GLFW_KEY_END = 269;
inline constexpr int GLFW_KEY_PRINT_SCREEN = 283;
inline constexpr int GLFW_KEY_PAUSE = 284;
inline constexpr int GLFW_KEY_F1 = 290;
inline constexpr int GLFW_KEY_F2 = 291;
inline constexpr int GLFW_KEY_F3 = 292;
inline constexpr int GLFW_KEY_F4 = 293;
inline constexpr int GLFW_KEY_F5 = 294;
inline constexpr int GLFW_KEY_F6 = 295;
inline constexpr int GLFW_KEY_F7 = 296;
inline constexpr int GLFW_KEY_F8 = 297;
inline constexpr int GLFW_KEY_F9 = 298;
inline constexpr int GLFW_KEY_F10 = 299;
inline constexpr int GLFW_KEY_F11 = 300;
inline constexpr int GLFW_KEY_F12 = 301;
inline constexpr int GLFW_KEY_F13 = 302;
inline constexpr int GLFW_KEY_F14 = 303;
inline constexpr int GLFW_KEY_F15 = 304;
inline constexpr int GLFW_KEY_LEFT_SHIFT = 340;
inline constexpr int GLFW_KEY_LEFT_CONTROL = 341;
inline constexpr int GLFW_KEY_LEFT_ALT = 342;
inline constexpr int GLFW_KEY_LEFT_SUPER = 343;
inline constexpr int GLFW_KEY_RIGHT_SHIFT = 344;
inline constexpr int GLFW_KEY_RIGHT_CONTROL = 345;
inline constexpr int GLFW_KEY_RIGHT_ALT = 346;
inline constexpr int GLFW_KEY_RIGHT_SUPER = 347;
inline constexpr int GLFW_KEY_F16 = 305;
inline constexpr int GLFW_KEY_F17 = 306;
inline constexpr int GLFW_KEY_F18 = 307;
inline constexpr int GLFW_KEY_F19 = 308;
inline constexpr int GLFW_KEY_F20 = 309;
inline constexpr int GLFW_KEY_F21 = 310;
inline constexpr int GLFW_KEY_F22 = 311;
inline constexpr int GLFW_KEY_F23 = 312;
inline constexpr int GLFW_KEY_F24 = 313;
inline constexpr int GLFW_KEY_F25 = 314;
inline constexpr int GLFW_KEY_KP_0 = 320;
inline constexpr int GLFW_KEY_KP_1 = 321;
inline constexpr int GLFW_KEY_KP_2 = 322;
inline constexpr int GLFW_KEY_KP_3 = 323;
inline constexpr int GLFW_KEY_KP_4 = 324;
inline constexpr int GLFW_KEY_KP_5 = 325;
inline constexpr int GLFW_KEY_KP_6 = 326;
inline constexpr int GLFW_KEY_KP_7 = 327;
inline constexpr int GLFW_KEY_KP_8 = 328;
inline constexpr int GLFW_KEY_KP_9 = 329;
inline constexpr int GLFW_KEY_KP_DECIMAL = 330;
inline constexpr int GLFW_KEY_KP_DIVIDE = 331;
inline constexpr int GLFW_KEY_KP_MULTIPLY = 332;
inline constexpr int GLFW_KEY_KP_SUBTRACT = 333;
inline constexpr int GLFW_KEY_KP_ADD = 334;
inline constexpr int GLFW_KEY_KP_ENTER = 335;
inline constexpr int GLFW_KEY_KP_EQUAL = 336;
inline const char* glfwGetKeyName(int, int) { return nullptr; }
inline void glfwSetClipboardString(void*, const char* text) {
  if (!text) return;
  rack_web_host_set_clipboard(text, static_cast<int>(std::strlen(text)));
}
inline const char* glfwGetClipboardString(void*) {
  static std::string clipboard;
  const int length = std::max(0, rack_web_host_clipboard_size());
  clipboard.assign(static_cast<size_t>(length), '\0');
  if (length > 0) rack_web_host_get_clipboard(clipboard.data(), length);
  return clipboard.c_str();
}
inline constexpr int GLFW_MOD_SHIFT = 0x0001;
inline constexpr int GLFW_MOD_CONTROL = 0x0002;
inline constexpr int GLFW_MOD_ALT = 0x0004;
inline constexpr int GLFW_MOD_SUPER = 0x0008;
inline constexpr int RACK_MOD_MASK = GLFW_MOD_SHIFT | GLFW_MOD_CONTROL | GLFW_MOD_ALT | GLFW_MOD_SUPER;
inline constexpr int RACK_MOD_CTRL = GLFW_MOD_CONTROL | GLFW_MOD_SUPER;
inline int keyFix(int key) { return key; }
struct RackWebPluginSettings { int panelThemeDefault = 0; };
inline RackWebPluginSettings pluginSettings;
namespace settings {
inline bool isPlugin = true;
inline bool preferDarkPanels = false;
inline float rackBrightness = 1.f;
inline float haloBrightness = 1.f;
inline float sampleRate = 48000.f;
inline std::vector<NVGcolor> cableColors = {
  nvgRGB(0xc9, 0x18, 0x47),
  nvgRGB(0xdd, 0x6c, 0x00),
  nvgRGB(0xc9, 0xb7, 0x0e),
  nvgRGB(0x0c, 0x8e, 0x15),
  nvgRGB(0x09, 0x86, 0xad),
  nvgRGB(0x8a, 0x2b, 0xe2),
  nvgRGB(0xf5, 0xa9, 0xe0),
};
struct PluginWhitelist {
  bool subscribed = false;
  std::set<std::string> moduleSlugs;
};
inline std::map<std::string, PluginWhitelist> moduleWhitelist;
}
struct Exception : std::exception {
  std::string msg;
  Exception(const std::string& message) : msg(message) {}
  Exception(const char* format, ...) {
    if (!format) return;
    char buffer[2048]{};
    va_list args;
    va_start(args, format);
    std::vsnprintf(buffer, sizeof(buffer), format, args);
    va_end(args);
    msg = buffer;
  }
  const char* what() const noexcept override { return msg.c_str(); }
};

// Browser-safe defaults for plugin settings that are normally populated by a
// native Rack settings file or a plugin UI menu.
inline bool loadDarkAsDefault() { return false; }
struct RackWebDefaultThemeValue {
  template <typename T, std::enable_if_t<std::is_enum_v<T> || std::is_integral_v<T>, int> = 0>
  operator T() const { return static_cast<T>(0); }
};
inline RackWebDefaultThemeValue loadDefaultTheme() { return {}; }
inline int loadQuality() { return 1; }
inline int loadConsoleType() { return 0; }
inline int loadDirectOutMode() { return 0; }
// Lunetta Modula's shared mode enum is declared in a UI-adjacent header that
// is intentionally stripped from isolated DSP adapters. Preserve its stable
// numeric contract for the module engine.
inline constexpr int VCVRACK_STANDARD = 0;
inline constexpr int CMOS_NON_SCHMITT = 1;
inline constexpr int CMOS_SCHMITT = 2;
inline constexpr int CD40106_SCHMITT = 3;

struct Param {
  float value = 0.f;
  float getValue() const { return value; }
  void setValue(float next) { value = next; }
};
namespace engine {
using Param = ::rack::Param;
}

struct Light {
  union { float brightness; float value; };
  Light() : brightness(0.f) {}
  void setBrightness(float next) { brightness = std::clamp(next, 0.f, 1.f); }
  void setSmoothBrightness(float next, float) { setBrightness(next); }
  void setBrightnessSmooth(float next) { setBrightness(next); }
  void setBrightnessSmooth(float next, float deltaTime) { setSmoothBrightness(next, deltaTime); }
  void setBrightnessSmooth(float next, float, float) { setBrightness(next); }
  float getBrightness() const { return brightness; }
};
namespace engine { using Light = ::rack::Light; }

// Rack's engine inputs and outputs share an engine::Port base. Keeping that
// inheritance matters for plugins that wrap either side behind a Port pointer.
struct Port {
  enum Type {
    INPUT,
    OUTPUT,
  };
  union { float voltages[16]; float value; };
  int channels = 0;
  union { bool connected; bool active; };
  Light plugLights[3];
  Port() : voltages{}, connected(false) {}
  float getVoltage(int channel = 0) const { return channel >= 0 && channel < 16 ? voltages[channel] : 0.f; }
  float getPolyVoltage(int channel = 0) const { return channels == 1 ? voltages[0] : getVoltage(channel); }
  template <typename T>
  T getVoltageSimd(int firstChannel = 0) const { T result{}; for (int lane = 0; lane < 4; lane++) result[lane] = getVoltage(firstChannel + lane); return result; }
  template <typename T>
  void setVoltageSimd(const T& next, int firstChannel = 0) { for (int lane = 0; lane < 4; lane++) setVoltage(next[lane], firstChannel + lane); }
  float* getVoltages() { return voltages; }
  const float* getVoltages() const { return voltages; }
  float* getVoltages(int firstChannel) { return voltages + std::clamp(firstChannel, 0, 15); }
  const float* getVoltages(int firstChannel) const { return voltages + std::clamp(firstChannel, 0, 15); }
  float getVoltageSum() const { float sum = 0.f; for (int channel = 0; channel < channels; channel++) sum += voltages[channel]; return sum; }
  bool isConnected() const { return connected; }
  int getChannels() const { return channels; }
  void setChannels(int next) { next = next < 0 ? 0 : (next > 16 ? 16 : next); for (int channel = next; channel < channels; channel++) voltages[channel] = 0.f; channels = next; }
  void setVoltage(float next, int channel = 0) { if (channel >= 0 && channel < 16) voltages[channel] = next; }
  void clearVoltages() { for (float& voltage : voltages) voltage = 0.f; }
};

struct Input : Port {
  Input() { channels = 0; }
  float normalize(float normal) const { return connected ? getVoltage() : normal; }
  float getNormalVoltage(float normal, int channel = 0) const { return connected ? getVoltage(channel) : normal; }
  float getNormalPolyVoltage(float normal, int channel) const { return connected ? getPolyVoltage(channel) : normal; }
  template <typename T>
  T getPolyVoltageSimd(int firstChannel = 0) const { T result{}; for (int lane = 0; lane < 4; lane++) result[lane] = getPolyVoltage(firstChannel + lane); return result; }
  template <typename T>
  T getNormalVoltageSimd(const T& normal, int firstChannel = 0) const { return connected ? getVoltageSimd<T>(firstChannel) : normal; }
  template <typename T>
  T getNormalPolyVoltageSimd(float normal, int firstChannel = 0) const {
    if (!connected) return T(normal);
    T result{};
    for (int lane = 0; lane < 4; lane++) result[lane] = getPolyVoltage(firstChannel + lane);
    return result;
  }
  template <typename T>
  T getNormalPolyVoltageSimd(const T& normal, int firstChannel = 0) const {
    if (!connected) return normal;
    T result{};
    for (int lane = 0; lane < 4; lane++) result[lane] = getPolyVoltage(firstChannel + lane);
    return result;
  }
  void readVoltages(float* target) const { for (int channel = 0; channel < 16; channel++) target[channel] = getVoltage(channel); }
  bool isMonophonic() const { return channels == 1; }
  bool isPolyphonic() const { return channels > 1; }
};

struct Output : Port {
  Output() { channels = 1; }
  void writeVoltages(const float* source) { for (int channel = 0; channel < channels; channel++) voltages[channel] = source[channel]; }
};

namespace engine {
using Input = ::rack::Input;
using Output = ::rack::Output;
using Port = ::rack::Port;
inline constexpr int PORT_MAX_CHANNELS = ::rack::PORT_MAX_CHANNELS;
}

struct Module;

struct Quantity {
  virtual ~Quantity() = default;
  virtual void setValue(float) {}
  virtual float getValue() { return 0.f; }
  virtual float getMinValue() { return 0.f; }
  virtual float getMinValue() const { return 0.f; }
  virtual float getMaxValue() { return 1.f; }
  virtual float getMaxValue() const { return 1.f; }
  virtual float getDefaultValue() { return 0.f; }
  virtual float getDisplayValue() { return getValue(); }
  virtual void setDisplayValue(float value) { setValue(value); }
  virtual int getDisplayPrecision() { return 5; }
  virtual std::string getDisplayValueString() { return std::to_string(getDisplayValue()); }
  virtual void setDisplayValueString(std::string value) { setDisplayValue(std::strtof(value.c_str(), nullptr)); }
  virtual std::string getLabel() { return ""; }
  virtual std::string getDescription() { return ""; }
  virtual std::string getUnit() { return ""; }
  virtual std::string getString() { return getDisplayValueString() + getUnit(); }
  virtual void reset() { setValue(getDefaultValue()); }
  virtual void randomize() {}
  bool isMin() { return getValue() <= getMinValue(); }
  bool isMax() { return getValue() >= getMaxValue(); }
  void setMin() { setValue(getMinValue()); }
  void setMax() { setValue(getMaxValue()); }
  void toggle() { isMin() ? setMax() : setMin(); }
  void moveValue(float delta) { setValue(getValue() + delta); }
  float getRange() { return getMaxValue() - getMinValue(); }
  bool isBounded() { return std::isfinite(getMinValue()) && std::isfinite(getMaxValue()); }
  float toScaled(float value) { return (value - getMinValue()) / getRange(); }
  float fromScaled(float value) { return getMinValue() + value * getRange(); }
  void setScaledValue(float value) { setValue(fromScaled(value)); }
  float getScaledValue() { return toScaled(getValue()); }
  void moveScaledValue(float delta) { setScaledValue(getScaledValue() + delta); }
};

struct ParamQuantity : Quantity {
  Module* module = nullptr;
  int paramId = -1;
  bool randomizeEnabled = true;
  bool resetEnabled = true;
  bool snapEnabled = false;
  bool smoothEnabled = true;
  std::string name;
  std::string description;
  std::string unit;
  float displayBase = 0.f;
  float displayMultiplier = 1.f;
  float displayOffset = 0.f;
  int displayPrecision = 5;
  float minValue = 0.f;
  float maxValue = 1.f;
  float defaultValue = 0.f;
  float value = 0.f;
  std::string getLabel() override { return name; }
  float getDisplayValue() override {
    const float raw = getValue();
    const float transformed = displayBase == 0.f ? raw : displayBase > 0.f ? std::pow(displayBase, raw) : std::log(raw) / std::log(-displayBase);
    return transformed * displayMultiplier + displayOffset;
  }
  std::string getDisplayValueString() override { return std::to_string(getDisplayValue()); }
  int getDisplayPrecision() override { return displayPrecision; }
  std::string getUnit() override { return unit; }
  void setDisplayValueString(std::string next) override { setDisplayValue(std::strtof(next.c_str(), nullptr)); }
  void setDisplayValue(float next) override {
    const float transformed = (next - displayOffset) / displayMultiplier;
    setValue(displayBase == 0.f ? transformed : displayBase > 0.f ? std::log(transformed) / std::log(displayBase) : std::pow(-displayBase, transformed));
  }
  float getValue() override { return value; }
  float getImmediateValue() { return getValue(); }
  Param* getParam();
  const Param* getParam() const;
  void setImmediateValue(float next) { setValue(next); }
  void setSmoothValue(float next) { setValue(next); }
  float getSmoothValue() { return getValue(); }
  void setValue(float next) override;
  void randomize() override {}
  float getMinValue() override { return minValue; }
  float getMinValue() const override { return minValue; }
  float getMaxValue() override { return maxValue; }
  float getMaxValue() const override { return maxValue; }
  float getDefaultValue() override { return defaultValue; }
  void reset() override { if (resetEnabled) setValue(defaultValue); }
};
namespace engine { using ParamQuantity = ::rack::ParamQuantity; }
inline void setImmediateValue(ParamQuantity* quantity, float value) {
  if (quantity) quantity->setImmediateValue(value);
}

struct SwitchQuantity : ParamQuantity {
  std::vector<std::string> labels;
  std::string getLabel() override {
    const int index = static_cast<int>(std::round(value - minValue));
    return index >= 0 && index < static_cast<int>(labels.size()) ? labels[index] : std::string();
  }
};
namespace engine { using SwitchQuantity = ::rack::SwitchQuantity; }

struct PortInfo { std::string name; std::string description; };
using InputInfo = PortInfo;
using OutputInfo = PortInfo;
struct LightInfo { std::string description; };

template <typename T, size_t Capacity>
struct RackWebStaticVector : std::vector<T> {
  RackWebStaticVector() : std::vector<T>(Capacity) {}
};

struct Module {
  // Large visual expanders such as Leviathan TD.Scope use Rack messages just
  // over 24 KiB (two 3072-bin stereo envelopes). Keep the transport lossless.
  static constexpr int rackWebMessageCapacity = 32768;
  using ProcessArgs = ::rack::ProcessArgs;
  using AddEvent = ::rack::AddEvent;
  using RemoveEvent = ::rack::RemoveEvent;
  using RandomizeEvent = ::rack::RandomizeEvent;
  using ResetEvent = ::rack::ResetEvent;
  using SampleRateChangeEvent = ::rack::SampleRateChangeEvent;
  struct SaveEvent {};
  struct BypassEvent {};
  struct UnBypassEvent {};
  struct ExpanderChangeEvent { uint8_t side = 0; };
  struct PortChangeEvent {
    bool connecting = false;
    Port::Type type = Port::INPUT;
    int portId = -1;
  };
  struct BypassRoute {
    int inputId = -1;
    int outputId = -1;
  };
  struct Expander {
    int64_t moduleId = -1;
    Module* module = nullptr;
    void* producerMessage = nullptr;
    void* consumerMessage = nullptr;
    bool messageFlipRequested = false;
    void requestMessageFlip() { messageFlipRequested = true; }
  };

  plugin::Model* model = nullptr;
  int64_t id = -1;
  Expander leftExpander;
  Expander rightExpander;
  static constexpr int rackWebMaxParams = 1024;
  static constexpr int rackWebMaxPorts = 256;
  static constexpr int rackWebMaxLights = 512;
  Module* rackWebNeighborModules[2]{};
  Module* rackWebNeighborChainModules[2][16]{};
  alignas(16) uint8_t rackWebOwnMessages[2][2][rackWebMessageCapacity]{};
  alignas(16) uint8_t rackWebNeighborMessages[2][2][rackWebMessageCapacity]{};
  std::vector<BypassRoute> bypassRoutes;
  RackWebStaticVector<Param, rackWebMaxParams> params;
  RackWebStaticVector<Input, rackWebMaxPorts> inputs;
  RackWebStaticVector<Output, rackWebMaxPorts> outputs;
  RackWebStaticVector<Light, rackWebMaxLights> lights;
  ParamQuantity quantities[rackWebMaxParams]{};
  std::array<ParamQuantity*, rackWebMaxParams> paramQuantities{};
  InputInfo inputInfoStorage[rackWebMaxPorts]{};
  std::array<InputInfo*, rackWebMaxPorts> inputInfos{};
  OutputInfo outputInfoStorage[rackWebMaxPorts]{};
  std::array<OutputInfo*, rackWebMaxPorts> outputInfos{};
  LightInfo lightInfoStorage[rackWebMaxLights]{};
  LightInfo* lightInfos[rackWebMaxLights]{};
  int polyphony = 1;
  int configuredParams = 0;
  int configuredInputs = 0;
  int configuredOutputs = 0;
  int configuredLights = 0;
  // Rack 1 exposed this state as `bypass`; Rack 2 renamed it to `bypassed`.
  // Keep both source spellings on the same byte so legacy modules observe the
  // browser host's current bypass state without source rewriting.
  union {
    bool bypassed = false;
    bool bypass;
  };
  std::vector<uint8_t> rackWebStateJson;
  // Short MIDI messages cross the browser/real-time boundary as compact
  // four-byte records: [size, status, data1, data2]. Variable-length messages
  // (notably SysEx) use a second byte stream framed as [u16 length, payload].
  static constexpr int rackWebMidiCapacity = 1024;
  uint8_t rackWebMidiOutput[rackWebMidiCapacity * 4]{};
  int rackWebMidiOutputCount = 0;
  static constexpr int rackWebMidiPacketCapacity = 64 * 1024;
  uint8_t rackWebMidiPacketOutput[rackWebMidiPacketCapacity]{};
  int rackWebMidiPacketOutputBytes = 0;

  Module() {
    for (int index = 0; index < rackWebMaxParams; index++) { quantities[index].module = this; paramQuantities[index] = &quantities[index]; }
    for (int index = 0; index < rackWebMaxPorts; index++) { inputInfos[index] = &inputInfoStorage[index]; outputInfos[index] = &outputInfoStorage[index]; }
    for (int index = 0; index < rackWebMaxLights; index++) lightInfos[index] = &lightInfoStorage[index];
  }
  int64_t getId() const { return id; }
  virtual ~Module() { for (int index = 0; index < rackWebMaxParams; index++) if (paramQuantities[index] != &quantities[index]) delete paramQuantities[index]; }
  virtual void onAdd() {}
  virtual void onAdd(const AddEvent&) { onAdd(); }
  virtual void onRemove() {}
  virtual void onRemove(const RemoveEvent&) { onRemove(); }
  virtual void onExpanderChange(const ExpanderChangeEvent&) {}
  virtual void onPortChange(const PortChangeEvent&) {}
  virtual void onReset() {}
  virtual void onReset(const ResetEvent&) { onReset(); }
  virtual void onSampleRateChange() {}
  virtual void onSampleRateChange(const SampleRateChangeEvent&) { onSampleRateChange(); }
  virtual void onRandomize() {}
  virtual void onRandomize(const RandomizeEvent&) { onRandomize(); }
  virtual void onSave(const SaveEvent&) {}
  virtual void onBypass(const BypassEvent&) {}
  virtual void onUnBypass(const UnBypassEvent&) {}
  virtual json_t* toJson() { return dataToJson(); }
  virtual void fromJson(json_t* root) { dataFromJson(root); }
  virtual void paramsFromJson(json_t*) {}
  virtual void step() {}
  virtual void process(const ProcessArgs&) { step(); }
  virtual void processBypass(const ProcessArgs&) {}
  virtual json_t* dataToJson() { return json_object(); }
  virtual void dataFromJson(json_t*) {}
  virtual void setState(int, float) {}
  uint8_t* rackWebStateBuffer(int bytes) {
    if (bytes < 0 || bytes > 4 * 1024 * 1024) return nullptr;
    rackWebStateJson.resize(static_cast<size_t>(bytes) + 1);
    return rackWebStateJson.data();
  }
  int rackWebCommitStateJson(int bytes) {
    if (bytes < 0 || static_cast<size_t>(bytes) >= rackWebStateJson.size()) return 0;
    rackWebStateJson[bytes] = 0;
    json_t* root = rack_web_parse_json(reinterpret_cast<const char*>(rackWebStateJson.data()), static_cast<size_t>(bytes));
    if (!json_is_object(root)) { json_decref(root); return 0; }
    fromJson(root);
    json_decref(root);
    return 1;
  }
  int rackWebSnapshotStateJson() {
    json_t* root = toJson();
    if (!json_is_object(root)) { json_decref(root); return 0; }
    std::string output;
    rack_web_dump_json(root, output);
    json_decref(root);
    if (output.size() > 4 * 1024 * 1024) return 0;
    rackWebStateJson.assign(output.begin(), output.end());
    return static_cast<int>(rackWebStateJson.size());
  }
  uint8_t* rackWebSnapshotStateBuffer() { return rackWebStateJson.empty() ? nullptr : rackWebStateJson.data(); }
  virtual void rackWebTriggerAction(int, bool) {}
  virtual void rackWebSetParam(int id, float value) {
    if (id < 0 || id >= rackWebMaxParams) return;
    if (auto* quantity = getParamQuantity(id)) {
      quantity->setValue(value);
      params[id].setValue(quantity->getValue());
    }
    else params[id].setValue(value);
  }
  virtual void rackWebResetParam(int id, float value) {
    rackWebSetParam(id, value);
  }
  virtual void rackWebPushMidi(int size, int status, int data1, int data2) { midi::rackWebPushToInputs(size, status, data1, data2, APP && APP->engine ? APP->engine->getFrame() : -1); }
  void rackWebEmitMidi(int size, int status, int data1 = 0, int data2 = 0) {
    if (rackWebMidiOutputCount >= rackWebMidiCapacity) return;
    uint8_t* record = rackWebMidiOutput + rackWebMidiOutputCount++ * 4;
    record[0] = static_cast<uint8_t>(std::clamp(size, 1, 3));
    record[1] = static_cast<uint8_t>(status & 0xff);
    record[2] = static_cast<uint8_t>(data1 & 0x7f);
    record[3] = static_cast<uint8_t>(data2 & 0x7f);
  }
  void rackWebEmitMidiBytes(const uint8_t* bytes, int size) {
    if (!bytes || size <= 0) return;
    if (size <= 3) {
      rackWebEmitMidi(size, bytes[0], size > 1 ? bytes[1] : 0, size > 2 ? bytes[2] : 0);
      return;
    }
    const int boundedSize = std::min(size, 0xffff);
    const int framedSize = boundedSize + 2;
    if (rackWebMidiPacketOutputBytes + framedSize > rackWebMidiPacketCapacity) return;
    uint8_t* packet = rackWebMidiPacketOutput + rackWebMidiPacketOutputBytes;
    packet[0] = static_cast<uint8_t>(boundedSize & 0xff);
    packet[1] = static_cast<uint8_t>((boundedSize >> 8) & 0xff);
    std::memcpy(packet + 2, bytes, static_cast<size_t>(boundedSize));
    rackWebMidiPacketOutputBytes += framedSize;
  }
  int rackWebMidiOutputAvailable() const { return rackWebMidiOutputCount; }
  uint8_t* rackWebMidiOutputBuffer() { return rackWebMidiOutput; }
  void rackWebConsumeMidiOutput(int count) {
    count = std::clamp(count, 0, rackWebMidiOutputCount);
    const int remaining = rackWebMidiOutputCount - count;
    if (remaining > 0)
      std::memmove(rackWebMidiOutput, rackWebMidiOutput + count * 4, static_cast<size_t>(remaining) * 4);
    rackWebMidiOutputCount = remaining;
  }
  int rackWebMidiPacketOutputAvailable() const { return rackWebMidiPacketOutputBytes; }
  uint8_t* rackWebMidiPacketOutputBuffer() { return rackWebMidiPacketOutput; }
  void rackWebConsumeMidiPacketOutput(int bytes) {
    bytes = std::clamp(bytes, 0, rackWebMidiPacketOutputBytes);
    const int remaining = rackWebMidiPacketOutputBytes - bytes;
    if (remaining > 0)
      std::memmove(rackWebMidiPacketOutput, rackWebMidiPacketOutput + bytes, static_cast<size_t>(remaining));
    rackWebMidiPacketOutputBytes = remaining;
  }
  virtual int assetCapacity() const { return 0; }
  virtual float* assetBuffer() { return nullptr; }
  virtual void commitAsset(int, int, float) {}
  virtual int assetSlotCount() const { return assetCapacity() > 0 ? 1 : 0; }
  virtual int assetCapacityForSlot(int slot) const { return slot == 0 ? assetCapacity() : 0; }
  virtual float* assetBufferForSlot(int slot) { return slot == 0 ? assetBuffer() : nullptr; }
  virtual void commitAssetForSlot(int slot, int frames, int channels, float sampleRate) {
    if (slot == 0) commitAsset(frames, channels, sampleRate);
  }
  // Browser-hosted modules cannot write directly to a user's filesystem from
  // the real-time thread. Capture modules expose a small interleaved PCM queue
  // which the AudioWorklet drains into a browser-owned encoder instead.
  virtual int rackWebCaptureCapacity() const { return 0; }
  virtual float* rackWebCaptureBuffer() { return nullptr; }
  virtual int rackWebCaptureFrames() const { return 0; }
  virtual int rackWebCaptureChannels() const { return 0; }
  virtual bool rackWebCaptureActive() const { return false; }
  virtual void rackWebConsumeCapture(int) {}
  virtual void rackWebSetCaptureEnabled(bool) {}
  // Modules with native dynamic displays can expose a compact, read-only
  // snapshot for the browser renderer without changing their Rack light ABI.
  virtual int rackWebVisualCount() const { return 0; }
  virtual float* rackWebVisualBuffer() { return nullptr; }
  virtual int rackWebExpanderCapacity() const { return 0; }
  virtual void rackWebSetExpanderCount(int) {}
  virtual void rackWebSetExpanderType(int, int) {}
  virtual void rackWebSetExpanderBypassed(int, bool) {}
  virtual void rackWebSetExpanderParam(int, int, float) {}
  virtual void rackWebSetExpanderInputConnected(int, int, bool) {}
  virtual void rackWebSetExpanderInputChannels(int, int, int) {}
  virtual void rackWebSyncExpanderFrame(int, const float*, int) {}
  virtual void rackWebCopyExpanderOutputFrame(int, float*, int) {}
  virtual int rackWebExpanderOutputChannels(int, int) const { return 0; }
  virtual plugin::Model* rackWebSelfModel() { return nullptr; }
  virtual plugin::Model* rackWebResolveNeighborModel(int) { return nullptr; }
  virtual Module* rackWebCreateNeighborModule(int) { return new Module; }
  void rackWebSetMessageNeighbor(int side, int modelIndex, bool connected) {
    if (side < 0 || side > 1) return;
    Expander& own = side ? rightExpander : leftExpander;
    if (!connected) {
      if (Module* neighbor = own.module) {
        Expander& remote = side ? neighbor->leftExpander : neighbor->rightExpander;
        remote.module = nullptr;
        remote.moduleId = -1;
      }
      own.module = nullptr;
      own.moduleId = -1;
      rackWebNeighborChainModules[side][0] = nullptr;
      onExpanderChange(ExpanderChangeEvent{static_cast<uint8_t>(side)});
      return;
    }
    if (!rackWebNeighborModules[side]) rackWebNeighborModules[side] = rackWebCreateNeighborModule(modelIndex);
    Module* neighbor = rackWebNeighborModules[side];
    rackWebNeighborChainModules[side][0] = neighbor;
    neighbor->model = rackWebResolveNeighborModel(modelIndex);
    neighbor->id = modelIndex;
    own.module = neighbor;
    own.moduleId = modelIndex;
    own.producerMessage = rackWebOwnMessages[side][0];
    own.consumerMessage = rackWebOwnMessages[side][1];
    Expander& remote = side ? neighbor->leftExpander : neighbor->rightExpander;
    remote.module = this;
    remote.moduleId = id;
    remote.producerMessage = rackWebNeighborMessages[side][0];
    remote.consumerMessage = rackWebNeighborMessages[side][1];
    remote.messageFlipRequested = false;
    onExpanderChange(ExpanderChangeEvent{static_cast<uint8_t>(side)});
  }
  void rackWebSetMessageChainNeighbor(int side, int index, int modelIndex, bool connected) {
    if (side < 0 || side > 1 || index < 0 || index >= 16) return;
    if (index == 0) { rackWebSetMessageNeighbor(side, modelIndex, connected); return; }
    Module* previous = rackWebNeighborChainModules[side][index - 1];
    if (!previous) return;
    if (!connected) {
      rackWebNeighborChainModules[side][index] = nullptr;
      Expander& edge = side ? previous->rightExpander : previous->leftExpander;
      edge.module = nullptr;
      edge.moduleId = -1;
      previous->onExpanderChange(ExpanderChangeEvent{static_cast<uint8_t>(side)});
      return;
    }
    Module*& current = rackWebNeighborChainModules[side][index];
    if (!current) current = rackWebCreateNeighborModule(modelIndex);
    current->model = rackWebResolveNeighborModel(modelIndex);
    current->id = modelIndex;
    Expander& previousEdge = side ? previous->rightExpander : previous->leftExpander;
    Expander& currentEdge = side ? current->leftExpander : current->rightExpander;
    previousEdge.module = current;
    previousEdge.moduleId = modelIndex;
    currentEdge.module = previous;
    currentEdge.moduleId = index - 1;
    previous->onExpanderChange(ExpanderChangeEvent{static_cast<uint8_t>(side)});
    current->onExpanderChange(ExpanderChangeEvent{static_cast<uint8_t>(side ? 0 : 1)});
  }
  Module* rackWebChainNeighbor(int side, int index) const {
    return side >= 0 && side <= 1 && index >= 0 && index < 16 ? rackWebNeighborChainModules[side][index] : nullptr;
  }
  void rackWebSetChainNeighborBypassed(int side, int index, bool value) {
    if (Module* module = rackWebChainNeighbor(side, index)) module->bypassed = value;
  }
  void rackWebSetChainNeighborParam(int side, int index, int id, float value) {
    if (Module* module = rackWebChainNeighbor(side, index); module && id >= 0 && id < rackWebMaxParams) module->params[id].setValue(value);
  }
  float rackWebChainNeighborParam(int side, int index, int id) const {
    Module* module = rackWebChainNeighbor(side, index);
    return module && id >= 0 && id < module->getNumParams() ? module->params[id].getValue() : 0.f;
  }
  void rackWebSetChainNeighborInput(int side, int index, int id, int channels, int channel, float value) {
    Module* module = rackWebChainNeighbor(side, index);
    if (!module || id < 0 || id >= module->getNumInputs()) return;
    Input& input = module->inputs[id];
    input.connected = channels > 0;
    input.setChannels(std::clamp(channels, 0, 16));
    if (channel >= 0 && channel < input.getChannels()) input.setVoltage(value, channel);
  }
  int rackWebChainNeighborInputChannels(int side, int index, int id) const {
    Module* module = rackWebChainNeighbor(side, index);
    return module && id >= 0 && id < module->getNumInputs() ? module->inputs[id].getChannels() : 0;
  }
  float rackWebChainNeighborInputVoltage(int side, int index, int id, int channel) const {
    Module* module = rackWebChainNeighbor(side, index);
    return module && id >= 0 && id < module->getNumInputs() ? module->inputs[id].getVoltage(channel) : 0.f;
  }
  void rackWebSetChainNeighborOutputConnected(int side, int index, int id, bool connected) {
    if (Module* module = rackWebChainNeighbor(side, index); module && id >= 0 && id < module->getNumOutputs()) module->outputs[id].connected = connected;
  }
  int rackWebChainNeighborOutputChannels(int side, int index, int id) const {
    Module* module = rackWebChainNeighbor(side, index);
    return module && id >= 0 && id < module->getNumOutputs() ? module->outputs[id].getChannels() : 0;
  }
  float rackWebChainNeighborOutputVoltage(int side, int index, int id, int channel) const {
    Module* module = rackWebChainNeighbor(side, index);
    return module && id >= 0 && id < module->getNumOutputs() ? module->outputs[id].getVoltage(channel) : 0.f;
  }
  float rackWebChainNeighborLightBrightness(int side, int index, int id) const {
    Module* module = rackWebChainNeighbor(side, index);
    return module && id >= 0 && id < module->getNumLights() ? module->lights[id].getBrightness() : 0.f;
  }
  void rackWebSetNeighborBypassed(int side, bool value) {
    if (side >= 0 && side <= 1 && rackWebNeighborModules[side]) rackWebNeighborModules[side]->bypassed = value;
  }
  void rackWebSetNeighborParam(int side, int id, float value) {
    if (side >= 0 && side <= 1 && rackWebNeighborModules[side] && id >= 0 && id < rackWebMaxParams) rackWebNeighborModules[side]->params[id].setValue(value);
  }
  void rackWebSetNeighborInput(int side, int id, int channels, int channel, float value) {
    if (side < 0 || side > 1 || !rackWebNeighborModules[side] || id < 0 || id >= 256) return;
    Input& input = rackWebNeighborModules[side]->inputs[id];
    input.connected = channels > 0;
    input.setChannels(std::clamp(channels, 0, 16));
    if (channel >= 0 && channel < input.getChannels()) input.setVoltage(value, channel);
  }
  void rackWebSetNeighborOutputConnected(int side, int id, bool connected) {
    if (side >= 0 && side <= 1 && rackWebNeighborModules[side] && id >= 0 && id < 256) rackWebNeighborModules[side]->outputs[id].connected = connected;
  }
  int rackWebNeighborOutputChannels(int side, int id) const {
    return side >= 0 && side <= 1 && rackWebNeighborModules[side] && id >= 0 && id < rackWebNeighborModules[side]->getNumOutputs() ? rackWebNeighborModules[side]->outputs[id].getChannels() : 0;
  }
  float rackWebNeighborOutputVoltage(int side, int id, int channel) const {
    return side >= 0 && side <= 1 && rackWebNeighborModules[side] && id >= 0 && id < rackWebNeighborModules[side]->getNumOutputs() ? rackWebNeighborModules[side]->outputs[id].getVoltage(channel) : 0.f;
  }
  float rackWebNeighborLightBrightness(int side, int id) const {
    return side >= 0 && side <= 1 && rackWebNeighborModules[side] && id >= 0 && id < rackWebNeighborModules[side]->getNumLights() ? rackWebNeighborModules[side]->lights[id].getBrightness() : 0.f;
  }
  void* rackWebMessagePointer(int side, bool neighbor, bool consumer) {
    if (side < 0 || side > 1) return nullptr;
    if (!neighbor) {
      Expander& expander = side ? rightExpander : leftExpander;
      return consumer ? expander.consumerMessage : expander.producerMessage;
    }
    Module* module = rackWebNeighborModules[side];
    if (!module) return nullptr;
    Expander& expander = side ? module->leftExpander : module->rightExpander;
    return consumer ? expander.consumerMessage : expander.producerMessage;
  }
  bool rackWebMessageFlipRequested(int side, bool neighbor) const {
    if (side < 0 || side > 1) return false;
    if (!neighbor) return (side ? rightExpander : leftExpander).messageFlipRequested;
    Module* module = rackWebNeighborModules[side];
    if (!module) return false;
    const Expander& expander = side ? module->leftExpander : module->rightExpander;
    return expander.messageFlipRequested;
  }
  void rackWebFinishMessageFlip(int side, bool neighbor) {
    if (side < 0 || side > 1) return;
    Expander* expander = nullptr;
    if (!neighbor) expander = &(side ? rightExpander : leftExpander);
    else if (Module* module = rackWebNeighborModules[side]) expander = &(side ? module->leftExpander : module->rightExpander);
    if (!expander) return;
    if (!neighbor) std::swap(expander->producerMessage, expander->consumerMessage);
    expander->messageFlipRequested = false;
  }
  void rackWebNotifyNeighborSampleRateChange(const SampleRateChangeEvent& event) {
    for (int side = 0; side < 2; side++)
      for (int index = 0; index < 16 && rackWebNeighborChainModules[side][index]; index++)
        rackWebNeighborChainModules[side][index]->onSampleRateChange(event);
  }
  void rackWebProcessNeighbors(const ProcessArgs& args) {
    // In Rack, adjacent modules are real engine participants. Processing the
    // browser-owned neighbor snapshots keeps source modules and their
    // expanders on the same per-sample contract instead of exposing stale
    // constructor state to the target module.
    for (int side = 0; side < 2; side++)
      for (int index = 0; index < 16 && rackWebNeighborChainModules[side][index]; index++)
        rackWebNeighborChainModules[side][index]->process(args);
  }
  Expander& getLeftExpander() { return leftExpander; }
  Expander& getRightExpander() { return rightExpander; }
  Expander& getExpander(uint8_t side) { return side ? rightExpander : leftExpander; }
  bool isBypassed() const { return bypassed; }
  void config(int paramCount, int inputCount, int outputCount, int lightCount = 0) {
    configuredParams = paramCount;
    configuredInputs = inputCount;
    configuredOutputs = outputCount;
    configuredLights = lightCount;
    if (lightCount > static_cast<int>(lights.size())) lights.resize(lightCount);
  }
  int getNumParams() const { return configuredParams; }
  int getNumInputs() const { return configuredInputs; }
  int getNumOutputs() const { return configuredOutputs; }
  int getNumLights() const { return configuredLights; }
  plugin::Model* getModel() const { return model; }
  Param& getParam(int id) { return params[std::clamp(id, 0, rackWebMaxParams - 1)]; }
  const Param& getParam(int id) const { return params[std::clamp(id, 0, rackWebMaxParams - 1)]; }
  Input& getInput(int id) { return inputs[std::clamp(id, 0, 255)]; }
  const Input& getInput(int id) const { return inputs[std::clamp(id, 0, 255)]; }
  Output& getOutput(int id) { return outputs[std::clamp(id, 0, 255)]; }
  const Output& getOutput(int id) const { return outputs[std::clamp(id, 0, 255)]; }
  Light& getLight(int id) { return lights[std::clamp(id, 0, std::max(0, static_cast<int>(lights.size()) - 1))]; }
  const Light& getLight(int id) const { return lights[std::clamp(id, 0, std::max(0, static_cast<int>(lights.size()) - 1))]; }
  ParamQuantity* getParamQuantity(int id) { return id >= 0 && id < rackWebMaxParams ? paramQuantities[id] : nullptr; }
  InputInfo* getInputInfo(int id) { return id >= 0 && id < rackWebMaxPorts ? inputInfos[id] : nullptr; }
  OutputInfo* getOutputInfo(int id) { return id >= 0 && id < rackWebMaxPorts ? outputInfos[id] : nullptr; }
  LightInfo* getLightInfo(int id) { return id >= 0 && id < rackWebMaxLights ? lightInfos[id] : nullptr; }
  InputInfo* configInput(int id, const char* name = "") { auto* info = getInputInfo(id); if (info) info->name = info->description = name ? name : ""; return info; }
  InputInfo* configInput(int id, const std::string& name) { return configInput(id, name.c_str()); }
  OutputInfo* configOutput(int id, const char* name = "") { auto* info = getOutputInfo(id); if (info) info->name = info->description = name ? name : ""; return info; }
  OutputInfo* configOutput(int id, const std::string& name) { return configOutput(id, name.c_str()); }
  LightInfo* configLight(int id, const char* name = "") { auto* info = getLightInfo(id); if (info) info->description = name ? name : ""; return info; }
  LightInfo* configLight(int id, const std::string& name) { return configLight(id, name.c_str()); }
  void configBypass(int inputId, int outputId) { bypassRoutes.push_back({inputId, outputId}); }
  SwitchQuantity* configButton(int id, const char* name = "") { auto* quantity = configParam<SwitchQuantity>(id, 0.f, 1.f, 0.f, name); if (quantity) { quantity->snapEnabled = true; quantity->smoothEnabled = false; quantity->randomizeEnabled = false; } return quantity; }
  SwitchQuantity* configButton(int id, const std::string& name) { return configButton(id, name.c_str()); }
  template <typename Quantity>
  Quantity* configButton(int id, const char* name = "") { auto* quantity = configParam<Quantity>(id, 0.f, 1.f, 0.f, name); if (quantity) { quantity->snapEnabled = true; quantity->smoothEnabled = false; quantity->randomizeEnabled = false; } return quantity; }
  template <typename Quantity>
  Quantity* configButton(int id, const std::string& name) { return configButton<Quantity>(id, name.c_str()); }
  SwitchQuantity* configSwitch(int id, float minimum, float maximum, float initial, const char* name) { auto* quantity = configParam<SwitchQuantity>(id, minimum, maximum, initial, name); if (quantity) { quantity->snapEnabled = true; quantity->smoothEnabled = false; } return quantity; }
  SwitchQuantity* configSwitch(int id, float minimum, float maximum, float initial, const std::string& name) { return configSwitch(id, minimum, maximum, initial, name.c_str()); }
  SwitchQuantity* configSwitch(int id, float minimum, float maximum, float initial) { return configSwitch(id, minimum, maximum, initial, ""); }
  template <typename Quantity>
  Quantity* configSwitch(int id, float minimum, float maximum, float initial) { auto* quantity = configParam<Quantity>(id, minimum, maximum, initial, ""); if (quantity) { quantity->snapEnabled = true; quantity->smoothEnabled = false; } return quantity; }
  template <typename Quantity>
  Quantity* configSwitch(int id, float minimum, float maximum, float initial, const char* name) { auto* quantity = configParam<Quantity>(id, minimum, maximum, initial, name); if (quantity) { quantity->snapEnabled = true; quantity->smoothEnabled = false; } return quantity; }
  template <typename Quantity>
  Quantity* configSwitch(int id, float minimum, float maximum, float initial, const std::string& name) { return configSwitch<Quantity>(id, minimum, maximum, initial, name.c_str()); }
  template <typename Labels>
  SwitchQuantity* configSwitch(int id, float minimum, float maximum, float initial, const char* name, Labels&& labels) { auto* quantity = configSwitch(id, minimum, maximum, initial, name); if (quantity) { quantity->labels.clear(); for (const auto& label : labels) quantity->labels.emplace_back(label); } return quantity; }
  template <typename Labels>
  SwitchQuantity* configSwitch(int id, float minimum, float maximum, float initial, const std::string& name, Labels&& labels) { return configSwitch(id, minimum, maximum, initial, name.c_str(), std::forward<Labels>(labels)); }
  SwitchQuantity* configSwitch(int id, float minimum, float maximum, float initial, const char* name, std::initializer_list<const char*> labels) { auto* quantity = configSwitch(id, minimum, maximum, initial, name); if (quantity) { quantity->labels.clear(); for (const char* label : labels) quantity->labels.emplace_back(label ? label : ""); } return quantity; }
  SwitchQuantity* configSwitch(int id, float minimum, float maximum, float initial, const std::string& name, std::initializer_list<const char*> labels) { return configSwitch(id, minimum, maximum, initial, name.c_str(), labels); }
  template <typename Quantity>
  Quantity* configSwitch(int id, float minimum, float maximum, float initial, const char* name, std::initializer_list<const char*> labels) { auto* quantity = configParam<Quantity>(id, minimum, maximum, initial, name); if (quantity) { quantity->snapEnabled = true; quantity->smoothEnabled = false; if constexpr (std::is_base_of_v<SwitchQuantity, Quantity>) { quantity->labels.clear(); for (const char* label : labels) quantity->labels.emplace_back(label ? label : ""); } } return quantity; }
  template <typename Quantity>
  Quantity* configSwitch(int id, float minimum, float maximum, float initial, const std::string& name, std::initializer_list<const char*> labels) { return configSwitch<Quantity>(id, minimum, maximum, initial, name.c_str(), labels); }
  template <typename Quantity>
  Quantity* configSwitch(int id, float minimum, float maximum, float initial, const char* name, std::initializer_list<std::string> labels) { auto* quantity = configParam<Quantity>(id, minimum, maximum, initial, name); if (quantity) { quantity->snapEnabled = true; quantity->smoothEnabled = false; if constexpr (std::is_base_of_v<SwitchQuantity, Quantity>) quantity->labels.assign(labels); } return quantity; }
  template <typename Quantity>
  Quantity* configSwitch(int id, float minimum, float maximum, float initial, const std::string& name, std::initializer_list<std::string> labels) { return configSwitch<Quantity>(id, minimum, maximum, initial, name.c_str(), labels); }
  template <typename Quantity, typename Labels>
  Quantity* configSwitch(int id, float minimum, float maximum, float initial, const char* name, Labels&& labels) { auto* quantity = configParam<Quantity>(id, minimum, maximum, initial, name); if (quantity) { quantity->snapEnabled = true; quantity->smoothEnabled = false; if constexpr (std::is_base_of_v<SwitchQuantity, Quantity>) { quantity->labels.clear(); for (const auto& label : labels) quantity->labels.emplace_back(label); } } return quantity; }
  template <typename Quantity, typename Labels>
  Quantity* configSwitch(int id, float minimum, float maximum, float initial, const std::string& name, Labels&& labels) { return configSwitch<Quantity>(id, minimum, maximum, initial, name.c_str(), std::forward<Labels>(labels)); }
  ParamQuantity* configureParamQuantity(int id, ParamQuantity* quantity, float minimum, float maximum, float initial, const char* name, const char* unit, float displayBase, float displayMultiplier, float displayOffset) {
    if (id < 0 || id >= rackWebMaxParams || !quantity) return nullptr;
    params[id].value = initial;
    quantity->module = this;
    quantity->paramId = id;
    quantity->minValue = minimum;
    quantity->maxValue = maximum;
    quantity->defaultValue = initial;
    quantity->value = initial;
    quantity->name = name ? name : "";
    quantity->unit = unit ? unit : "";
    quantity->displayBase = displayBase;
    quantity->displayMultiplier = displayMultiplier;
    quantity->displayOffset = displayOffset;
    paramQuantities[id] = quantity;
    return quantity;
  }
  ParamQuantity* configParam(int id, float minimum, float maximum, float initial, const char* name, const char* unit = "", float displayBase = 0.f, float displayMultiplier = 1.f, float displayOffset = 0.f) {
    if (id < 0 || id >= rackWebMaxParams) return nullptr;
    if (paramQuantities[id] != &quantities[id]) delete paramQuantities[id];
    auto* quantity = new ParamQuantity();
    return configureParamQuantity(id, quantity, minimum, maximum, initial, name, unit, displayBase, displayMultiplier, displayOffset);
  }
  ParamQuantity* configParam(int id, float minimum, float maximum, float initial) {
    return configParam(id, minimum, maximum, initial, "");
  }
  ParamQuantity* configParam(int id, float minimum, float maximum, float initial, const std::string& name, const char* unit = "", float displayBase = 0.f, float displayMultiplier = 1.f, float displayOffset = 0.f) {
    return configParam(id, minimum, maximum, initial, name.c_str(), unit, displayBase, displayMultiplier, displayOffset);
  }
  ParamQuantity* configParam(int id, float minimum, float maximum, float initial, const std::string& name, const std::string& unit, float displayBase = 0.f, float displayMultiplier = 1.f, float displayOffset = 0.f) {
    return configParam(id, minimum, maximum, initial, name.c_str(), unit.c_str(), displayBase, displayMultiplier, displayOffset);
  }
  template <typename Quantity>
  Quantity* configParam(int id, float minimum, float maximum, float initial, const char* name, const char* unit = "", float displayBase = 0.f, float displayMultiplier = 1.f, float displayOffset = 0.f) {
    if (id < 0 || id >= rackWebMaxParams) return nullptr;
    if (paramQuantities[id] != &quantities[id]) delete paramQuantities[id];
    auto* quantity = new Quantity();
    configureParamQuantity(id, quantity, minimum, maximum, initial, name, unit, displayBase, displayMultiplier, displayOffset);
    return quantity;
  }
  template <typename Quantity>
  Quantity* configParam(int id, float minimum, float maximum, float initial) {
    return configParam<Quantity>(id, minimum, maximum, initial, "");
  }
  template <typename Quantity>
  Quantity* configParam(int id, float minimum, float maximum, float initial, const std::string& name, const char* unit = "", float displayBase = 0.f, float displayMultiplier = 1.f, float displayOffset = 0.f) {
    return configParam<Quantity>(id, minimum, maximum, initial, name.c_str(), unit, displayBase, displayMultiplier, displayOffset);
  }
  template <typename Quantity>
  Quantity* configParam(int id, float minimum, float maximum, float initial, const std::string& name, const std::string& unit, float displayBase = 0.f, float displayMultiplier = 1.f, float displayOffset = 0.f) {
    return configParam<Quantity>(id, minimum, maximum, initial, name.c_str(), unit.c_str(), displayBase, displayMultiplier, displayOffset);
  }
};

namespace engine { using Module = ::rack::Module; }

inline int maxPoly(Module* module, int numInputs, int numOutputs) {
  if (!module) return 1;
  int channels = 1;
  for (int index = 0; index < std::min(numInputs, module->getNumInputs()); ++index)
    channels = std::max(channels, module->inputs[index].getChannels());
  for (int index = 0; index < std::min(numOutputs, module->getNumOutputs()); ++index)
    channels = std::max(channels, module->outputs[index].getChannels());
  return channels;
}

inline Param* ParamQuantity::getParam() {
  return module && paramId >= 0 ? &module->getParam(paramId) : nullptr;
}
inline const Param* ParamQuantity::getParam() const {
  return module && paramId >= 0 ? &module->getParam(paramId) : nullptr;
}
inline void ParamQuantity::setValue(float next) {
  // Rack modules sometimes intentionally reverse min/max so the control turns
  // in the opposite direction. Clamp against the numeric bounds without
  // destroying that orientation in getMinValue()/getMaxValue().
  value = std::clamp(next, std::min(minValue, maxValue), std::max(minValue, maxValue));
  if (Param* param = getParam()) param->setValue(value);
}
inline void engine::Engine::setParamValue(::rack::Module* module, int paramId, float value) {
  if (module) module->getParam(paramId).setValue(value);
}
inline float engine::Engine::getParamValue(::rack::Module* module, int paramId) {
  return module ? module->getParam(paramId).getValue() : 0.f;
}
inline void engine::Engine::rackWebAttachModule(::rack::Module* module) {
  if (!module) return;
  rackWebModule = module;
  if (module->id < 0) module->id = 0;
  for (ParamHandle* handle : paramHandles)
    if (handle && handle->moduleId == module->id) handle->module = module;
}
inline void engine::Engine::addParamHandle(ParamHandle* paramHandle) {
  if (!paramHandle) return;
  paramHandles.insert(paramHandle);
  if (paramHandle->moduleId >= 0)
    paramHandle->module = rackWebModule && rackWebModule->id == paramHandle->moduleId ? rackWebModule : nullptr;
}
inline void engine::Engine::removeParamHandle(ParamHandle* paramHandle) {
  if (!paramHandle) return;
  paramHandle->module = nullptr;
  paramHandles.erase(paramHandle);
}
inline engine::ParamHandle* engine::Engine::getParamHandle(int64_t moduleId, int paramId) {
  for (ParamHandle* handle : paramHandles)
    if (handle && handle->moduleId == moduleId && handle->paramId == paramId) return handle;
  return nullptr;
}
inline engine::ParamHandle* engine::Engine::getParamHandle(::rack::Module* module, int paramId) {
  return module ? getParamHandle(module->id, paramId) : nullptr;
}
inline void engine::Engine::updateParamHandle(ParamHandle* paramHandle, int64_t moduleId, int paramId, bool overwrite) {
  if (!paramHandle) return;
  paramHandles.insert(paramHandle);
  if (moduleId >= 0) {
    if (ParamHandle* previous = getParamHandle(moduleId, paramId); previous && previous != paramHandle) {
      ParamHandle* displaced = overwrite ? previous : paramHandle;
      displaced->moduleId = -1;
      displaced->paramId = 0;
      displaced->module = nullptr;
      if (!overwrite) return;
    }
  }
  paramHandle->moduleId = moduleId;
  paramHandle->paramId = paramId;
  paramHandle->module = moduleId >= 0 && rackWebModule && rackWebModule->id == moduleId ? rackWebModule : nullptr;
}

inline int eucMod(int value, int base) { int result = value % base; return result < 0 ? result + base : result; }
template <typename Value, std::enable_if_t<std::is_floating_point_v<Value>, int> = 0>
inline Value eucMod(Value value, Value base) {
  return value - base * std::floor(value / base);
}
using simd::sgn;
template <typename Value, typename Minimum, typename Maximum>
Value clampSafe(Value value, Minimum minimum, Maximum maximum) {
  if constexpr (std::is_floating_point_v<Value>) if (!std::isfinite(value)) value = static_cast<Value>(minimum);
  return std::clamp(value, static_cast<Value>(minimum), static_cast<Value>(maximum));
}
inline int eucDiv(int value, int base) { int result = value / base; if (value % base < 0) result--; return result; }
inline void eucDivMod(int value, int base, int* division, int* modulus) {
  const int quotient = eucDiv(value, base);
  if (division) *division = quotient;
  if (modulus) *modulus = value - quotient * base;
}
template <typename Value, typename Minimum, typename Maximum>
constexpr auto clamp(const Value& value, const Minimum& minimum, const Maximum& maximum) {
  using Result = std::common_type_t<Value, Minimum, Maximum>;
  if constexpr (std::is_same_v<Result, simd::float_4>)
    return simd::clamp(static_cast<Result>(value), static_cast<Result>(minimum), static_cast<Result>(maximum));
  else
    return std::clamp(static_cast<Result>(value), static_cast<Result>(minimum), static_cast<Result>(maximum));
}
template <typename Value>
constexpr auto clamp(const Value& value) { return rack::clamp(value, Value(0), Value(1)); }
template <typename Value, typename InputMinimum, typename InputMaximum, typename OutputMinimum, typename OutputMaximum>
auto rescale(const Value& value, const InputMinimum& inputMinimum, const InputMaximum& inputMaximum, const OutputMinimum& outputMinimum, const OutputMaximum& outputMaximum) {
  if constexpr (std::is_arithmetic_v<Value> && std::is_arithmetic_v<InputMinimum> && std::is_arithmetic_v<InputMaximum> && std::is_arithmetic_v<OutputMinimum> && std::is_arithmetic_v<OutputMaximum>) {
    using Result = std::common_type_t<Value, InputMinimum, InputMaximum, OutputMinimum, OutputMaximum>;
    return static_cast<Result>(outputMinimum)
      + (static_cast<Result>(value) - static_cast<Result>(inputMinimum))
      / (static_cast<Result>(inputMaximum) - static_cast<Result>(inputMinimum))
      * (static_cast<Result>(outputMaximum) - static_cast<Result>(outputMinimum));
  }
  else {
    return outputMinimum + (value - inputMinimum) / (inputMaximum - inputMinimum) * (outputMaximum - outputMinimum);
  }
}
template <typename First, typename Second, typename Mix>
auto crossfade(const First& first, const Second& second, const Mix& mix) { using Result = std::common_type_t<First, Second, Mix>; return static_cast<Result>(first) + (static_cast<Result>(second) - static_cast<Result>(first)) * static_cast<Result>(mix); }

namespace math {
using rack::clamp;
using rack::clampSafe;
using rack::rescale;
using rack::crossfade;
using rack::eucDiv;
using rack::eucDivMod;
using rack::eucMod;
using rack::sgn;
inline float normalizeZero(float value) { return value == 0.f ? 0.f : value; }
inline float chop(float value, float epsilon = 1e-6f) { return std::fabs(value) <= epsilon ? 0.f : value; }
template <typename T>
constexpr bool isEven(T value) { return value % 2 == 0; }
template <typename T>
constexpr bool isOdd(T value) { return value % 2 != 0; }
inline bool isNear(float first, float second, float epsilon = 1e-6f) { return std::fabs(first - second) <= epsilon; }
struct Rect;
struct Vec {
  float x = 0.f;
  float y = 0.f;
  constexpr Vec() = default;
  constexpr Vec(float value) : x(value), y(value) {}
  constexpr Vec(float x, float y) : x(x), y(y) {}
  float& operator[](int index) { return index == 0 ? x : y; }
  const float& operator[](int index) const { return index == 0 ? x : y; }
  constexpr Vec neg() const { return {-x, -y}; }
  constexpr Vec plus(Vec other) const { return {x + other.x, y + other.y}; }
  constexpr Vec minus(Vec other) const { return {x - other.x, y - other.y}; }
  constexpr Vec mult(float scale) const { return {x * scale, y * scale}; }
  constexpr Vec mult(Vec other) const { return {x * other.x, y * other.y}; }
  constexpr Vec div(float scale) const { return {x / scale, y / scale}; }
  constexpr Vec div(Vec other) const { return {x / other.x, y / other.y}; }
  constexpr float dot(Vec other) const { return x * other.x + y * other.y; }
  float arg() const { return std::atan2(y, x); }
  float norm() const { return std::hypot(x, y); }
  Vec normalize() const { return div(norm()); }
  constexpr float square() const { return x * x + y * y; }
  constexpr float area() const { return x * y; }
  Vec rotate(float angle) const { const float sine = std::sin(angle), cosine = std::cos(angle); return {x * cosine - y * sine, x * sine + y * cosine}; }
  constexpr Vec flip() const { return {y, x}; }
  Vec min(Vec other) const { return {std::fmin(x, other.x), std::fmin(y, other.y)}; }
  Vec max(Vec other) const { return {std::fmax(x, other.x), std::fmax(y, other.y)}; }
  Vec abs() const { return {std::fabs(x), std::fabs(y)}; }
  Vec round() const { return {std::round(x), std::round(y)}; }
  Vec floor() const { return {std::floor(x), std::floor(y)}; }
  Vec ceil() const { return {std::ceil(x), std::ceil(y)}; }
  constexpr bool equals(Vec other) const { return x == other.x && y == other.y; }
  constexpr bool isEqual(Vec other) const { return equals(other); }
  constexpr bool isZero() const { return x == 0.f && y == 0.f; }
  bool isFinite() const { return std::isfinite(x) && std::isfinite(y); }
  Vec crossfade(Vec other, float proportion) const { return plus(other.minus(*this).mult(proportion)); }
  constexpr Vec operator+(Vec other) const { return plus(other); }
  constexpr Vec operator-(Vec other) const { return minus(other); }
  constexpr Vec operator-() const { return neg(); }
  constexpr Vec operator*(float scale) const { return mult(scale); }
  constexpr Vec operator/(float scale) const { return div(scale); }
};
struct Rect {
  Vec pos;
  Vec size;
  constexpr Rect() = default;
  constexpr Rect(Vec pos, Vec size) : pos(pos), size(size) {}
  constexpr Rect(float x, float y, float width, float height) : pos(x, y), size(width, height) {}
  static constexpr Rect fromMinMax(Vec minimum, Vec maximum) { return {minimum, maximum.minus(minimum)}; }
  static Rect fromCorners(Vec first, Vec second) { return fromMinMax(first.min(second), first.max(second)); }
  bool contains(Vec value) const { return pos.x <= value.x && (size.x == INFINITY || value.x < pos.x + size.x) && pos.y <= value.y && (size.y == INFINITY || value.y < pos.y + size.y); }
  bool contains(Rect value) const { return pos.x <= value.pos.x && value.pos.x - size.x <= pos.x - value.size.x && pos.y <= value.pos.y && value.pos.y - size.y <= pos.y - value.size.y; }
  bool intersects(Rect value) const { return (value.size.x == INFINITY || pos.x < value.pos.x + value.size.x) && (size.x == INFINITY || value.pos.x < pos.x + size.x) && (value.size.y == INFINITY || pos.y < value.pos.y + value.size.y) && (size.y == INFINITY || value.pos.y < pos.y + size.y); }
  bool equals(Rect value) const { return pos.equals(value.pos) && size.equals(value.size); }
  float getLeft() const { return pos.x; }
  float getRight() const { return size.x == INFINITY ? INFINITY : pos.x + size.x; }
  float getTop() const { return pos.y; }
  float getBottom() const { return size.y == INFINITY ? INFINITY : pos.y + size.y; }
  float getWidth() const { return size.x; }
  float getHeight() const { return size.y; }
  Vec getCenter() const { return pos.plus(size.mult(.5f)); }
};
inline float interpolateLinear(const float* values, float index) { const int first = static_cast<int>(index); const float mix = index - first; return values[first] + (values[first + 1] - values[first]) * mix; }
template <typename T>
T sgn(T value) { return value > T(0) ? T(1) : value < T(0) ? T(-1) : T(0); }
template <typename T>
auto log2(T value) { return std::log2(value); }
}
using math::Vec;
using math::Rect;
using math::normalizeZero;
inline constexpr float MM_PER_IN = 25.4f;
inline constexpr float SVG_DPI = 75.f;
inline constexpr float _PI = 3.14159265358979323846f;
inline constexpr float _H_PI = 1.57079632679489661923f;
inline constexpr float _2_PI = 6.28318530717958647692f;
inline constexpr float RACK_WEB_MM_TO_PX = 75.f / 25.4f;
inline constexpr Vec mm2px(Vec value) { return value.mult(RACK_WEB_MM_TO_PX); }
inline constexpr float mm2px(float value) { return value * RACK_WEB_MM_TO_PX; }
inline constexpr Vec px2mm(Vec value) { return value.div(RACK_WEB_MM_TO_PX); }
inline constexpr float px2mm(float value) { return value / RACK_WEB_MM_TO_PX; }
// Rack 1 exposed this helper directly in rack::. Keep the legacy spelling so
// older open-source sequencers compile unchanged against the Rack 2 web host.
inline float interpolateLinear(const float* values, float index) { return math::interpolateLinear(values, index); }
inline float getSampleRate() { return APP && APP->engine ? APP->engine->getSampleRate() : 48000.f; }
inline float engineGetSampleRate() { return getSampleRate(); }
inline float engineGetSampleTime() { return 1.f / getSampleRate(); }
inline constexpr bool isEven(int value) { return value % 2 == 0; }
inline constexpr bool isOdd(int value) { return !isEven(value); }

template <typename First, typename Second>
bool isNear(const First& first, const Second& second, float tolerance = 1e-6f) { return std::fabs(static_cast<float>(first - second)) <= tolerance; }

namespace dsp {
template <typename T>
T amplitudeToDb(T amplitude) { return T(20) * std::log10(amplitude); }
template <typename T>
T dbToAmplitude(T db) { return std::pow(T(10), db / T(20)); }
static constexpr float FREQ_C4 = 261.6255653005986f;
static constexpr float FREQ_A4 = 440.0000f;
static constexpr float FREQ_SEMITONE = 1.0594630943592953f;

template <typename T>
inline T hann(T proportion) {
  return T(.5) * (1 - simd::cos(2 * T(M_PI) * proportion));
}
inline void hannWindow(float* values, int length) {
  if (length <= 1) return;
  for (int index = 0; index < length; index++) values[index] *= hann(float(index) / (length - 1));
}
template <typename T>
inline T blackman(T alpha, T proportion) {
  return (1 - alpha) / 2 - T(.5) * simd::cos(2 * T(M_PI) * proportion) + alpha / 2 * simd::cos(4 * T(M_PI) * proportion);
}
inline void blackmanWindow(float alpha, float* values, int length) {
  if (length <= 1) return;
  for (int index = 0; index < length; index++) values[index] *= blackman(alpha, float(index) / (length - 1));
}
template <typename T>
inline T blackmanNuttall(T proportion) {
  return T(.3635819) - T(.4891775) * simd::cos(2 * T(M_PI) * proportion) + T(.1365995) * simd::cos(4 * T(M_PI) * proportion) - T(.0106411) * simd::cos(6 * T(M_PI) * proportion);
}
inline void blackmanNuttallWindow(float* values, int length) {
  if (length <= 1) return;
  for (int index = 0; index < length; index++) values[index] *= blackmanNuttall(float(index) / (length - 1));
}
template <typename T>
inline T blackmanHarris(T proportion) {
  return T(.35875) - T(.48829) * simd::cos(2 * T(M_PI) * proportion) + T(.14128) * simd::cos(4 * T(M_PI) * proportion) - T(.01168) * simd::cos(6 * T(M_PI) * proportion);
}
inline void blackmanHarrisWindow(float* values, int length) {
  if (length <= 1) return;
  for (int index = 0; index < length; index++) values[index] *= blackmanHarris(float(index) / (length - 1));
}

template <typename T>
T quadraticBipolar(T value) { return simd::sgn(value) * value * value; }
template <typename T>
T exponentialBipolar(T base, T value) {
  return (simd::pow(base, value) - simd::pow(base, -value)) / (base - T(1) / base);
}
template <typename T>
T sqrtBipolar(T value) { return simd::sgn(value) * simd::sqrt(value); }
template <typename T>
T cubic(T value) { return value * value * value; }
template <typename T>
T quarticBipolar(T value) { return simd::sgn(value) * value * value * value * value; }

struct RealFFT {
  int length = 0;
  float* real = nullptr;
  float* imaginary = nullptr;
  explicit RealFFT(size_t size) : length(static_cast<int>(size)), real(new float[size]), imaginary(new float[size]) {}
  ~RealFFT() { delete[] real; delete[] imaginary; }
  RealFFT(const RealFFT&) = delete;
  RealFFT& operator=(const RealFFT&) = delete;
  void transform(bool inverse) {
    for (int index = 1, reversed = 0; index < length; index++) {
      int bit = length >> 1;
      for (; reversed & bit; bit >>= 1) reversed ^= bit;
      reversed ^= bit;
      if (index < reversed) { std::swap(real[index], real[reversed]); std::swap(imaginary[index], imaginary[reversed]); }
    }
    for (int span = 2; span <= length; span <<= 1) {
      const float angle = (inverse ? 2.f : -2.f) * 3.14159265358979323846f / span;
      const float stepReal = std::cos(angle), stepImaginary = std::sin(angle);
      for (int start = 0; start < length; start += span) {
        float twiddleReal = 1.f, twiddleImaginary = 0.f;
        for (int offset = 0; offset < span / 2; offset++) {
          const int even = start + offset, odd = even + span / 2;
          const float oddReal = real[odd] * twiddleReal - imaginary[odd] * twiddleImaginary;
          const float oddImaginary = real[odd] * twiddleImaginary + imaginary[odd] * twiddleReal;
          const float evenReal = real[even], evenImaginary = imaginary[even];
          real[even] = evenReal + oddReal; imaginary[even] = evenImaginary + oddImaginary;
          real[odd] = evenReal - oddReal; imaginary[odd] = evenImaginary - oddImaginary;
          const float nextReal = twiddleReal * stepReal - twiddleImaginary * stepImaginary;
          twiddleImaginary = twiddleReal * stepImaginary + twiddleImaginary * stepReal;
          twiddleReal = nextReal;
        }
      }
    }
  }
  void rfft(const float* input, float* output) {
    for (int index = 0; index < length; index++) { real[index] = input[index]; imaginary[index] = 0.f; }
    transform(false);
    output[0] = real[0]; output[1] = real[length / 2];
    for (int bin = 1; bin < length / 2; bin++) { output[2 * bin] = real[bin]; output[2 * bin + 1] = imaginary[bin]; }
  }
  void irfft(const float* input, float* output) {
    real[0] = input[0]; imaginary[0] = 0.f; real[length / 2] = input[1]; imaginary[length / 2] = 0.f;
    for (int bin = 1; bin < length / 2; bin++) { real[bin] = input[2 * bin]; imaginary[bin] = input[2 * bin + 1]; real[length - bin] = real[bin]; imaginary[length - bin] = -imaginary[bin]; }
    transform(true);
    for (int index = 0; index < length; index++) output[index] = real[index];
  }
  void rfftUnordered(const float* input, float* output) { rfft(input, output); }
  void irfftUnordered(const float* input, float* output) { irfft(input, output); }
  void scale(float* values) const { const float factor = 1.f / length; for (int index = 0; index < length; index++) values[index] *= factor; }
};

inline float sinc(float value) { return value == 0.f ? 1.f : std::sin(3.14159265358979323846f * value) / (3.14159265358979323846f * value); }
inline void boxcarLowpassIR(float* output, int length, float cutoff = .5f) {
  for (int index = 0; index < length; index++) {
    const float time = index - (length - 1) / 2.f;
    output[index] = 2.f * cutoff * sinc(2.f * cutoff * time);
  }
}

// Rack's fixed-ratio oversampling filters. Keeping the same FIR construction
// and circular-buffer order is important because many open-source distortion
// modules rely on their transient and latency characteristics.
template <int OVERSAMPLE, int QUALITY, typename T = float>
struct Decimator {
  T inputBuffer[OVERSAMPLE * QUALITY]{};
  float kernel[OVERSAMPLE * QUALITY]{};
  int inputIndex = 0;
  explicit Decimator(float cutoff = .9f) {
    boxcarLowpassIR(kernel, OVERSAMPLE * QUALITY, cutoff * .5f / OVERSAMPLE);
    blackmanHarrisWindow(kernel, OVERSAMPLE * QUALITY);
  }
  void reset() {
    inputIndex = 0;
    std::memset(inputBuffer, 0, sizeof(inputBuffer));
  }
  T process(T* input) {
    std::memcpy(&inputBuffer[inputIndex], input, OVERSAMPLE * sizeof(T));
    inputIndex = (inputIndex + OVERSAMPLE) % (OVERSAMPLE * QUALITY);
    T output = 0.f;
    for (int index = 0; index < OVERSAMPLE * QUALITY; index++) {
      int bufferIndex = inputIndex - 1 - index;
      bufferIndex = (bufferIndex + OVERSAMPLE * QUALITY) % (OVERSAMPLE * QUALITY);
      output += kernel[index] * inputBuffer[bufferIndex];
    }
    return output;
  }
};

template <int OVERSAMPLE, int QUALITY>
struct Upsampler {
  float inputBuffer[QUALITY]{};
  float kernel[OVERSAMPLE * QUALITY]{};
  int inputIndex = 0;
  explicit Upsampler(float cutoff = .9f) {
    boxcarLowpassIR(kernel, OVERSAMPLE * QUALITY, cutoff * .5f / OVERSAMPLE);
    blackmanHarrisWindow(kernel, OVERSAMPLE * QUALITY);
  }
  void reset() {
    inputIndex = 0;
    std::memset(inputBuffer, 0, sizeof(inputBuffer));
  }
  void process(float input, float* output) {
    inputBuffer[inputIndex] = OVERSAMPLE * input;
    inputIndex = (inputIndex + 1) % QUALITY;
    for (int sample = 0; sample < OVERSAMPLE; sample++) {
      float value = 0.f;
      for (int tap = 0; tap < QUALITY; tap++) {
        int bufferIndex = inputIndex - 1 - tap;
        bufferIndex = (bufferIndex + QUALITY) % QUALITY;
        value += kernel[OVERSAMPLE * tap + sample] * inputBuffer[bufferIndex];
      }
      output[sample] = value;
    }
  }
};

inline void minBlepImpulse(int zeroCrossings, int oversample, float* output) {
  const int length = 2 * zeroCrossings * oversample;
  float* time = new float[length];
  float* frequency = new float[2 * length]{};
  for (int index = 0; index < length; index++) {
    const float position = -zeroCrossings + 2.f * zeroCrossings * index / (length - 1);
    const float phase = 2.f * 3.14159265358979323846f * index / (length - 1);
    const float window = 0.35875f - 0.48829f * std::cos(phase) + 0.14128f * std::cos(2.f * phase) - 0.01168f * std::cos(3.f * phase);
    time[index] = sinc(position) * window;
  }
  RealFFT fft(length);
  fft.rfft(time, frequency);
  frequency[0] = std::log(std::max(std::fabs(frequency[0]), 1e-13f));
  frequency[1] = std::log(std::max(std::fabs(frequency[1]), 1e-13f));
  for (int bin = 1; bin < length / 2; bin++) { frequency[2 * bin] = std::log(std::max(std::hypot(frequency[2 * bin], frequency[2 * bin + 1]), 1e-13f)); frequency[2 * bin + 1] = 0.f; }
  for (int index = 0; index < length; index++) frequency[index] = std::max(-30.f, frequency[index]);
  fft.irfft(frequency, time); fft.scale(time);
  for (int index = 1; index < length / 2; index++) time[index] *= 2.f;
  for (int index = (length + 1) / 2; index < length; index++) time[index] = 0.f;
  fft.rfft(time, frequency);
  frequency[0] = std::exp(frequency[0]); frequency[1] = std::exp(frequency[1]);
  for (int bin = 1; bin < length / 2; bin++) { const float magnitude = std::exp(frequency[2 * bin]), angle = frequency[2 * bin + 1]; frequency[2 * bin] = magnitude * std::cos(angle); frequency[2 * bin + 1] = magnitude * std::sin(angle); }
  fft.irfft(frequency, time); fft.scale(time);
  float total = 0.f; for (int index = 0; index < length; index++) { total += time[index]; output[index] = total; }
  const float normalization = 1.f / output[length - 1]; for (int index = 0; index < length; index++) output[index] *= normalization;
  delete[] time; delete[] frequency;
}

template <int Z, int O, typename T = float>
struct MinBlepGenerator {
  T buffer[2 * Z]{};
  int position = 0;
  float impulse[2 * Z * O + 1]{};
  MinBlepGenerator() { minBlepImpulse(Z, O, impulse); impulse[2 * Z * O] = 1.f; }
  void insertDiscontinuity(float subframe, T magnitude) {
    if (!(-1.f < subframe && subframe <= 0.f)) return;
    for (int offset = 0; offset < 2 * Z; offset++) { const float impulseIndex = (offset - subframe) * O; const int target = (position + offset) % (2 * Z); buffer[target] += magnitude * (-1.f + math::interpolateLinear(impulse, impulseIndex)); }
  }
  T process() { const T value = buffer[position]; buffer[position] = T(0.f); position = (position + 1) % (2 * Z); return value; }
};

template <size_t CHANNELS, typename T = float>
struct Frame {
  T samples[CHANNELS]{};
};

template <int MAX_CHANNELS>
struct SampleRateConverter {
  int channels = MAX_CHANNELS;
  int inRate = 44100;
  int outRate = 44100;
  int quality = 0;
  double phase = 0.0;
  void setChannels(int next) { channels = std::clamp(next, 0, MAX_CHANNELS); }
  void setQuality(int next) { quality = next; }
  void setRates(int nextInRate, int nextOutRate) { inRate = std::max(1, nextInRate); outRate = std::max(1, nextOutRate); }
  void process(const float* input, int inputStride, int* inputFrames, float* output, int outputStride, int* outputFrames) {
    const int available = std::max(0, *inputFrames), capacity = std::max(0, *outputFrames);int produced = 0;const double step = static_cast<double>(inRate) / outRate;
    while (produced < capacity && phase < available) { const int first = std::min(static_cast<int>(phase), std::max(available - 1, 0)), second = std::min(first + 1, std::max(available - 1, 0));const float fraction = static_cast<float>(phase - first);for (int channel = 0; channel < channels; channel++) output[produced * outputStride + channel] = input[first * inputStride + channel] + (input[second * inputStride + channel] - input[first * inputStride + channel]) * fraction;phase += step;produced++; }
    phase = std::max(0.0, phase - available);*inputFrames = available;*outputFrames = produced;
  }
  void process(const Frame<MAX_CHANNELS>* input, int* inputFrames, Frame<MAX_CHANNELS>* output, int* outputFrames) { process(reinterpret_cast<const float*>(input), MAX_CHANNELS, inputFrames, reinterpret_cast<float*>(output), MAX_CHANNELS, outputFrames); }
};

template <typename T, size_t S>
struct RingBuffer {
  size_t start = 0;
  size_t end = 0;
  T data[S]{};
  void push(T value) { data[end % S] = value; end++; }
  void pushBuffer(const T* values, size_t count) { for (size_t index = 0; index < count; index++) push(values[index]); }
  T shift() { return data[start++ % S]; }
  void shiftBuffer(T* target, size_t count) { for (size_t index = 0; index < count; index++) target[index] = shift(); }
  void clear() { start = end; }
  bool empty() const { return start >= end; }
  bool full() const { return end - start >= S; }
  size_t size() const { return end - start; }
  size_t capacity() const { return S - size(); }
};

template <typename T, size_t S>
struct DoubleRingBuffer {
  size_t start = 0;
  size_t end = 0;
  T data[2 * S]{};
  void push(T value) { const size_t index = end % S; data[index] = value; data[index + S] = value; end++; }
  T shift() { return data[start++ % S]; }
  void clear() { start = end; }
  bool empty() const { return start >= end; }
  bool full() const { return end - start >= S; }
  size_t size() const { return end - start; }
  size_t capacity() const { return S - size(); }
  T* endData() { return &data[end % S]; }
  void endIncr(size_t count) {
    const size_t index = end % S;
    const size_t wrapped = index + count;
    const size_t firstEnd = std::min(wrapped, S);
    std::memcpy(&data[S + index], &data[index], sizeof(T) * (firstEnd - index));
    if (wrapped > S) std::memcpy(data, &data[S], sizeof(T) * (wrapped - S));
    end += count;
  }
  const T* startData() const { return &data[start % S]; }
  void startIncr(size_t count) { start += count; }
};

// Rack-compatible uniformly partitioned overlap-add convolution. The desktop
// runtime delegates this to PFFFT; the standalone browser runtime keeps the
// same block contract with an allocation-free radix-2 FFT after construction.
struct RealTimeConvolver {
  using Complex = std::complex<float>;

  size_t blockSize = 0;
  size_t fftSize = 0;
  size_t kernelBlocks = 0;
  size_t inputPos = 0;
  std::vector<std::vector<Complex>> kernelFfts;
  std::vector<std::vector<Complex>> inputFfts;
  std::vector<Complex> scratch;
  std::vector<Complex> accumulated;
  std::vector<float> outputTail;

  explicit RealTimeConvolver(size_t nextBlockSize)
      : blockSize(nextBlockSize),
        fftSize(nextBlockSize * 2),
        scratch(fftSize),
        accumulated(fftSize),
        outputTail(blockSize) {}

  static void transform(std::vector<Complex>& values, bool inverse) {
    const size_t count = values.size();
    for (size_t index = 1, reversed = 0; index < count; ++index) {
      size_t bit = count >> 1;
      for (; reversed & bit; bit >>= 1) reversed ^= bit;
      reversed ^= bit;
      if (index < reversed) std::swap(values[index], values[reversed]);
    }
    for (size_t length = 2; length <= count; length <<= 1) {
      const float angle = (inverse ? 2.f : -2.f) * 3.14159265358979323846f / static_cast<float>(length);
      const Complex step(std::cos(angle), std::sin(angle));
      for (size_t offset = 0; offset < count; offset += length) {
        Complex twiddle(1.f, 0.f);
        for (size_t index = 0; index < length / 2; ++index) {
          const Complex even = values[offset + index];
          const Complex odd = values[offset + index + length / 2] * twiddle;
          values[offset + index] = even + odd;
          values[offset + index + length / 2] = even - odd;
          twiddle *= step;
        }
      }
    }
    if (inverse) {
      const float scale = 1.f / static_cast<float>(count);
      for (Complex& value : values) value *= scale;
    }
  }

  void setKernel(const float* kernel, size_t length) {
    kernelBlocks = kernel && length ? (length - 1) / blockSize + 1 : 0;
    inputPos = 0;
    kernelFfts.assign(kernelBlocks, std::vector<Complex>(fftSize));
    inputFfts.assign(kernelBlocks, std::vector<Complex>(fftSize));
    std::fill(outputTail.begin(), outputTail.end(), 0.f);
    for (size_t block = 0; block < kernelBlocks; ++block) {
      auto& frequency = kernelFfts[block];
      const size_t offset = block * blockSize;
      const size_t available = std::min(blockSize, length - offset);
      for (size_t index = 0; index < available; ++index) frequency[index] = Complex(kernel[offset + index], 0.f);
      transform(frequency, false);
    }
  }

  void processBlock(const float* input, float* output) {
    if (!kernelBlocks) {
      std::fill(output, output + blockSize, 0.f);
      return;
    }
    inputPos = (inputPos + 1) % kernelBlocks;
    std::fill(scratch.begin(), scratch.end(), Complex{});
    for (size_t index = 0; index < blockSize; ++index) scratch[index] = Complex(input[index], 0.f);
    transform(scratch, false);
    inputFfts[inputPos] = scratch;

    std::fill(accumulated.begin(), accumulated.end(), Complex{});
    for (size_t block = 0; block < kernelBlocks; ++block) {
      const size_t position = (inputPos + kernelBlocks - block) % kernelBlocks;
      for (size_t bin = 0; bin < fftSize; ++bin) accumulated[bin] += kernelFfts[block][bin] * inputFfts[position][bin];
    }
    transform(accumulated, true);
    for (size_t index = 0; index < blockSize; ++index) {
      output[index] = accumulated[index].real() + outputTail[index];
      outputTail[index] = accumulated[index + blockSize].real();
    }
  }
};

template <typename T = float>
struct TRCFilter {
  T c = 0.f;
  T xstate[1]{};
  T ystate[1]{};
  void reset() { xstate[0] = 0.f; ystate[0] = 0.f; }
  void setCutoff(T radians) { c = 2.f / radians; }
  void setCutoffFreq(T frequency) { setCutoff(T(6.2831853071795864769) * frequency); }
  void process(T input) { const T output = (input + xstate[0] - ystate[0] * (T(1) - c)) / (T(1) + c); xstate[0] = input; ystate[0] = output; }
  T lowpass() const { return ystate[0]; }
  T highpass() const { return xstate[0] - ystate[0]; }
};
using RCFilter = TRCFilter<float>;

template <int B_ORDER, int A_ORDER, typename T = float>
struct IIRFilter {
  T b[B_ORDER]{};
  T a[A_ORDER - 1]{};
  T x[B_ORDER - 1]{};
  T y[A_ORDER - 1]{};
  void reset() { for (auto& value : x) value = T(0.f); for (auto& value : y) value = T(0.f); }
  void setCoefficients(const T* numerator, const T* denominator) { for (int index = 0; index < B_ORDER; index++) b[index] = numerator[index]; for (int index = 0; index < A_ORDER - 1; index++) a[index] = denominator[index]; }
  T process(T input) {
    T output = b[0] * input;
    for (int index = 1; index < B_ORDER; index++) output += b[index] * x[index - 1];
    for (int index = 1; index < A_ORDER; index++) output -= a[index - 1] * y[index - 1];
    for (int index = B_ORDER - 1; index >= 2; index--) x[index - 1] = x[index - 2];
    for (int index = A_ORDER - 1; index >= 2; index--) y[index - 1] = y[index - 2];
    if constexpr (B_ORDER > 1) x[0] = input;
    if constexpr (A_ORDER > 1) y[0] = output;
    return output;
  }
  std::complex<T> getTransferFunction(T radians) {
    std::complex<T> numerator(b[0], T(0));
    std::complex<T> denominator(T(1), T(0));
    for (int index = 1; index < std::max(B_ORDER, A_ORDER); index++) {
      const T phase = T(-index) * radians;
      const std::complex<T> z(simd::cos(phase), simd::sin(phase));
      if (index < B_ORDER) numerator += b[index] * z;
      if (index < A_ORDER) denominator += a[index - 1] * z;
    }
    return numerator / denominator;
  }
  T getFrequencyResponse(T frequency) { return simd::abs(getTransferFunction(T(2 * M_PI) * frequency)); }
  T getFrequencyPhase(T frequency) { return simd::arg(getTransferFunction(T(2 * M_PI) * frequency)); }
};

template <typename T = float>
struct TBiquadFilter : IIRFilter<3, 3, T> {
  enum Type { LOWPASS_1POLE, HIGHPASS_1POLE, LOWPASS, HIGHPASS, LOWSHELF, HIGHSHELF, BANDPASS, PEAK, NOTCH, NUM_TYPES };
  TBiquadFilter() { setParameters(LOWPASS, 0.f, 0.f, 1.f); }
  void setParameters(Type type, float frequency, float quality, float gain) {
    static constexpr float pi = 3.14159265358979323846f;
    static constexpr float sqrtTwo = 1.4142135623730950488f;
    const float tangent = std::tan(pi * frequency);
    switch (type) {
      case LOWPASS_1POLE:
        this->a[0] = -std::exp(-2.f * pi * frequency); this->a[1] = 0.f;
        this->b[0] = 1.f + this->a[0]; this->b[1] = 0.f; this->b[2] = 0.f;
        break;
      case HIGHPASS_1POLE:
        this->a[0] = std::exp(-2.f * pi * (0.5f - frequency)); this->a[1] = 0.f;
        this->b[0] = 1.f - this->a[0]; this->b[1] = 0.f; this->b[2] = 0.f;
        break;
      case LOWPASS: {
        const float normalization = 1.f / (1.f + tangent / quality + tangent * tangent);
        this->b[0] = tangent * tangent * normalization; this->b[1] = 2.f * this->b[0]; this->b[2] = this->b[0];
        this->a[0] = 2.f * (tangent * tangent - 1.f) * normalization; this->a[1] = (1.f - tangent / quality + tangent * tangent) * normalization;
      } break;
      case HIGHPASS: {
        const float normalization = 1.f / (1.f + tangent / quality + tangent * tangent);
        this->b[0] = normalization; this->b[1] = -2.f * normalization; this->b[2] = normalization;
        this->a[0] = 2.f * (tangent * tangent - 1.f) * normalization; this->a[1] = (1.f - tangent / quality + tangent * tangent) * normalization;
      } break;
      case LOWSHELF: {
        const float rootGain = std::sqrt(gain);
        if (gain >= 1.f) {
          const float normalization = 1.f / (1.f + sqrtTwo * tangent + tangent * tangent);
          this->b[0] = (1.f + sqrtTwo * rootGain * tangent + gain * tangent * tangent) * normalization; this->b[1] = 2.f * (gain * tangent * tangent - 1.f) * normalization; this->b[2] = (1.f - sqrtTwo * rootGain * tangent + gain * tangent * tangent) * normalization;
          this->a[0] = 2.f * (tangent * tangent - 1.f) * normalization; this->a[1] = (1.f - sqrtTwo * tangent + tangent * tangent) * normalization;
        }
        else {
          const float normalization = 1.f / (1.f + sqrtTwo / rootGain * tangent + tangent * tangent / gain);
          this->b[0] = (1.f + sqrtTwo * tangent + tangent * tangent) * normalization; this->b[1] = 2.f * (tangent * tangent - 1.f) * normalization; this->b[2] = (1.f - sqrtTwo * tangent + tangent * tangent) * normalization;
          this->a[0] = 2.f * (tangent * tangent / gain - 1.f) * normalization; this->a[1] = (1.f - sqrtTwo / rootGain * tangent + tangent * tangent / gain) * normalization;
        }
      } break;
      case HIGHSHELF: {
        const float rootGain = std::sqrt(gain);
        if (gain >= 1.f) {
          const float normalization = 1.f / (1.f + sqrtTwo * tangent + tangent * tangent);
          this->b[0] = (gain + sqrtTwo * rootGain * tangent + tangent * tangent) * normalization; this->b[1] = 2.f * (tangent * tangent - gain) * normalization; this->b[2] = (gain - sqrtTwo * rootGain * tangent + tangent * tangent) * normalization;
          this->a[0] = 2.f * (tangent * tangent - 1.f) * normalization; this->a[1] = (1.f - sqrtTwo * tangent + tangent * tangent) * normalization;
        }
        else {
          const float normalization = 1.f / (1.f / gain + sqrtTwo / rootGain * tangent + tangent * tangent);
          this->b[0] = (1.f + sqrtTwo * tangent + tangent * tangent) * normalization; this->b[1] = 2.f * (tangent * tangent - 1.f) * normalization; this->b[2] = (1.f - sqrtTwo * tangent + tangent * tangent) * normalization;
          this->a[0] = 2.f * (tangent * tangent - 1.f / gain) * normalization; this->a[1] = (1.f / gain - sqrtTwo / rootGain * tangent + tangent * tangent) * normalization;
        }
      } break;
      case BANDPASS: {
        const float normalization = 1.f / (1.f + tangent / quality + tangent * tangent);
        this->b[0] = tangent / quality * normalization; this->b[1] = 0.f; this->b[2] = -this->b[0];
        this->a[0] = 2.f * (tangent * tangent - 1.f) * normalization; this->a[1] = (1.f - tangent / quality + tangent * tangent) * normalization;
      } break;
      case PEAK:
        if (gain >= 1.f) {
          const float normalization = 1.f / (1.f + tangent / quality + tangent * tangent);
          this->b[0] = (1.f + tangent / quality * gain + tangent * tangent) * normalization; this->b[1] = 2.f * (tangent * tangent - 1.f) * normalization; this->b[2] = (1.f - tangent / quality * gain + tangent * tangent) * normalization;
          this->a[0] = this->b[1]; this->a[1] = (1.f - tangent / quality + tangent * tangent) * normalization;
        }
        else {
          const float normalization = 1.f / (1.f + tangent / quality / gain + tangent * tangent);
          this->b[0] = (1.f + tangent / quality + tangent * tangent) * normalization; this->b[1] = 2.f * (tangent * tangent - 1.f) * normalization; this->b[2] = (1.f - tangent / quality + tangent * tangent) * normalization;
          this->a[0] = this->b[1]; this->a[1] = (1.f - tangent / quality / gain + tangent * tangent) * normalization;
        }
        break;
      case NOTCH: {
        const float normalization = 1.f / (1.f + tangent / quality + tangent * tangent);
        this->b[0] = (1.f + tangent * tangent) * normalization; this->b[1] = 2.f * (tangent * tangent - 1.f) * normalization; this->b[2] = this->b[0];
        this->a[0] = this->b[1]; this->a[1] = (1.f - tangent / quality + tangent * tangent) * normalization;
      } break;
      default: break;
    }
  }
};
using BiquadFilter = TBiquadFilter<float>;

template <typename T, typename Derivative>
void stepRK4(T time, T deltaTime, T* state, int count, Derivative derivative) {
  T k1[16]{}, k2[16]{}, k3[16]{}, k4[16]{}, temporary[16]{};
  derivative(time, state, k1);
  for (int index = 0; index < count; index++) temporary[index] = state[index] + k1[index] * deltaTime * 0.5f;
  derivative(time + deltaTime * 0.5f, temporary, k2);
  for (int index = 0; index < count; index++) temporary[index] = state[index] + k2[index] * deltaTime * 0.5f;
  derivative(time + deltaTime * 0.5f, temporary, k3);
  for (int index = 0; index < count; index++) temporary[index] = state[index] + k3[index] * deltaTime;
  derivative(time + deltaTime, temporary, k4);
  for (int index = 0; index < count; index++) state[index] += deltaTime * (k1[index] + 2.f * k2[index] + 2.f * k3[index] + k4[index]) / 6.f;
}

template <typename T = float>
struct TSchmittTrigger;

template <>
struct TSchmittTrigger<float> {
  enum State { Low, High, Uninitialized };
  int state = Low;
  enum Event { NONE = 0, TRIGGERED = 1, UNTRIGGERED = -1 };
  bool process(float voltage, float low = 0.1f, float highThreshold = 1.f) {
    if (state == Low && voltage >= highThreshold) { state = High; return true; }
    if (state == High && voltage <= low) state = Low;
    else if (state == Uninitialized && voltage >= highThreshold) state = High;
    else if (state == Uninitialized && voltage <= low) state = Low;
    return false;
  }
  Event processEvent(float voltage, float low = 0.f, float highThreshold = 1.f) {
    Event event = NONE;
    if (state == Low && voltage >= highThreshold) { state = High; event = TRIGGERED; }
    else if (state == High && voltage <= low) { state = Low; event = UNTRIGGERED; }
    else if (state == Uninitialized && voltage >= highThreshold) state = High;
    else if (state == Uninitialized && voltage <= low) state = Low;
    return event;
  }
  void reset() { state = Low; }
  bool isHigh() const { return state == High; }
};

template <>
struct TSchmittTrigger<simd::float_4> {
  TSchmittTrigger<float> lanes[4]{};
  simd::float_4 process(const simd::float_4& voltage, float low = 0.1f, float highThreshold = 1.f) {
    simd::float_4 result;
    for (int index = 0; index < 4; index++)
      result[index] = simd::rackWebFloatMask(lanes[index].process(voltage[index], low, highThreshold));
    return result;
  }
  void reset() { for (auto& lane : lanes) lane.reset(); }
  simd::float_4 isHigh() const {
    simd::float_4 result;
    for (int index = 0; index < 4; index++)
      result[index] = simd::rackWebFloatMask(lanes[index].isHigh());
    return result;
  }
};

using SchmittTrigger = TSchmittTrigger<float>;

struct BooleanTrigger {
  enum State : uint8_t { LOW, HIGH, UNINITIALIZED };
  union { State s = UNINITIALIZED; bool state; };
  enum Event { NONE = 0, TRIGGERED = 1, UNTRIGGERED = -1 };
  bool process(bool next) { const bool triggered = s == LOW && next; s = next ? HIGH : LOW; return triggered; }
  Event processEvent(bool next) { const Event event = s == LOW && next ? TRIGGERED : s == HIGH && !next ? UNTRIGGERED : NONE; s = next ? HIGH : LOW; return event; }
  void reset() { s = UNINITIALIZED; }
  bool isHigh() const { return s == HIGH; }
};

struct PulseGenerator {
  float remaining = 0.f;
  void trigger(float seconds = 1e-3f) { if (seconds > remaining) remaining = seconds; }
  bool process(float deltaTime) {
    if (remaining <= 0.f) return false;
    remaining -= deltaTime;
    return true;
  }
  void reset() { remaining = 0.f; }
  bool isHigh() const { return remaining > 0.f; }
};

template <typename T = float>
struct TTimer {
  T time = T(0);
  void reset() { time = 0.f; }
  T process(T deltaTime) { time += deltaTime; return time; }
  T getTime() const { return time; }
};

using Timer = TTimer<>;

struct ClockDivider {
  int division = 1;
  int clock = 0;
  void setDivision(int next) { division = std::max(1, next); clock %= division; }
  int getDivision() const { return division; }
  int getClock() const { return clock; }
  void reset() { clock = 0; }
  bool process() { if (++clock < division) return false; clock = 0; return true; }
};

template <typename T = float>
struct TSlewLimiter {
  T out = T(0.f);
  T rise = T(0.f);
  T fall = T(0.f);
  void reset() { out = T(0.f); }
  void setRise(T nextRise) { rise = nextRise; }
  void setFall(T nextFall) { fall = nextFall; }
  void setRiseFall(T nextRise, T nextFall) { rise = nextRise; fall = nextFall; }
  T process(float deltaTime, T input) {
    out = simd::clamp(input, out - fall * deltaTime, out + rise * deltaTime);
    return out;
  }
};

using SlewLimiter = TSlewLimiter<float>;

template <typename T = float>
struct TExponentialFilter {
  T out = T(0.f);
  T lambda = T(0.f);
  void reset() { out = T(0.f); }
  void setLambda(T next) { lambda = next; }
  void setTau(T tau) { lambda = T(1.f) / tau; }
  T process(T deltaTime, T input) {
    const T next = out + (input - out) * lambda * deltaTime;
    out = simd::ifelse(out == next, input, next);
    return out;
  }
  T process(T input) { return process(T(1.f), input); }
};
using ExponentialFilter = TExponentialFilter<float>;

template <typename T = float>
struct TExponentialSlewLimiter {
  T out = T(0.f);
  T riseLambda = T(0.f);
  T fallLambda = T(0.f);
  void reset() { out = T(0.f); }
  void setRiseFall(T nextRiseLambda, T nextFallLambda) {
    riseLambda = nextRiseLambda;
    fallLambda = nextFallLambda;
  }
  void setRiseFallTau(T riseTau, T fallTau) {
    riseLambda = T(1.f) / riseTau;
    fallLambda = T(1.f) / fallTau;
  }
  T process(T deltaTime, T input) {
    const T lambda = simd::ifelse(input > out, riseLambda, fallLambda);
    const T next = out + (input - out) * lambda * deltaTime;
    out = simd::ifelse(out == next, input, next);
    return out;
  }
  T process(T input) { return process(T(1.f), input); }
};
using ExponentialSlewLimiter = TExponentialSlewLimiter<float>;

struct VuMeter2 {
  enum Mode { PEAK, RMS };
  Mode mode = PEAK;
  float lambda = 10.f;
  union { float v = 0.f; float level; };
  void reset() { v = 0.f; }
  void process(float deltaTime, float value) {
    if (mode == RMS) { value *= value; v += (value - v) * lambda * deltaTime; }
    else { value = std::fabs(value); v = value >= v ? value : v + (value - v) * lambda * deltaTime; }
  }
  float getBrightness(float lowDb, float highDb) const {
    const float amplitude = mode == RMS ? std::sqrt(v) : v;
    const float db = 20.f * std::log10(std::max(amplitude, 1e-6f));
    if (lowDb == highDb) return db >= lowDb ? 1.f : 0.f;
    return std::clamp((db - lowDb) / (highDb - lowDb), 0.f, 1.f);
  }
};

struct VuMeter {
  float dBInterval = 3.f;
  float dBScaled = -INFINITY;
  void setValue(float value) { dBScaled = std::log10(std::fabs(value)) * 20.f / dBInterval; }
  float getBrightness(int index) const {
    if (index == 0) return dBScaled >= 0.f ? 1.f : 0.f;
    return rack::clamp(dBScaled + index, 0.f, 1.f);
  }
};

template <typename T>
T exp2_taylor5(T value) {
  const T integer = std::floor(value), fraction = value - integer;
  const T coefficients[] = {T(1.0), T(0.69315169353961), T(0.2401595990753), T(0.055817908652), T(0.008991698010), T(0.001879100722)};
  T polynomial = coefficients[5];
  for (int index = 4; index >= 0; index--) polynomial = polynomial * fraction + coefficients[index];
  return std::exp2(integer) * polynomial;
}
inline simd::float_4 exp2_taylor5(const simd::float_4& value) { simd::float_4 result; for (int index = 0; index < 4; index++) result[index] = exp2_taylor5(value[index]); return result; }
template <typename T>
T approxExp2_taylor5(T value) { return exp2_taylor5(value); }
} // namespace dsp

namespace random {
struct Xoroshiro128Plus {
  using result_type = uint64_t;
  uint64_t state[2]{};
  Xoroshiro128Plus() = default;
  explicit Xoroshiro128Plus(uint64_t first, uint64_t second = 0) { seed(first, second); }
  void seed(uint64_t first, uint64_t second = 0) { state[0] = first; state[1] = second; operator()(); }
  bool isSeeded() const { return state[0] || state[1]; }
  static uint64_t rotl(uint64_t value, int shift) { return (value << shift) | (value >> (64 - shift)); }
  uint64_t operator()() {
    const uint64_t first = state[0];
    uint64_t second = state[1];
    const uint64_t result = first + second;
    second ^= first;
    state[0] = rotl(first, 55) ^ second ^ (second << 14);
    state[1] = rotl(second, 36);
    return result;
  }
  static constexpr uint64_t min() { return 0; }
  static constexpr uint64_t max() { return UINT64_MAX; }
};
inline Xoroshiro128Plus generator{0x5a17c9e3u, 0x9e3779b97f4a7c15ull};
inline void init() {}
inline Xoroshiro128Plus& local() { return generator; }
inline void seed(uint32_t next) { generator.seed(next ? next : 1u, 0x9e3779b97f4a7c15ull); }
template <typename T>
T get() { return static_cast<T>(local()()); }
template <> inline uint32_t get<uint32_t>() { return static_cast<uint32_t>(local()() >> 32); }
template <> inline uint16_t get<uint16_t>() { return static_cast<uint16_t>(local()() >> 48); }
template <> inline uint8_t get<uint8_t>() { return static_cast<uint8_t>(local()() >> 56); }
template <> inline bool get<bool>() { return local()() >> 63; }
template <> inline float get<float>() { return static_cast<uint32_t>(local()() >> 32) * 2.32830629e-10f; }
template <> inline double get<double>() { return local()() * 5.421010862427522e-20; }
inline uint32_t u32() { return get<uint32_t>(); }
inline uint64_t u64() { return get<uint64_t>(); }
inline float uniform() { return get<float>(); }
inline float normal() {
  const float radius = std::sqrt(-2.f * std::log(1.f - uniform()));
  const float theta = 2.f * static_cast<float>(M_PI) * uniform();
  return radius * std::sin(theta);
}
} // namespace random

// Rack 1 compatibility helpers retained by older open-source plugins.
inline float randomUniform() { return random::uniform(); }

namespace string {
struct Version {
  int parts[4]{};
  Version() = default;
  Version(const char* value) {
    const char* cursor = value ? value : "";
    for (int index = 0; index < 4 && *cursor; index++) {
      while (*cursor && (*cursor < '0' || *cursor > '9')) cursor++;
      while (*cursor >= '0' && *cursor <= '9') parts[index] = parts[index] * 10 + (*cursor++ - '0');
    }
  }
  bool operator<(const Version& other) const { for (int index = 0; index < 4; index++) { if (parts[index] != other.parts[index]) return parts[index] < other.parts[index]; } return false; }
};
template <typename... Args>
std::string f(const char* format, Args... args) {
  char buffer[256]{};
  std::snprintf(buffer, sizeof(buffer), format, args...);
  return buffer;
}
inline std::string trim(const std::string& value) {
  const auto first = value.find_first_not_of(" \t\n\r\f\v");
  if (first == std::string::npos) return {};
  const auto last = value.find_last_not_of(" \t\n\r\f\v");
  return value.substr(first, last - first + 1);
}
inline std::string lowercase(std::string value) { for (char& character : value) character = static_cast<char>(std::tolower(static_cast<unsigned char>(character))); return value; }
inline std::string filename(const std::string& path) {
  const auto separator = path.find_last_of("/\\");
  return separator == std::string::npos ? path : path.substr(separator + 1);
}
inline std::string toBase64(const void* data, std::size_t size) {
  static constexpr char alphabet[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const auto* bytes = static_cast<const uint8_t*>(data);
  std::string result;
  result.reserve(((size + 2) / 3) * 4);
  for (std::size_t index = 0; index < size; index += 3) {
    const uint32_t first = bytes[index];
    const uint32_t second = index + 1 < size ? bytes[index + 1] : 0;
    const uint32_t third = index + 2 < size ? bytes[index + 2] : 0;
    const uint32_t value = (first << 16) | (second << 8) | third;
    result.push_back(alphabet[(value >> 18) & 63]);
    result.push_back(alphabet[(value >> 12) & 63]);
    result.push_back(index + 1 < size ? alphabet[(value >> 6) & 63] : '=');
    result.push_back(index + 2 < size ? alphabet[value & 63] : '=');
  }
  return result;
}
inline std::vector<uint8_t> fromBase64(const std::string& encoded) {
  auto decode = [](unsigned char character) -> int {
    if (character >= 'A' && character <= 'Z') return character - 'A';
    if (character >= 'a' && character <= 'z') return character - 'a' + 26;
    if (character >= '0' && character <= '9') return character - '0' + 52;
    if (character == '+') return 62;
    if (character == '/') return 63;
    return -1;
  };
  std::vector<uint8_t> result;
  result.reserve((encoded.size() / 4) * 3);
  uint32_t value = 0;
  int bits = -8;
  for (unsigned char character : encoded) {
    if (character == '=') break;
    const int decoded = decode(character);
    if (decoded < 0) continue;
    value = (value << 6) | static_cast<uint32_t>(decoded);
    bits += 6;
    if (bits >= 0) { result.push_back(static_cast<uint8_t>((value >> bits) & 0xff)); bits -= 8; }
  }
  return result;
}
} // namespace string
namespace strings = string;

} // namespace rack

using rack::Input;
using rack::Light;
using rack::Module;
using rack::Output;
using rack::Param;
using rack::ProcessArgs;
using rack::ResetEvent;
using rack::eucDiv;
using rack::eucDivMod;
using rack::eucMod;
using rack::crossfade;
using rack::clamp;
using rack::rescale;
using rack::dsp::exp2_taylor5;
using rack::dsp::DoubleRingBuffer;
using rack::dsp::Frame;
using rack::dsp::RCFilter;
using rack::dsp::SampleRateConverter;
#ifndef RACK_WEB_NO_GLOBAL_SCHMITT_TRIGGER_ALIAS
using rack::dsp::SchmittTrigger;
#endif
using rack::simd::float_4;
namespace rack::ui {
struct Menu {};
}
using namespace rack;
using GLuint = unsigned int;
struct FramebufferWidget {};
struct ImageData;
using std::abs;
#ifndef RACK_WEB_NO_GLOBAL_STD_MIN_MAX
using std::max;
using std::min;
#endif
using std::to_string;

template <typename Left, typename Right, std::enable_if_t<std::is_arithmetic_v<Left> && std::is_arithmetic_v<Right> && !std::is_same_v<Left, Right>, int> = 0>
constexpr std::common_type_t<Left, Right> min(Left left, Right right) {
  using Common = std::common_type_t<Left, Right>;
  return std::min(static_cast<Common>(left), static_cast<Common>(right));
}

template <typename Left, typename Right, std::enable_if_t<std::is_arithmetic_v<Left> && std::is_arithmetic_v<Right> && !std::is_same_v<Left, Right>, int> = 0>
constexpr std::common_type_t<Left, Right> max(Left left, Right right) {
  using Common = std::common_type_t<Left, Right>;
  return std::max(static_cast<Common>(left), static_cast<Common>(right));
}

// Rack's public rack.hpp umbrella also exposes the MIDI API. Keep the same
// include relationship so modules that use rack::midi without including
// midi.hpp themselves retain their official source contract.
#include "midi.hpp"
#include "dsp/midi.hpp"
