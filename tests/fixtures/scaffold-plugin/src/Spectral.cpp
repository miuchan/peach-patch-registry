#include "plugin.hpp"

struct Spectral : Module {
  enum ParamIds { NUM_PARAMS };
  enum InputIds { SIGNAL_INPUT, NUM_INPUTS };
  enum OutputIds { FFT_OUTPUT, IIR_OUTPUT, BLEP_OUTPUT, SRC_OUTPUT, NUM_OUTPUTS };
  enum LightIds { NUM_LIGHTS };

  dsp::RealFFT fft{32};
  dsp::IIRFilter<2, 2> filter;
  dsp::MinBlepGenerator<4, 4, float> blep;
  float fftRoundTrip = 0.f;
  float resampled = 0.f;
  int frame = 0;

  Spectral() {
    config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS);
    configInput(SIGNAL_INPUT, "Signal");
    configOutput(FFT_OUTPUT, "FFT round trip");
    configOutput(IIR_OUTPUT, "IIR response");
    configOutput(BLEP_OUTPUT, "MinBLEP correction");
    configOutput(SRC_OUTPUT, "Sample-rate conversion");
    auto* aligned = static_cast<float*>(pffft_aligned_malloc(32 * sizeof(float)));
    aligned[0] = 1.f;
    pffft_aligned_free(aligned);
    float time[32]{};
    float frequency[64]{};
    time[1] = 1.f;
    fft.rfft(time, frequency);
    fft.irfft(frequency, time);
    fft.scale(time);
    fftRoundTrip = time[1];
    const float numerator[] = {0.5f, 0.5f};
    const float denominator[] = {0.f};
    filter.setCoefficients(numerator, denominator);
    dsp::SampleRateConverter<1> converter;
    converter.setRates(48000, 96000);
    dsp::Frame<1> inputFrames[2]{{{0.f}}, {{2.f}}};
    dsp::Frame<1> outputFrames[4]{};
    int inputLength = 2, outputLength = 4;
    converter.process(inputFrames, &inputLength, outputFrames, &outputLength);
    resampled = outputFrames[1].samples[0];
  }

  void process(const ProcessArgs&) override {
    if (frame++ == 0) blep.insertDiscontinuity(0.f, -2.f);
    outputs[FFT_OUTPUT].setVoltage(fftRoundTrip);
    outputs[IIR_OUTPUT].setVoltage(filter.process(inputs[SIGNAL_INPUT].getVoltage()));
    outputs[BLEP_OUTPUT].setVoltage(blep.process());
    outputs[SRC_OUTPUT].setVoltage(resampled);
  }
};

struct SpectralWidget : ModuleWidget {};
Model* modelSpectral = createModel<Spectral, SpectralWidget>("Spectral");
