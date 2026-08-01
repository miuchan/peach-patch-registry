// Polyphonic browser translation of Fundamental VCO 2.6.4.
// Ordered Rack parameters and ports are preserved. Waveforms use polyBLEP at
// discontinuities so this build remains useful at audio rate without SIMD.
// Original source: https://github.com/VCVRack/Fundamental (GPL-3.0-or-later).

#include "rack_web_export.hpp"
#include <algorithm>

struct FundamentalVCO : Module {
  enum ParamIds { MODE_PARAM, SYNC_PARAM, FREQ_PARAM, FINE_PARAM, FM_PARAM, PW_PARAM, PW_CV_PARAM, LINEAR_PARAM, NUM_PARAMS };
  enum InputIds { PITCH_INPUT, FM_INPUT, SYNC_INPUT, PW_INPUT, NUM_INPUTS };
  enum OutputIds { SIN_OUTPUT, TRI_OUTPUT, SAW_OUTPUT, SQR_OUTPUT, NUM_OUTPUTS };
  enum LightIds { PHASE_NEG_LIGHT, PHASE_POS_LIGHT, PHASE_POLY_LIGHT, LINEAR_LIGHT, SOFT_LIGHT, NUM_LIGHTS };
  float phases[16]{}, triangles[16]{};
  dsp::SchmittTrigger syncTriggers[16];

  FundamentalVCO() {
    config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS);
    configParam(SYNC_PARAM, 0.f, 1.f, 1.f, "Sync mode");
    configParam(FREQ_PARAM, -76.f, 76.f, 0.f, "Frequency");
    configParam(FM_PARAM, -1.f, 1.f, 0.f, "Frequency modulation");
    configParam(PW_PARAM, .01f, .99f, .5f, "Pulse width");
    configParam(PW_CV_PARAM, -1.f, 1.f, 0.f, "Pulse width modulation");
    configParam(LINEAR_PARAM, 0.f, 1.f, 0.f, "FM mode");
  }
  static float polyBlep(float t, float dt) {
    if (t < dt) { t /= dt; return t + t - t * t - 1.f; }
    if (t > 1.f - dt) { t = (t - 1.f) / dt; return t * t + t + t + 1.f; }
    return 0.f;
  }
  void process(const ProcessArgs& args) override {
    const bool linear = params[LINEAR_PARAM].getValue() > 0.f;
    const int channels=std::max({polyphony,inputs[PITCH_INPUT].getChannels(),inputs[FM_INPUT].getChannels(),inputs[SYNC_INPUT].getChannels(),inputs[PW_INPUT].getChannels()});
    for(int output=0;output<NUM_OUTPUTS;output++)outputs[output].setChannels(channels);
    float firstSine=0.f;
    for(int channel=0;channel<channels;channel++){
      const float basePitch=params[FREQ_PARAM].getValue()/12.f+inputs[PITCH_INPUT].getPolyVoltage(channel);float frequency=261.625565f*std::exp2(basePitch);
      if(linear)frequency+=261.625565f*inputs[FM_INPUT].getPolyVoltage(channel)*params[FM_PARAM].getValue();else frequency*=std::exp2(inputs[FM_INPUT].getPolyVoltage(channel)*params[FM_PARAM].getValue());frequency=std::clamp(frequency,0.f,args.sampleRate*.49f);const float delta=frequency*args.sampleTime;
      if(inputs[SYNC_INPUT].isConnected()&&syncTriggers[channel].process(inputs[SYNC_INPUT].getPolyVoltage(channel),.1f,2.f))phases[channel]=0.f;phases[channel]+=delta;phases[channel]-=std::floor(phases[channel]);const float phase=phases[channel];
      const float pulseWidth=std::clamp(params[PW_PARAM].getValue()+inputs[PW_INPUT].getPolyVoltage(channel)/10.f*params[PW_CV_PARAM].getValue(),.01f,.99f);float saw=2.f*phase-1.f-polyBlep(phase,delta),square=phase<pulseWidth?1.f:-1.f;square+=polyBlep(phase,delta);float shifted=phase-pulseWidth;if(shifted<0.f)shifted+=1.f;square-=polyBlep(shifted,delta);triangles[channel]+=4.f*delta*square;triangles[channel]-=triangles[channel]*std::min(1.f,40.f*args.sampleTime);const float sine=std::sin(6.28318530718f*phase);if(channel==0)firstSine=sine;
      outputs[SIN_OUTPUT].setVoltage(5.f*sine,channel);outputs[TRI_OUTPUT].setVoltage(5.f*std::clamp(triangles[channel],-1.f,1.f),channel);outputs[SAW_OUTPUT].setVoltage(5.f*saw,channel);outputs[SQR_OUTPUT].setVoltage(5.f*square,channel);
    }
    lights[PHASE_NEG_LIGHT].setBrightness(std::fmax(0.f, -firstSine));
    lights[PHASE_POS_LIGHT].setBrightness(std::fmax(0.f, firstSine));
    lights[PHASE_POLY_LIGHT].setBrightness(channels>1);
    lights[LINEAR_LIGHT].setBrightness(linear);
    lights[SOFT_LIGHT].setBrightness(params[SYNC_PARAM].getValue() <= 0.f);
  }
};

RACK_WEB_EXPORTS(FundamentalVCO)
