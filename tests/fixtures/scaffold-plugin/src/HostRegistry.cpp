#include "HostRegistry.hpp"

HostRegistry hostRegistry;
const int HostRegistry::pattern[2] = {1, 2};
float hostDefaultValue = 4.f;

void loadHostDefault(float* value) {
  *value = hostDefaultValue;
}

void createHostMenu(ui::Menu*, SvgPanel*) {}
