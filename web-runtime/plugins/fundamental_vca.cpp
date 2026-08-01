// DSP-only web translation of Fundamental VCA 2.6.4.
// Original source: https://github.com/VCVRack/Fundamental
// Copyright VCV, licensed GPL-3.0-or-later.

#include "rack_web_export.hpp"
#include <algorithm>

struct FundamentalVCA : Module {
  enum ParamIds { LEVEL1_PARAM, LEVEL2_PARAM, NUM_PARAMS };
  enum InputIds { EXP1_INPUT, LIN1_INPUT, IN1_INPUT, EXP2_INPUT, LIN2_INPUT, IN2_INPUT, NUM_INPUTS };
  enum OutputIds { OUT1_OUTPUT, OUT2_OUTPUT, NUM_OUTPUTS };
  enum LightIds { NUM_LIGHTS };
  FundamentalVCA(){config(NUM_PARAMS,NUM_INPUTS,NUM_OUTPUTS);configParam(LEVEL1_PARAM,0,1,1,"Channel 1 level");configParam(LEVEL2_PARAM,0,1,1,"Channel 2 level");}
  void channel(int inputId,int linearId,int exponentialId,int outputId,int levelId){
    const int channels=std::max({polyphony,inputs[inputId].getChannels(),inputs[linearId].getChannels(),inputs[exponentialId].getChannels()});
    outputs[outputId].setChannels(channels);
    for(int channel=0;channel<channels;channel++){
      float value=inputs[inputId].getPolyVoltage(channel)*params[levelId].getValue();
      if(inputs[linearId].isConnected())value*=std::clamp(inputs[linearId].getPolyVoltage(channel)/10.f,0.f,1.f);
      if(inputs[exponentialId].isConnected()){const float cv=std::clamp(inputs[exponentialId].getPolyVoltage(channel)/10.f,0.f,1.f);value*=(std::pow(50.f,cv)-1.f)/49.f;}
      outputs[outputId].setVoltage(value,channel);
    }
  }
  void process(const ProcessArgs&) override{channel(IN1_INPUT,LIN1_INPUT,EXP1_INPUT,OUT1_OUTPUT,LEVEL1_PARAM);channel(IN2_INPUT,LIN2_INPUT,EXP2_INPUT,OUT2_OUTPUT,LEVEL2_PARAM);}
};

RACK_WEB_EXPORTS(FundamentalVCA)
