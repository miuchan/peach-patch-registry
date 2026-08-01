if (json_t* selectedJson = json_object_get(root, "selected"))
  selected = json_integer_value(selectedJson);
