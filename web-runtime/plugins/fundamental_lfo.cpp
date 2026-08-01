// Polyphonic translation of Fundamental LFO 2.6.4.
// Preserves removed parameter/input slots so Rack patch indices stay stable.
// Original source: https://github.com/VCVRack/Fundamental (GPL-3.0-or-later).

#include "rack_web_export.hpp"
#include <algorithm>

struct FundamentalLFO : Module {
  enum ParamIds { OFFSET_PARAM, INVERT_PARAM, FREQ_PARAM, FM_PARAM, FM2_PARAM, PW_PARAM, PWM_PARAM, NUM_PARAMS };
  enum InputIds { FM_INPUT, FM2_INPUT, RESET_INPUT, PW_INPUT, CLOCK_INPUT, NUM_INPUTS };
  enum OutputIds { SIN_OUTPUT, TRI_OUTPUT, SAW_OUTPUT, SQR_OUTPUT, NUM_OUTPUTS };
  enum LightIds { PHASE_RED_LIGHT, PHASE_GREEN_LIGHT, PHASE_BLUE_LIGHT, INVERT_LIGHT, OFFSET_LIGHT, NUM_LIGHTS };
  float phases[16]{}, clockFreq = 1.f, clockSeconds = 0.f;
  dsp::SchmittTrigger clockTrigger, resetTriggers[16];

  FundamentalLFO() {
    config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS);
    configParam(OFFSET_PARAM, 0.f, 1.f, 1.f, "Offset");
    configParam(INVERT_PARAM, 0.f, 1.f, 0.f, "Invert");
    configParam(FREQ_PARAM, -8.f, 10.f, 1.f, "Frequency");
    configParam(FM_PARAM, -1.f, 1.f, 0.f, "Frequency modulation");
    configParam(PW_PARAM, .01f, .99f, .5f, "Pulse width");
    configParam(PWM_PARAM, -1.f, 1.f, 0.f, "Pulse width modulation");
  }

  void process(const ProcessArgs& args) override {
    if (inputs[CLOCK_INPUT].isConnected()) {
      clockSeconds += args.sampleTime;
      if (clockTrigger.process(inputs[CLOCK_INPUT].getVoltage(), .1f, 2.f)) {
        const float measured = clockSeconds > 0.f ? 1.f / clockSeconds : 0.f;
        if (measured >= .001f && measured <= 1000.f) clockFreq = measured;
        clockSeconds = 0.f;
      }
    }
    else clockFreq = 2.f;
    const bool offset = params[OFFSET_PARAM].getValue() > 0.f, invert = params[INVERT_PARAM].getValue() > 0.f;
    const int channels=std::max({polyphony,inputs[FM_INPUT].getChannels(),inputs[RESET_INPUT].getChannels(),inputs[PW_INPUT].getChannels()});for(int output=0;output<NUM_OUTPUTS;output++)outputs[output].setChannels(channels);
    for(int channel=0;channel<channels;channel++){
      const float pitch=params[FREQ_PARAM].getValue()+inputs[FM_INPUT].getPolyVoltage(channel)*params[FM_PARAM].getValue(),frequency=std::clamp(clockFreq*.5f*std::exp2(pitch),0.f,args.sampleRate*.5f);phases[channel]+=frequency*args.sampleTime;phases[channel]-=std::floor(phases[channel]);if(resetTriggers[channel].process(inputs[RESET_INPUT].getPolyVoltage(channel),.1f,2.f))phases[channel]=0.f;const float phase=phases[channel],pulseWidth=std::clamp(params[PW_PARAM].getValue()+inputs[PW_INPUT].getPolyVoltage(channel)*.1f*params[PWM_PARAM].getValue(),.01f,.99f),polarity=invert?-1.f:1.f,dc=offset?1.f:0.f;
      float sine=std::sin(6.28318530718f*(phase-(offset?.25f:0.f))),triangle=4.f*std::fabs((phase+(offset?0.f:.25f))-std::round(phase+(offset?0.f:.25f)))-1.f,saw=2.f*((phase-(offset?.5f:0.f))-std::round(phase-(offset?.5f:0.f))),square=phase<pulseWidth?1.f:-1.f;sine=sine*polarity+dc;triangle=triangle*polarity+dc;saw=saw*polarity+dc;square=square*polarity+dc;
      outputs[SIN_OUTPUT].setVoltage(5.f*sine,channel);outputs[TRI_OUTPUT].setVoltage(5.f*triangle,channel);outputs[SAW_OUTPUT].setVoltage(5.f*saw,channel);outputs[SQR_OUTPUT].setVoltage(5.f*square,channel);
    }
    const float brightness = 1.f - phases[0];
    lights[PHASE_RED_LIGHT].setBrightness(brightness); lights[PHASE_GREEN_LIGHT].setBrightness(brightness);
    lights[PHASE_BLUE_LIGHT].setBrightness(channels>1); lights[INVERT_LIGHT].setBrightness(invert); lights[OFFSET_LIGHT].setBrightness(offset);
  }
};

RACK_WEB_EXPORTS(FundamentalLFO)
