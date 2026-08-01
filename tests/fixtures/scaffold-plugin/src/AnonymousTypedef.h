#pragma once

typedef struct {
  int version;
} FixtureCInterface;

typedef struct {
  FixtureCInterface* interfacePointer;
} FixtureCMessage;
