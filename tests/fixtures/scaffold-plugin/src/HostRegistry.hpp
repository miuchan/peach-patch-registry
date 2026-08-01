#pragma once

static constexpr float fixtureMin = -3.f;
static constexpr float fixtureMax = 9.f;

struct HostRegistry {
  static const int slots = 2;
  static const int pattern[2];
  int selected = 2;

  void select(int value) { selected = value; }

  bool validateHost() {
    for (Widget* widget : APP->scene->rack->getModuleContainer()->children) {
      ModuleWidget* moduleWidget = static_cast<ModuleWidget*>(widget);
      if (moduleWidget) return true;
    }
    return false;
  }
};

extern HostRegistry hostRegistry;

struct FixtureRatioParam : ParamQuantity {
  std::string getUnit() override { return "x"; }
};

struct HostResetMenuItem : MenuItem {
  void onAction(const event::Action&) override {}
};

struct HostUiBase : ModuleWidget {};
struct HostUiDerived : HostUiBase {
  void draw(const DrawArgs&) override {}
};

void createHostMenu(ui::Menu* menu, SvgPanel* panel);
void loadHostDefault(float* value);
