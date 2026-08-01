// Browser playback adapter for Voxglitch Looper 2.41.1.
// The Rack parameter/port contract is preserved. A short built-in stereo loop
// keeps a new module immediately playable; browser asset transfer replaces it.
// Original source: https://github.com/clone45/voxglitch (GPL-3.0-or-later).

#include "rack_web_export.hpp"
#include <algorithm>
#include <cmath>

struct VoxglitchLooper : Module {
  static constexpr int ASSET_CAPACITY = 1920000;
  enum ParamIds { VOLUME_SLIDER, NUM_PARAMS };
  enum InputIds { RESET_INPUT, NUM_INPUTS };
  enum OutputIds { AUDIO_OUTPUT_LEFT, AUDIO_OUTPUT_RIGHT, NUM_OUTPUTS };
  enum LightIds { NUM_LIGHTS };
  float phase=0.f,assetSamples[ASSET_CAPACITY]{},assetSampleRate=48000.f,cursor=0.f;
  int assetFrames=0,assetChannels=0;
  dsp::SchmittTrigger resetTrigger;
  VoxglitchLooper(){config(NUM_PARAMS,NUM_INPUTS,NUM_OUTPUTS,NUM_LIGHTS);configParam(VOLUME_SLIDER,0.f,1.f,1.f,"Volume");}
  int assetCapacity() const override{return ASSET_CAPACITY;}
  float* assetBuffer() override{return assetSamples;}
  void commitAsset(int frames,int channels,float sampleRate) override{assetChannels=std::clamp(channels,1,2);assetFrames=std::clamp(frames,0,ASSET_CAPACITY/assetChannels);assetSampleRate=sampleRate>0.f?sampleRate:48000.f;cursor=0.f;}
  void process(const ProcessArgs& args) override {
    if(resetTrigger.process(inputs[RESET_INPUT].getVoltage(),.1f,2.f)){phase=0.f;cursor=0.f;}
    const float volume=params[VOLUME_SLIDER].getValue();
    if(assetFrames>1){
      const int first=static_cast<int>(cursor)%assetFrames,second=(first+1)%assetFrames;const float mix=cursor-std::floor(cursor);
      const float left=assetSamples[first*assetChannels]+(assetSamples[second*assetChannels]-assetSamples[first*assetChannels])*mix;
      const int rightChannel=assetChannels>1?1:0;const float right=assetSamples[first*assetChannels+rightChannel]+(assetSamples[second*assetChannels+rightChannel]-assetSamples[first*assetChannels+rightChannel])*mix;
      outputs[AUDIO_OUTPUT_LEFT].setVoltage(left*5.f*volume);outputs[AUDIO_OUTPUT_RIGHT].setVoltage(right*5.f*volume);
      cursor+=assetSampleRate/args.sampleRate;while(cursor>=assetFrames)cursor-=assetFrames;return;
    }
    const float beat=phase*4.f-std::floor(phase*4.f),env=std::exp(-beat*18.f);
    const float left=.55f*std::sin(6.28318530718f*(phase*55.f+1.2f*env))*env+.22f*std::sin(6.28318530718f*phase*220.f);
    const float right=.55f*std::sin(6.28318530718f*(phase*55.f+1.2f*env))*env+.22f*std::sin(6.28318530718f*(phase*330.f+.25f));
    outputs[AUDIO_OUTPUT_LEFT].setVoltage(left*5.f*volume);outputs[AUDIO_OUTPUT_RIGHT].setVoltage(right*5.f*volume);
    phase+=args.sampleTime;phase-=std::floor(phase);
  }
};

RACK_WEB_EXPORTS(VoxglitchLooper)
