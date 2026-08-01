// Browser physical-model adapter for Audible Instruments Elements 2.0.0.
// Keeps the complete Rack parameter/port contract and implements a stereo
// exciter/resonator that is safe to run inside AudioWorklet.
// Original source: https://github.com/VCVRack/AudibleInstruments (GPL-3.0-or-later).

#include "rack_web_export.hpp"
#include <algorithm>

struct AudibleElements : Module {
  enum ParamIds{CONTOUR_PARAM,BOW_PARAM,BLOW_PARAM,STRIKE_PARAM,COARSE_PARAM,FINE_PARAM,FM_PARAM,FLOW_PARAM,MALLET_PARAM,GEOMETRY_PARAM,BRIGHTNESS_PARAM,BOW_TIMBRE_PARAM,BLOW_TIMBRE_PARAM,STRIKE_TIMBRE_PARAM,DAMPING_PARAM,POSITION_PARAM,SPACE_PARAM,BOW_TIMBRE_MOD_PARAM,FLOW_MOD_PARAM,BLOW_TIMBRE_MOD_PARAM,MALLET_MOD_PARAM,STRIKE_TIMBRE_MOD_PARAM,DAMPING_MOD_PARAM,GEOMETRY_MOD_PARAM,POSITION_MOD_PARAM,BRIGHTNESS_MOD_PARAM,SPACE_MOD_PARAM,PLAY_PARAM,NUM_PARAMS};
  enum InputIds{NOTE_INPUT,FM_INPUT,GATE_INPUT,STRENGTH_INPUT,BLOW_INPUT,STRIKE_INPUT,BOW_TIMBRE_MOD_INPUT,FLOW_MOD_INPUT,BLOW_TIMBRE_MOD_INPUT,MALLET_MOD_INPUT,STRIKE_TIMBRE_MOD_INPUT,DAMPING_MOD_INPUT,GEOMETRY_MOD_INPUT,POSITION_MOD_INPUT,BRIGHTNESS_MOD_INPUT,SPACE_MOD_INPUT,NUM_INPUTS};
  enum OutputIds{AUX_OUTPUT,MAIN_OUTPUT,NUM_OUTPUTS};enum LightIds{GATE_LIGHT,EXCITER_LIGHT,RESONATOR_LIGHT,NUM_LIGHTS};
  static constexpr int SIZE=16384;float resonatorA[SIZE]{},resonatorB[SIZE]{},envelope=0;int index=0;bool gate=false;
  AudibleElements(){config(NUM_PARAMS,NUM_INPUTS,NUM_OUTPUTS,NUM_LIGHTS);configParam(CONTOUR_PARAM,0,1,1,"Contour");configParam(BOW_PARAM,0,1,0,"Bow");configParam(BLOW_PARAM,0,1,0,"Blow");configParam(STRIKE_PARAM,0,1,.5,"Strike");configParam(COARSE_PARAM,-30,30,0,"Coarse");configParam(FINE_PARAM,-2,2,0,"Fine");configParam(FM_PARAM,-1,1,0,"FM");for(int id=FLOW_PARAM;id<=POSITION_PARAM;id++)configParam(id,0,1,.5,"Timbre");configParam(SPACE_PARAM,0,2,0,"Space");for(int id=BOW_TIMBRE_MOD_PARAM;id<=BRIGHTNESS_MOD_PARAM;id++)configParam(id,-1,1,0,"CV");configParam(SPACE_MOD_PARAM,-2,2,0,"Space CV");configParam(PLAY_PARAM,0,1,0,"Play");}
  void process(const ProcessArgs& args)override{
    const bool nextGate=params[PLAY_PARAM].getValue()>=1.f||inputs[GATE_INPUT].getVoltage()>=1.f;if(nextGate&&!gate)envelope=1.f;gate=nextGate;
    const float pitch=inputs[NOTE_INPUT].getVoltage()+(std::round(params[COARSE_PARAM].getValue())+params[FINE_PARAM].getValue())/12.f+params[FM_PARAM].getValue()*inputs[FM_INPUT].getVoltage();const float frequency=std::clamp(440.f*std::exp2(pitch),20.f,args.sampleRate*.4f);const int delay=std::clamp((int)(args.sampleRate/frequency),2,SIZE-1),read=(index-delay+SIZE)&(SIZE-1);
    const float damping=std::clamp(params[DAMPING_PARAM].getValue()+params[DAMPING_MOD_PARAM].getValue()*inputs[DAMPING_MOD_INPUT].getVoltage()/5.f,0.f,1.f),brightness=std::clamp(params[BRIGHTNESS_PARAM].getValue()+params[BRIGHTNESS_MOD_PARAM].getValue()*inputs[BRIGHTNESS_MOD_INPUT].getVoltage()/5.f,0.f,1.f),position=std::clamp(params[POSITION_PARAM].getValue()+params[POSITION_MOD_PARAM].getValue()*inputs[POSITION_MOD_INPUT].getVoltage()/5.f,0.f,1.f);const float strength=std::clamp(1.f-inputs[STRENGTH_INPUT].getVoltage()/5.f,0.f,1.f);
    const float noise=rack::random::uniform()*2.f-1.f;const float continuous=params[BOW_PARAM].getValue()*std::sin(6.28318530718f*frequency*args.frame*args.sampleTime)+params[BLOW_PARAM].getValue()*noise;const float strike=params[STRIKE_PARAM].getValue()*noise*envelope*strength;const float external=(inputs[BLOW_INPUT].getVoltage()+inputs[STRIKE_INPUT].getVoltage())/5.f;envelope*=std::exp(-args.sampleTime*(2.f+80.f*(1.f-params[CONTOUR_PARAM].getValue())));
    const float decay=.999f-.12f*damping,a=(resonatorA[read]+resonatorA[(read-1+SIZE)&(SIZE-1)])*.5f*decay+(continuous+strike+external)*(.2f+.8f*brightness),b=(resonatorB[read]+resonatorB[(read-2+SIZE)&(SIZE-1)])*.5f*(decay-.005f)+(continuous+strike-external)*(position-.5f);resonatorA[index]=std::tanh(a);resonatorB[index]=std::tanh(b);index=(index+1)&(SIZE-1);outputs[AUX_OUTPUT].setVoltage(5.f*resonatorB[read]);outputs[MAIN_OUTPUT].setVoltage(5.f*resonatorA[read]);lights[GATE_LIGHT].setBrightness(gate);lights[EXCITER_LIGHT].setBrightness(std::min(1.f,std::fabs(continuous+strike+external)));lights[RESONATOR_LIGHT].setBrightness(std::min(1.f,std::fabs(a)+std::fabs(b)));
  }
};
RACK_WEB_EXPORTS(AudibleElements)
