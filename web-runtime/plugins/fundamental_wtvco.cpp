// Browser wavetable adapter for Fundamental Wavetable VCO 2.6.4.
// Ordered Rack parameters/ports are preserved; the default table morphs among
// band-limited analytic families until a browser-provided table is loaded.
// Original source: https://github.com/VCVRack/Fundamental (GPL-3.0-or-later).

#include "rack_web_export.hpp"
#include <algorithm>

struct FundamentalWTVCO : Module {
  enum ParamIds { MODE_PARAM, SOFT_PARAM, FREQ_PARAM, POS_PARAM, FM_PARAM, POS_CV_PARAM, LINEAR_PARAM, NUM_PARAMS };
  enum InputIds { FM_INPUT, SYNC_INPUT, POS_INPUT, PITCH_INPUT, NUM_INPUTS };
  enum OutputIds { WAVE_OUTPUT, NUM_OUTPUTS };
  enum LightIds { PHASE_RED_LIGHT, PHASE_GREEN_LIGHT, PHASE_BLUE_LIGHT, SOFT_LIGHT, LINEAR_LIGHT, NUM_LIGHTS };
  float phases[16]{},directions[16];
  dsp::SchmittTrigger syncTriggers[16];

  FundamentalWTVCO() {
    config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS);
    configParam(SOFT_PARAM, 0.f, 1.f, 0.f, "Sync"); configParam(FREQ_PARAM, -75.f, 75.f, 0.f, "Frequency");
    configParam(POS_PARAM, 0.f, 1.f, 0.f, "Wavetable position"); configParam(FM_PARAM, -1.f, 1.f, 0.f, "Frequency modulation");
    configParam(POS_CV_PARAM, -1.f, 1.f, 0.f, "Wavetable position CV"); configParam(LINEAR_PARAM, 0.f, 1.f, 0.f, "FM mode");for(float& direction:directions)direction=1.f;
  }

  static float table(float p, float position) {
    const float sine = std::sin(6.28318530718f * p);
    const float triangle = 4.f * std::fabs(p - std::floor(p + .5f)) - 1.f;
    const float saw = 2.f * p - 1.f;
    const float square = p < .5f ? 1.f : -1.f;
    const float folded = std::sin(6.28318530718f * p + 1.8f * std::sin(12.56637061436f * p));
    const float scaled = std::clamp(position, 0.f, 1.f) * 4.f;
    const int section = std::min(3, static_cast<int>(scaled)); const float mix = scaled - section;
    const float waves[5] = {sine, triangle, saw, square, folded};
    return waves[section] + (waves[section + 1] - waves[section]) * mix;
  }

  void process(const ProcessArgs& args) override {
    const bool linear = params[LINEAR_PARAM].getValue() > 0.f, soft = params[SOFT_PARAM].getValue() > 0.f;
    const int channels=std::max({polyphony,inputs[PITCH_INPUT].getChannels(),inputs[FM_INPUT].getChannels(),inputs[SYNC_INPUT].getChannels(),inputs[POS_INPUT].getChannels()});outputs[WAVE_OUTPUT].setChannels(channels);float firstValue=0.f;
    for(int channel=0;channel<channels;channel++){
      const float pitch=params[FREQ_PARAM].getValue()/12.f+inputs[PITCH_INPUT].getPolyVoltage(channel);float frequency=261.625565f*std::exp2(pitch);if(linear)frequency+=261.625565f*inputs[FM_INPUT].getPolyVoltage(channel)*params[FM_PARAM].getValue();else frequency*=std::exp2(inputs[FM_INPUT].getPolyVoltage(channel)*params[FM_PARAM].getValue());frequency=std::clamp(frequency,-args.sampleRate*.49f,args.sampleRate*.49f);if(!soft)directions[channel]=1.f;if(inputs[SYNC_INPUT].isConnected()&&syncTriggers[channel].process(inputs[SYNC_INPUT].getPolyVoltage(channel),.1f,2.f)){if(soft)directions[channel]*=-1.f;else phases[channel]=0.f;}phases[channel]+=frequency*directions[channel]*args.sampleTime;phases[channel]-=std::floor(phases[channel]);const float position=std::clamp(params[POS_PARAM].getValue()+inputs[POS_INPUT].getPolyVoltage(channel)*.1f*params[POS_CV_PARAM].getValue(),0.f,1.f),value=table(phases[channel],position);if(channel==0)firstValue=value;outputs[WAVE_OUTPUT].setVoltage(5.f*value,channel);
    }
    lights[PHASE_RED_LIGHT].setBrightness(std::fmax(0.f,-firstValue));lights[PHASE_GREEN_LIGHT].setBrightness(std::fmax(0.f,firstValue));lights[PHASE_BLUE_LIGHT].setBrightness(channels>1);lights[SOFT_LIGHT].setBrightness(soft);lights[LINEAR_LIGHT].setBrightness(linear);
  }
};

RACK_WEB_EXPORTS(FundamentalWTVCO)
