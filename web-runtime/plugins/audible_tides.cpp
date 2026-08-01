// Browser function-generator adapter for Audible Instruments Tides 2.0.0.
// Original source: https://github.com/VCVRack/AudibleInstruments (GPL-3.0-or-later).

#include "rack_web_export.hpp"
#include <algorithm>

struct AudibleTides : Module {
  enum ParamIds{MODE_PARAM,RANGE_PARAM,FREQUENCY_PARAM,FM_PARAM,SHAPE_PARAM,SLOPE_PARAM,SMOOTHNESS_PARAM,NUM_PARAMS};
  enum InputIds{SHAPE_INPUT,SLOPE_INPUT,SMOOTHNESS_INPUT,TRIG_INPUT,FREEZE_INPUT,PITCH_INPUT,FM_INPUT,LEVEL_INPUT,CLOCK_INPUT,NUM_INPUTS};
  enum OutputIds{HIGH_OUTPUT,LOW_OUTPUT,UNI_OUTPUT,BI_OUTPUT,NUM_OUTPUTS};
  enum LightIds{MODE_GREEN_LIGHT,MODE_RED_LIGHT,PHASE_GREEN_LIGHT,PHASE_RED_LIGHT,RANGE_GREEN_LIGHT,RANGE_RED_LIGHT,NUM_LIGHTS};
  float phase=0.f,smoothed=0.f;int mode=1,range=1;bool sheep=false;dsp::SchmittTrigger trigger;
  AudibleTides(){config(NUM_PARAMS,NUM_INPUTS,NUM_OUTPUTS,NUM_LIGHTS);configParam(MODE_PARAM,0,1,0,"Mode");configParam(RANGE_PARAM,0,1,0,"Range");configParam(FREQUENCY_PARAM,-48,48,0,"Frequency");configParam(FM_PARAM,-12,12,0,"FM");configParam(SHAPE_PARAM,-1,1,0,"Shape");configParam(SLOPE_PARAM,-1,1,0,"Slope");configParam(SMOOTHNESS_PARAM,-1,1,0,"Smoothness");}
  void process(const ProcessArgs& args)override{
    if(trigger.process(inputs[TRIG_INPUT].getVoltage(),.1f,.7f))phase=0.f;
    const float semitones=params[FREQUENCY_PARAM].getValue()+12.f*inputs[PITCH_INPUT].getVoltage()+params[FM_PARAM].getValue()*inputs[FM_INPUT].getNormalVoltage(.1f)/5.f;
    const float rangeScale=range==0?.05f:range==2?20.f:1.f,frequency=std::clamp(2.f*rangeScale*std::exp2(semitones/12.f),.001f,args.sampleRate*.4f);if(inputs[FREEZE_INPUT].getVoltage()<.7f){phase+=frequency*args.sampleTime;phase-=std::floor(phase);}
    const float slope=std::clamp(.5f+.45f*(params[SLOPE_PARAM].getValue()+inputs[SLOPE_INPUT].getVoltage()/5.f),.05f,.95f);
    float uni=phase<slope?phase/slope:1.f-(phase-slope)/(1.f-slope);const float shape=std::clamp(params[SHAPE_PARAM].getValue()+inputs[SHAPE_INPUT].getVoltage()/5.f,-1.f,1.f);uni=std::clamp(uni+shape*uni*(1.f-uni)*2.f,0.f,1.f);
    const float smooth=std::clamp(.5f+.5f*(params[SMOOTHNESS_PARAM].getValue()+inputs[SMOOTHNESS_INPUT].getVoltage()/5.f),0.f,1.f);smoothed+=(uni-smoothed)*(1.f-.98f*smooth);const float level=std::clamp(inputs[LEVEL_INPUT].getNormalVoltage(8.f)/8.f,0.f,1.f),bi=(smoothed*2.f-1.f)*level;
    outputs[HIGH_OUTPUT].setVoltage(phase<slope?5.f:0.f);outputs[LOW_OUTPUT].setVoltage(phase>=slope?5.f:0.f);outputs[UNI_OUTPUT].setVoltage(smoothed*8.f*level);outputs[BI_OUTPUT].setVoltage(bi*5.f);
    lights[MODE_GREEN_LIGHT].setBrightness(mode==2);lights[MODE_RED_LIGHT].setBrightness(mode==0);lights[PHASE_GREEN_LIGHT].setBrightness(std::fmax(0.f,bi));lights[PHASE_RED_LIGHT].setBrightness(std::fmax(0.f,-bi));lights[RANGE_GREEN_LIGHT].setBrightness(range==2);lights[RANGE_RED_LIGHT].setBrightness(range==0);
  }
  void setState(int id,float value)override{if(id==0)mode=std::clamp((int)value,0,2);else if(id==1)range=std::clamp((int)value,0,2);else if(id==2)sheep=value!=0.f;}
};
RACK_WEB_EXPORTS(AudibleTides)
