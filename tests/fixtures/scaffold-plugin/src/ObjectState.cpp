#include "rack.hpp"

struct ObjectStateModule : Module {
  enum ParamIds { NUM_PARAMS };
  enum InputIds { NUM_INPUTS };
  enum OutputIds { VALUE_OUTPUT, NUM_OUTPUTS };
  enum LightIds { NUM_LIGHTS };
  struct Slot { int key = -1; bool high = false; };
  Slot slots[2];

  ObjectStateModule() { config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS); }
  void process(const ProcessArgs&) override { outputs[VALUE_OUTPUT].setVoltage(slots[0].high ? slots[0].key : 0); }
  json_t* dataToJson() override {
    json_t* root = json_object();json_t* slotsJson = json_array();
    for (int index = 0; index < 2; index++) { json_t* slotJson = json_object();json_object_set_new(slotJson,"key",json_integer(slots[index].key));json_object_set_new(slotJson,"high",json_boolean(slots[index].high));json_array_append_new(slotsJson,slotJson); }
    json_object_set_new(root,"slots",slotsJson);return root;
  }
  void dataFromJson(json_t* root) override {
    json_t* slotsJson=json_object_get(root,"slots");for(int index=0;index<2;index++){json_t* slotJson=json_array_get(slotsJson,index);if(json_t* value=json_object_get(slotJson,"key"))slots[index].key=json_integer_value(value);if(json_t* value=json_object_get(slotJson,"high"))slots[index].high=json_boolean_value(value);}
  }
};

struct ObjectStateWidget : ModuleWidget {};
Model* modelObjectState=createModel<ObjectStateModule,ObjectStateWidget>("ObjectState");
