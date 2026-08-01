#pragma once

// sst-plugininfra normally generates this header during its CMake configure
// step. Direct Rack source adapters do not run the plugin's native build, so
// select the browser toolchain's C++17 filesystem implementation explicitly.
#include <filesystem>
#include <string>
#include <utility>

namespace fs = std::filesystem;

#define SST_PLUGINFRA_PLATFORM_FS 1

inline std::string path_to_string(const fs::path& path) {
  return path.generic_string();
}

template <typename T>
inline fs::path string_to_path(T&& path) {
  return fs::path(std::forward<T>(path));
}

inline void string_to_path(fs::path) = delete;
