#pragma once

#define FIXTURE_UNUSED_IMPLEMENTATION

struct UnrelatedAssetWidget {
  void load() {
    asset::plugin(pluginInstance, "res/unrelated.svg");
  }
};
