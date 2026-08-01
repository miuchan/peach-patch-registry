// Browser DSP adapter for Audible Instruments Braids 2.0.0.
// Preserves the Rack parameter/port contract and provides a continuously
// morphing macro oscillator for the Web Audio runtime.
// Original source: https://github.com/VCVRack/AudibleInstruments (GPL-3.0-or-later).

#include "rack_web_export.hpp"
#include <algorithm>

struct AudibleBraids : Module {
  enum ParamIds { FINE_PARAM, COARSE_PARAM, FM_PARAM, TIMBRE_PARAM, MODULATION_PARAM, COLOR_PARAM, SHAPE_PARAM, NUM_PARAMS };
  enum InputIds { TRIG_INPUT, PITCH_INPUT, FM_INPUT, TIMBRE_INPUT, COLOR_INPUT, NUM_INPUTS };
  enum OutputIds { OUT_OUTPUT, NUM_OUTPUTS };
  enum LightIds { NUM_LIGHTS };
  float phase=0.f, strikeEnvelope=0.f;
  dsp::SchmittTrigger trigger;
  AudibleBraids(){config(NUM_PARAMS,NUM_INPUTS,NUM_OUTPUTS,NUM_LIGHTS);configParam(FINE_PARAM,-1,1,0,"Fine");configParam(COARSE_PARAM,-5,3,-1,"Coarse");configParam(FM_PARAM,-1,1,0,"FM");configParam(TIMBRE_PARAM,0,1,.5,"Timbre");configParam(MODULATION_PARAM,-1,1,0,"Modulation");configParam(COLOR_PARAM,0,1,.5,"Color");configParam(SHAPE_PARAM,0,1,0,"Model");}
  void process(const ProcessArgs& args)override{
    if(trigger.process(inputs[TRIG_INPUT].getVoltage())){phase=0;strikeEnvelope=1;}
    const float pitch=inputs[PITCH_INPUT].getVoltage()+params[COARSE_PARAM].getValue()+params[FINE_PARAM].getValue()/12.f+params[FM_PARAM].getValue()*inputs[FM_INPUT].getVoltage();
    const float frequency=std::clamp(261.625565f*std::exp2(pitch),0.f,args.sampleRate*.45f);phase+=frequency*args.sampleTime;phase-=std::floor(phase);
    const float timbre=std::clamp(params[TIMBRE_PARAM].getValue()+params[MODULATION_PARAM].getValue()*inputs[TIMBRE_INPUT].getVoltage()/5.f,0.f,1.f);
    const float color=std::clamp(params[COLOR_PARAM].getValue()+inputs[COLOR_INPUT].getVoltage()/5.f,0.f,1.f),shape=params[SHAPE_PARAM].getValue();
    const float sine=std::sin(6.28318530718f*phase),saw=2.f*phase-1.f,square=phase<(0.1f+.8f*color)?1.f:-1.f,fold=std::sin(6.28318530718f*phase*(1.f+7.f*timbre));
    float value;if(shape<.33f)value=sine+(saw-sine)*(shape/.33f);else if(shape<.66f)value=saw+(square-saw)*((shape-.33f)/.33f);else value=square+(fold-square)*((shape-.66f)/.34f);
    value=std::tanh(value*(1.f+4.f*timbre));strikeEnvelope*=std::exp(-args.sampleTime*(2.f+20.f*color));outputs[OUT_OUTPUT].setVoltage(5.f*value*(.8f+.2f*strikeEnvelope));
  }
};
RACK_WEB_EXPORTS(AudibleBraids)
