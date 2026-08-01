#include "rack.hpp"
#include "VisualBase.hpp"

enum class FixtureTheme { LIGHT, DARK };
struct FixtureChoice : LedDisplayChoice {};
struct FixtureQuantity : ParamQuantity {
  float getMinValue() const override { return -1.f; }
  float getMaxValue() const override { return 1.f; }
};

struct VisualOnlyModule : fixture::VisualBase {
  NVGcolor foreground = nvgRGBf(0.1f, 0.2f, 0.3f);
  std::string text = "Fixture";
  FixtureTheme panelTheme = loadDefaultTheme();

  VisualOnlyModule() {
    config(0, 0, 0, 2);
    configLight(0, "Left link");
    configLight(1, "Right link");
  }

  void process(const ProcessArgs&) override {
    lights[0].setBrightness(leftExpander.module && leftExpander.module->model == modelVisualNeighbor);
    lights[1].setBrightness(rightExpander.module && rightExpander.module->model == modelVisualNeighbor);
  }

  json_t* dataToJson() override {
    json_t* root = json_object();
    json_object_set_new(root, "text", json_string(text.c_str()));
    json_object_set_new(root, "foreground", json_string(color::toHexString(foreground).c_str()));
    return root;
  }

  void dataFromJson(json_t* root) override {
    if (json_t* value = json_object_get(root, "text")) text = json_string_value(value);
    if (json_t* value = json_object_get(root, "foreground")) foreground = color::fromHexString(json_string_value(value));
  }
};

struct VisualOnlyWidget : ModuleWidget {};
Model* modelVisualOnly = createModel<VisualOnlyModule, VisualOnlyWidget>("VisualOnly");
