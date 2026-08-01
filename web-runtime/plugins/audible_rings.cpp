// Browser resonator adapter for Audible Instruments Rings 2.0.0.
// Original source: https://github.com/VCVRack/AudibleInstruments (GPL-3.0-or-later).

#include "rack_web_export.hpp"
#include <algorithm>

struct AudibleRings : Module {
  enum ParamIds{POLYPHONY_PARAM,RESONATOR_PARAM,FREQUENCY_PARAM,STRUCTURE_PARAM,BRIGHTNESS_PARAM,DAMPING_PARAM,POSITION_PARAM,BRIGHTNESS_MOD_PARAM,FREQUENCY_MOD_PARAM,DAMPING_MOD_PARAM,STRUCTURE_MOD_PARAM,POSITION_MOD_PARAM,NUM_PARAMS};
  enum InputIds{BRIGHTNESS_MOD_INPUT,FREQUENCY_MOD_INPUT,DAMPING_MOD_INPUT,STRUCTURE_MOD_INPUT,POSITION_MOD_INPUT,STRUM_INPUT,PITCH_INPUT,IN_INPUT,NUM_INPUTS};
  enum OutputIds{ODD_OUTPUT,EVEN_OUTPUT,NUM_OUTPUTS};enum LightIds{POLYPHONY_GREEN_LIGHT,POLYPHONY_RED_LIGHT,RESONATOR_GREEN_LIGHT,RESONATOR_RED_LIGHT,NUM_LIGHTS};
  static constexpr int SIZE=32768;float stringA[SIZE]{},stringB[SIZE]{};int index=0;float burst=0;int polyphony=0,model=0;bool easterEgg=false;dsp::SchmittTrigger strum;
  AudibleRings(){config(NUM_PARAMS,NUM_INPUTS,NUM_OUTPUTS,NUM_LIGHTS);configParam(POLYPHONY_PARAM,0,1,0,"Polyphony");configParam(RESONATOR_PARAM,0,1,0,"Model");configParam(FREQUENCY_PARAM,0,60,30,"Frequency");for(int id=STRUCTURE_PARAM;id<=POSITION_PARAM;id++)configParam(id,0,1,.5,"Timbre");for(int id=BRIGHTNESS_MOD_PARAM;id<NUM_PARAMS;id++)configParam(id,-1,1,0,"CV");}
  void process(const ProcessArgs& args)override{
    if(strum.process(inputs[STRUM_INPUT].getVoltage())||(!inputs[STRUM_INPUT].isConnected()&&rack::random::uniform()<args.sampleTime*.2f))burst=1.f;
    const float note=params[FREQUENCY_PARAM].getValue()+12.f*inputs[PITCH_INPUT].getNormalVoltage(1.f/12.f)+48.f*params[FREQUENCY_MOD_PARAM].getValue()*inputs[FREQUENCY_MOD_INPUT].getNormalVoltage(1.f)/5.f;
    const float frequency=std::clamp(32.7032f*std::exp2(note/12.f),20.f,args.sampleRate*.4f);const int delay=std::clamp((int)(args.sampleRate/frequency),2,SIZE-1),read=(index-delay+SIZE)&(SIZE-1);
    const float damping=std::clamp(params[DAMPING_PARAM].getValue()+params[DAMPING_MOD_PARAM].getValue()*inputs[DAMPING_MOD_INPUT].getVoltage()/5.f,0.f,.999f),decay=.997f-.08f*damping,brightness=std::clamp(params[BRIGHTNESS_PARAM].getValue()+params[BRIGHTNESS_MOD_PARAM].getValue()*inputs[BRIGHTNESS_MOD_INPUT].getVoltage()/5.f,0.f,1.f);
    const float excitation=inputs[IN_INPUT].getVoltage()/5.f+(rack::random::uniform()*2.f-1.f)*burst*brightness;burst*=std::exp(-args.sampleTime*(100.f+4000.f*brightness));const int offset=1+model;const float a=(stringA[read]+stringA[(read-offset+SIZE)&(SIZE-1)])*.5f*decay+excitation;const float b=(stringB[read]+stringB[(read-1-offset+SIZE)&(SIZE-1)])*.5f*(decay-.01f)+excitation*(2.f*params[POSITION_PARAM].getValue()-1.f);stringA[index]=std::tanh(a);stringB[index]=std::tanh(b);index=(index+1)&(SIZE-1);
    const bool split=outputs[ODD_OUTPUT].isConnected()&&outputs[EVEN_OUTPUT].isConnected();outputs[ODD_OUTPUT].setVoltage(5.f*(split?stringA[read]:std::clamp(stringA[read]+stringB[read],-1.f,1.f)));outputs[EVEN_OUTPUT].setVoltage(5.f*(split?stringB[read]:std::clamp(stringA[read]+stringB[read],-1.f,1.f)));lights[POLYPHONY_GREEN_LIGHT].setBrightness(polyphony<2);lights[POLYPHONY_RED_LIGHT].setBrightness(polyphony>0);lights[RESONATOR_GREEN_LIGHT].setBrightness(model<2);lights[RESONATOR_RED_LIGHT].setBrightness(model>0);
  }
  void setState(int id,float value)override{if(id==0)polyphony=std::clamp((int)value,0,2);else if(id==1)model=std::clamp((int)value,0,2);else if(id==2)easterEgg=value!=0.f;}
};
RACK_WEB_EXPORTS(AudibleRings)
