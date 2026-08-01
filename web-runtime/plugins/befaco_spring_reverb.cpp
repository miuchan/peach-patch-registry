// Browser algorithmic spring adapter for Befaco SpringReverb 2.11.0.
// It preserves the Rack controls/ports while replacing the native FFT IR
// convolver with an AudioWorklet-friendly dispersive feedback network.
// Original source: https://github.com/VCVRack/Befaco (GPL-3.0-or-later).

#include "rack_web_export.hpp"
#include <algorithm>

struct BefacoSpringReverb : Module {
  enum ParamIds{WET_PARAM,LEVEL1_PARAM,LEVEL2_PARAM,HPF_PARAM,NUM_PARAMS};enum InputIds{CV1_INPUT,CV2_INPUT,IN1_INPUT,IN2_INPUT,MIX_CV_INPUT,NUM_INPUTS};enum OutputIds{MIX_OUTPUT,WET_OUTPUT,NUM_OUTPUTS};enum LightIds{PEAK_LIGHT,VU1_LIGHTS,NUM_LIGHTS=VU1_LIGHTS+7};
  static constexpr int A=4096,B=3163,C=2377;float a[A]{},b[B]{},c[C]{},low=0;int ia=0,ib=0,ic=0;
  BefacoSpringReverb(){config(NUM_PARAMS,NUM_INPUTS,NUM_OUTPUTS,NUM_LIGHTS);configParam(WET_PARAM,0,1,.5,"Dry/wet");configParam(LEVEL1_PARAM,0,1,0,"Level 1");configParam(LEVEL2_PARAM,0,1,0,"Level 2");configParam(HPF_PARAM,0,1,.5,"High pass");}
  void process(const ProcessArgs& args)override{
    const float level1=.03f*std::pow(25.f,params[LEVEL1_PARAM].getValue())*inputs[CV1_INPUT].getNormalVoltage(10.f)/10.f,level2=.03f*std::pow(25.f,params[LEVEL2_PARAM].getValue())*inputs[CV2_INPUT].getNormalVoltage(10.f)/10.f;const float drive=inputs[IN1_INPUT].getVoltage()*level1+inputs[IN2_INPUT].getVoltage()*level2;const float cutoff=200.f*std::pow(20.f,params[HPF_PARAM].getValue()),coef=1.f-std::exp(-6.28318530718f*cutoff*args.sampleTime);low+=coef*(drive-low);const float high=drive-low;
    const float wet=(a[ia]+b[ib]+c[ic])/3.f;a[ia]=std::tanh(high+.78f*b[ib]);b[ib]=std::tanh(high*.7f+.76f*c[ic]);c[ic]=std::tanh(high*.5f+.74f*a[ia]);ia=(ia+1)%A;ib=(ib+1)%B;ic=(ic+1)%C;const float balance=std::clamp(params[WET_PARAM].getValue()+inputs[MIX_CV_INPUT].getVoltage()/10.f,0.f,1.f);outputs[WET_OUTPUT].setVoltage(std::clamp(wet,-10.f,10.f));outputs[MIX_OUTPUT].setVoltage(std::clamp(inputs[IN1_INPUT].getVoltage()+(wet-inputs[IN1_INPUT].getVoltage())*balance,-10.f,10.f));const float level=std::min(1.f,std::fabs(wet)/5.f);lights[PEAK_LIGHT].setBrightness(std::min(1.f,std::fabs(drive)));for(int i=0;i<7;i++)lights[VU1_LIGHTS+i].setBrightness(level>(float)i/7.f);
  }
};
RACK_WEB_EXPORTS(BefacoSpringReverb)
