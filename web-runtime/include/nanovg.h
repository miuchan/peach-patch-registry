#pragma once

// Rack modules occasionally keep their NanoVG-backed display state in the
// same translation unit as their DSP helpers. The browser rack renders those
// displays in React/canvas, so the audio-only WASM adapter only needs the
// NanoVG ABI surface to remain link-compatible.
struct NVGcontext {};

struct NVGcolor {
  float r;
  float g;
  float b;
  float a;
};

inline NVGcolor nvgRGBA(unsigned char r, unsigned char g, unsigned char b, unsigned char a) {
  constexpr float scale = 1.f / 255.f;
  return {r * scale, g * scale, b * scale, a * scale};
}

inline void nvgBeginPath(NVGcontext*) {}
inline void nvgClosePath(NVGcontext*) {}
inline void nvgFill(NVGcontext*) {}
inline void nvgFillColor(NVGcontext*, NVGcolor) {}
inline void nvgLineTo(NVGcontext*, float, float) {}
inline void nvgMoveTo(NVGcontext*, float, float) {}
inline void nvgRect(NVGcontext*, float, float, float, float) {}
inline void nvgResetScissor(NVGcontext*) {}
inline void nvgScissor(NVGcontext*, float, float, float, float) {}
inline void nvgStroke(NVGcontext*) {}
inline void nvgStrokeColor(NVGcontext*, NVGcolor) {}
inline void nvgStrokeWidth(NVGcontext*, float) {}
