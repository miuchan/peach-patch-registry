export function browserTdScopeAdapterSource(target,manifest,license,definitionFile,registrationFile){
  return `// Browser adapter for ${target.key}, preserving the source Temporal Deck expander protocol.
// Source: ${manifest.sourceUrl} (${definitionFile}; registered in ${registrationFile})
// License: ${license}

#include "rack_web_export.hpp"
#include "TemporalDeckExpanderProtocol.hpp"
#include <array>
#include <cmath>

struct RackWebTdScopeModule : Module {
  enum LightId { LINK_LIGHT, PREVIEW_LIGHT, LIGHTS_LEN };
  static constexpr int NUM_PARAMS = 0, NUM_INPUTS = 0, NUM_OUTPUTS = 0, NUM_LIGHTS = LIGHTS_LEN;
  static constexpr int kRows = 256;
  static constexpr int kVisualHeader = 8;
  std::array<float, kVisualHeader + kRows * 4> rackWebVisual {};
  int scopeDisplayRangeMode = 3;
  bool scopeVerticalInverted = false;
  int scopeChannelMode = 0;
  int scopeColorScheme = 0;
  int scopeColorSchemeVersion = 2;
  float scopeColorBrightness = .5f;
  bool debugUseGlShaderRenderer = true;
  bool debugFramebufferCacheEnabled = true;
  int debugRenderMode = 7;
  int debugUiPublishRateMode = 0;
  uint64_t requestSeq = 0;
  float requestTimer = 0.f;

  RackWebTdScopeModule() {
    config(0, 0, 0, LIGHTS_LEN);
  }

  int rackWebVisualCount() const override { return static_cast<int>(rackWebVisual.size()); }
  float* rackWebVisualBuffer() override {
    rackWebVisual.fill(0.f);
    const bool linked = leftExpander.module != nullptr;
    const auto* message = reinterpret_cast<const temporaldeck_expander::HostToDisplay*>(leftExpander.consumerMessage);
    const bool valid = linked && message && message->magic == temporaldeck_expander::MAGIC &&
      message->version == temporaldeck_expander::VERSION &&
      message->size == sizeof(temporaldeck_expander::HostToDisplay);
    const bool preview = valid && (message->flags & temporaldeck_expander::FLAG_PREVIEW_VALID) != 0u;
    rackWebVisual[0] = linked ? 1.f : 0.f;
    rackWebVisual[1] = preview ? 1.f : 0.f;
    if (!preview) return rackWebVisual.data();
    const uint32_t count = std::min<uint32_t>(message->scopeBinCount, temporaldeck_expander::SCOPE_BIN_COUNT);
    const bool stereo = scopeChannelMode == 1 &&
      (message->flags & temporaldeck_expander::FLAG_SCOPE_STEREO) != 0u;
    float fullScale = scopeDisplayRangeMode == 1 ? 10.f : scopeDisplayRangeMode == 2 ? 2.5f : 5.f;
    if (scopeDisplayRangeMode == 3) {
      float peak = .25f;
      for (uint32_t index = 0; index < count; ++index) {
        const auto& left = message->scope[index];
        if (temporaldeck_expander::isScopeBinValid(left))
          peak = std::max(peak, float(std::max(std::abs(int(left.min)), std::abs(int(left.max)))) / 32767.f * 10.f);
        if (stereo) {
          const auto& right = message->scopeRight[index];
          if (temporaldeck_expander::isScopeBinValid(right))
            peak = std::max(peak, float(std::max(std::abs(int(right.min)), std::abs(int(right.max)))) / 32767.f * 10.f);
        }
      }
      fullScale = clamp(peak * 1.08f, .25f, 10.f);
    }
    rackWebVisual[2] = static_cast<float>(message->flags);
    rackWebVisual[3] = message->sampleRate;
    rackWebVisual[4] = clamp(message->lagSamples / std::max(message->accessibleLagSamples, 1.f), 0.f, 1.f);
    rackWebVisual[5] = fullScale;
    rackWebVisual[6] = float(kRows);
    rackWebVisual[7] = stereo ? 1.f : 0.f;
    for (int row = 0; row < kRows; ++row) {
      const uint32_t source = count > 1 ? uint32_t((uint64_t(row) * uint64_t(count - 1)) / uint64_t(kRows - 1)) : 0u;
      const int target = kVisualHeader + row * 4;
      auto normalize = [fullScale](int16_t sample) {
        return clamp((float(sample) / 32767.f * 10.f) / std::max(fullScale, .001f), -1.f, 1.f);
      };
      if (count && temporaldeck_expander::isScopeBinValid(message->scope[source])) {
        rackWebVisual[target] = normalize(message->scope[source].min);
        rackWebVisual[target + 1] = normalize(message->scope[source].max);
      }
      if (stereo && count && temporaldeck_expander::isScopeBinValid(message->scopeRight[source])) {
        rackWebVisual[target + 2] = normalize(message->scopeRight[source].min);
        rackWebVisual[target + 3] = normalize(message->scopeRight[source].max);
      }
    }
    return rackWebVisual.data();
  }

  json_t* dataToJson() override {
    json_t* root = json_object();
    json_object_set_new(root, "scopeDisplayRangeMode", json_integer(scopeDisplayRangeMode));
    json_object_set_new(root, "scopeVerticalInverted", json_boolean(scopeVerticalInverted));
    json_object_set_new(root, "scopeChannelMode", json_integer(scopeChannelMode));
    json_object_set_new(root, "scopeColorScheme", json_integer(scopeColorScheme));
    json_object_set_new(root, "scopeColorSchemeVersion", json_integer(scopeColorSchemeVersion));
    json_object_set_new(root, "scopeColorBrightness", json_real(scopeColorBrightness));
    json_object_set_new(root, "debugUseGlShaderRenderer", json_boolean(debugUseGlShaderRenderer));
    json_object_set_new(root, "debugFramebufferCacheEnabled", json_boolean(debugFramebufferCacheEnabled));
    json_object_set_new(root, "debugRenderMode", json_integer(debugRenderMode));
    json_object_set_new(root, "debugUiPublishRateMode", json_integer(debugUiPublishRateMode));
    return root;
  }

  void dataFromJson(json_t* root) override {
    if (!root) return;
    auto integer = [&](const char* key, int& value) { if (auto* item = json_object_get(root, key)) value = int(json_integer_value(item)); };
    auto boolean = [&](const char* key, bool& value) { if (auto* item = json_object_get(root, key)) value = json_boolean_value(item); };
    integer("scopeDisplayRangeMode", scopeDisplayRangeMode);
    boolean("scopeVerticalInverted", scopeVerticalInverted);
    integer("scopeChannelMode", scopeChannelMode);
    integer("scopeColorScheme", scopeColorScheme);
    integer("scopeColorSchemeVersion", scopeColorSchemeVersion);
    if (auto* item = json_object_get(root, "scopeColorBrightness")) scopeColorBrightness = clamp(float(json_number_value(item)), 0.f, 1.f);
    boolean("debugUseGlShaderRenderer", debugUseGlShaderRenderer);
    boolean("debugFramebufferCacheEnabled", debugFramebufferCacheEnabled);
    integer("debugRenderMode", debugRenderMode);
    integer("debugUiPublishRateMode", debugUiPublishRateMode);
  }

  void setState(int id, float value) override {
    switch (id) {
      case 0: scopeDisplayRangeMode = clamp(int(value), 0, 3); break;
      case 1: scopeVerticalInverted = value != 0.f; break;
      case 2: scopeChannelMode = clamp(int(value), 0, 1); break;
      case 3: scopeColorScheme = clamp(int(value), 0, 5); break;
      case 4: scopeColorSchemeVersion = int(value); break;
      case 5: scopeColorBrightness = clamp(value, 0.f, 1.f); break;
      case 6: debugUseGlShaderRenderer = value != 0.f; break;
      case 7: debugFramebufferCacheEnabled = value != 0.f; break;
      case 8: debugRenderMode = int(value); break;
      case 9: debugUiPublishRateMode = clamp(int(value), 0, 2); break;
      default: break;
    }
  }

  void process(const ProcessArgs& args) override {
    const bool linked = leftExpander.module != nullptr;
    const auto* message = reinterpret_cast<const temporaldeck_expander::HostToDisplay*>(leftExpander.consumerMessage);
    const bool valid = linked && message && message->magic == temporaldeck_expander::MAGIC &&
      message->version == temporaldeck_expander::VERSION &&
      message->size == sizeof(temporaldeck_expander::HostToDisplay);
    const bool preview = valid && (message->flags & temporaldeck_expander::FLAG_PREVIEW_VALID) != 0u;
    lights[LINK_LIGHT].setBrightness(linked ? 1.f : 0.f);
    lights[PREVIEW_LIGHT].setBrightness(preview ? 1.f : 0.f);
    if (!linked || !leftExpander.module || !leftExpander.module->rightExpander.producerMessage) return;
    requestTimer += args.sampleTime;
    if (requestTimer < 1.f / 30.f) return;
    requestTimer = std::fmod(requestTimer, 1.f / 30.f);
    auto* request = reinterpret_cast<temporaldeck_expander::DisplayToHost*>(leftExpander.module->rightExpander.producerMessage);
    temporaldeck_expander::populateDisplayRequest(
      request, ++requestSeq,
      scopeChannelMode == 1 ? temporaldeck_expander::SCOPE_FORMAT_STEREO : temporaldeck_expander::SCOPE_FORMAT_MONO);
    leftExpander.module->rightExpander.messageFlipRequested = true;
  }
};

RACK_WEB_EXPORTS(RackWebTdScopeModule)
`;
}
