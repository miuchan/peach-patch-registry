// DSP-only polyphonic web translation of Fundamental ADSR 2.6.4.
// Original source: https://github.com/VCVRack/Fundamental
// Copyright VCV, licensed GPL-3.0-or-later.

#include "rack_web_export.hpp"
#include <algorithm>

struct FundamentalADSR : Module {
  enum ParamIds{ATTACK_PARAM,DECAY_PARAM,SUSTAIN_PARAM,RELEASE_PARAM,ATTACK_CV_PARAM,DECAY_CV_PARAM,SUSTAIN_CV_PARAM,RELEASE_CV_PARAM,PUSH_PARAM,NUM_PARAMS};
  enum InputIds{ATTACK_INPUT,DECAY_INPUT,SUSTAIN_INPUT,RELEASE_INPUT,GATE_INPUT,RETRIG_INPUT,NUM_INPUTS};
  enum OutputIds{ENVELOPE_OUTPUT,NUM_OUTPUTS};
  enum LightIds{ATTACK_LIGHT,DECAY_LIGHT,SUSTAIN_LIGHT,RELEASE_LIGHT,PUSH_LIGHT,NUM_LIGHTS};
  static constexpr float MIN_TIME=1e-3f,LAMBDA_BASE=10000.f,ATT_TARGET=1.2f;
  float envelopes[16]{};bool gates[16]{},attacking[16]{};dsp::SchmittTrigger retriggers[16];
  FundamentalADSR(){config(NUM_PARAMS,NUM_INPUTS,NUM_OUTPUTS,NUM_LIGHTS);configParam(ATTACK_PARAM,0,1,.5,"Attack");configParam(DECAY_PARAM,0,1,.5,"Decay");configParam(SUSTAIN_PARAM,0,1,.5,"Sustain");configParam(RELEASE_PARAM,0,1,.5,"Release");for(int id=ATTACK_CV_PARAM;id<=RELEASE_CV_PARAM;id++)configParam(id,-1,1,0,"CV");configParam(PUSH_PARAM,0,1,0,"Push");}
  float controlled(int paramId,int inputId,int cvParamId,int channel)const{return std::clamp(params[paramId].getValue()+(inputs[inputId].isConnected()?inputs[inputId].getPolyVoltage(channel)/10.f*params[cvParamId].getValue():0.f),0.f,1.f);}
  void process(const ProcessArgs& args)override{
    const int channels=std::max({polyphony,inputs[ATTACK_INPUT].getChannels(),inputs[DECAY_INPUT].getChannels(),inputs[SUSTAIN_INPUT].getChannels(),inputs[RELEASE_INPUT].getChannels(),inputs[GATE_INPUT].getChannels(),inputs[RETRIG_INPUT].getChannels()});outputs[ENVELOPE_OUTPUT].setChannels(channels);
    for(int channel=0;channel<channels;channel++){
      const bool nextGate=params[PUSH_PARAM].getValue()>0||inputs[GATE_INPUT].getPolyVoltage(channel)>=1;
      if(nextGate&&!gates[channel])attacking[channel]=true;if(retriggers[channel].process(inputs[RETRIG_INPUT].getPolyVoltage(channel)))attacking[channel]=true;gates[channel]=nextGate;if(!gates[channel])attacking[channel]=false;
      const float sustain=controlled(SUSTAIN_PARAM,SUSTAIN_INPUT,SUSTAIN_CV_PARAM,channel),attackLambda=std::pow(LAMBDA_BASE,-controlled(ATTACK_PARAM,ATTACK_INPUT,ATTACK_CV_PARAM,channel))/MIN_TIME,decayLambda=std::pow(LAMBDA_BASE,-controlled(DECAY_PARAM,DECAY_INPUT,DECAY_CV_PARAM,channel))/MIN_TIME,releaseLambda=std::pow(LAMBDA_BASE,-controlled(RELEASE_PARAM,RELEASE_INPUT,RELEASE_CV_PARAM,channel))/MIN_TIME;
      const float target=attacking[channel]?ATT_TARGET:(gates[channel]?sustain:0),lambda=attacking[channel]?attackLambda:(gates[channel]?decayLambda:releaseLambda);envelopes[channel]+=(target-envelopes[channel])*lambda*args.sampleTime;if(envelopes[channel]>=1)attacking[channel]=false;outputs[ENVELOPE_OUTPUT].setVoltage(10*envelopes[channel],channel);
    }
    const float sustain=controlled(SUSTAIN_PARAM,SUSTAIN_INPUT,SUSTAIN_CV_PARAM,0),envelope=envelopes[0];const bool gate=gates[0],attack=attacking[0];lights[ATTACK_LIGHT].setBrightness(gate&&attack);lights[DECAY_LIGHT].setBrightness(gate&&!attack&&envelope>sustain+.01f);lights[SUSTAIN_LIGHT].setBrightness(gate&&!attack&&std::abs(envelope-sustain)<=.01f);lights[RELEASE_LIGHT].setBrightness(!gate&&envelope>=.01f);lights[PUSH_LIGHT].setBrightness(gate);
  }
};

RACK_WEB_EXPORTS(FundamentalADSR)
