#include "rack_web_export.hpp"

struct CoreNotes : Module {
  enum ParamIds { NUM_PARAMS };
  enum InputIds { NUM_INPUTS };
  enum OutputIds { NUM_OUTPUTS };
  enum LightIds { NUM_LIGHTS };
  std::string text;
  CoreNotes() { config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS); }
  json_t* dataToJson() override { json_t* root=json_object();json_object_set_new(root,"text",json_string(text.c_str()));return root; }
  void dataFromJson(json_t* root) override { if(json_t* value=json_object_get(root,"text")){const char* source=json_string_value(value);text=source?source:"";} }
};

RACK_WEB_EXPORTS(CoreNotes)

