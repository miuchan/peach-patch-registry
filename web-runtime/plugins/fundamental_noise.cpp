// Monophonic colored-noise translation of Fundamental Noise 2.6.4.
// Original source: https://github.com/VCVRack/Fundamental (GPL-3.0-or-later).

#include "rack_web_export.hpp"
#include <algorithm>

struct FundamentalNoise : Module {
  enum ParamIds { NUM_PARAMS };
  enum InputIds { NUM_INPUTS };
  enum OutputIds { WHITE_OUTPUT, PINK_OUTPUT, RED_OUTPUT, VIOLET_OUTPUT, BLUE_OUTPUT, GRAY_OUTPUT, BLACK_OUTPUT, NUM_OUTPUTS };
  enum LightIds { NUM_LIGHTS };
  float pink0=0.f,pink1=0.f,pink2=0.f,red=0.f,lastWhite=0.f,lastPink=0.f;
  FundamentalNoise(){config(NUM_PARAMS,NUM_INPUTS,NUM_OUTPUTS,NUM_LIGHTS);}
  void process(const ProcessArgs& args) override {
    const float white=rack::random::normal(),gain=3.535533906f;
    pink0=.99765f*pink0+white*.099046f; pink1=.963f*pink1+white*.2965164f; pink2=.57f*pink2+white*1.0526913f;
    const float pink=(pink0+pink1+pink2+white*.1848f)*.2f;
    const float redCoefficient=std::clamp(125.663706f*args.sampleTime,0.f,1.f);red+=(white-red)*redCoefficient;
    const float violet=(white-lastWhite)*.70710678f,blue=(pink-lastPink)*1.41844f;lastWhite=white;lastPink=pink;
    const float gray=std::clamp(white*.55f+violet*.28f+pink*.17f,-4.f,4.f),black=rack::random::uniform()*2.f-1.f;
    outputs[WHITE_OUTPUT].setVoltage(white*gain);outputs[PINK_OUTPUT].setVoltage(pink*gain);outputs[RED_OUTPUT].setVoltage(red*gain*8.f);
    outputs[VIOLET_OUTPUT].setVoltage(violet*gain);outputs[BLUE_OUTPUT].setVoltage(blue*gain);outputs[GRAY_OUTPUT].setVoltage(gray*gain);outputs[BLACK_OUTPUT].setVoltage(black*5.f);
  }
};

RACK_WEB_EXPORTS(FundamentalNoise)
