const ACTION_BASE = 100_000;
const EVENT_SHIFT = 22;

function replaceExport(source, model, body) {
  const exportMatches = [...source.matchAll(/RACK_WEB_EXPORTS\(([^)\n]+)\)/g)],
    exportMatch = exportMatches.at(-1);
  if (!exportMatch)
    throw new Error(
      `SignalFunctionSet/${model} generated adapter is missing its browser export`,
    );
  const base = exportMatch[1].trim();
  return source.replace(
    exportMatch[0],
    `struct RackWebSignalFunctionSet${model} : ${base} {\n${body}\n};\n\nRACK_WEB_EXPORTS(RackWebSignalFunctionSet${model})`,
  );
}

const scaleType = `struct Scale {
  const char* longName;
  const char* shortName;
  const char* museName;
  const float* intervals;
  int size;
  float museSemis[8];
};`;

const opEnvImplementation = `struct OpEnvEngine::Impl {
  uint8_t bank[4096];
  char unpacked[156];
  int curVoice = 0;
  double sr = 0.0;
  bool tablesInit = false;
  Env env;
  bool keyed = false;
  int rateOff[4] = {0, 0, 0, 0};
  int levelOff[4] = {0, 0, 0, 0};
  int rates[4] = {0, 0, 0, 0};
  int levels[4] = {0, 0, 0, 0};
  int carrierOp = 0;
  int32_t lmax = 1;
  float curLevel = 0.f;
  float scratch[6144];
  Lfo lfo;
  int lfoRateOff = 0, lfoDelayOff = 0, lfoDepthOff = 0, amSensOff = 0;
  int waveOverride = -1;
  float amDepth = 0.f;
  int note = 60;
  bool voctConnected = false;
  float releaseFrac = .7f;
  bool releaseToZero = true;
  Impl() {
    bellpatch::buildDefaultBank(bank);
    std::memset(unpacked, 0, sizeof(unpacked));
    UnpackPatch(reinterpret_cast<const char*>(bank), unpacked);
  }
};`;

const bellEngineImplementation = `struct BellEngineImpl {
  uint8_t bank[4096];
  char unpacked[156];
  int curVoice = 0;
  double sr = 0.0;
  bool tablesInit = false;
  Lfo lfo;
  Controllers controllers;
  Dx7Note notes[BellEngine::MAX_CH];
  bool active[BellEngine::MAX_CH];
  bool keyed[BellEngine::MAX_CH];
  int quietBlocks[BellEngine::MAX_CH];
  float vbuf[BellEngine::MAX_CH][BellEngine::BLOCK];
  Dx7Note vco[BellEngine::MAX_CH];
  bool vcoArmed[BellEngine::MAX_CH];
  int vcoNote[BellEngine::MAX_CH];
  float vcoBuf[BellEngine::MAX_CH][BellEngine::BLOCK];
  int32_t lfoVal = 0, lfoDelay = 0;
  float envScratch[6144];
  BellEngineImpl() {
    bellpatch::buildDefaultBank(bank);
    std::memset(vbuf, 0, sizeof(vbuf));
    std::memset(vcoBuf, 0, sizeof(vcoBuf));
    for (int index = 0; index < BellEngine::MAX_CH; ++index) {
      active[index] = false;
      keyed[index] = false;
      quietBlocks[index] = 0;
      vcoArmed[index] = false;
      vcoNote[index] = -1;
    }
    controllers.values_[kControllerPitch] = 0x2000;
  }
};`;

const pushGridFunctions = `static inline int gridClampi(int value, int minimum, int maximum) {
  return value < minimum ? minimum : (value > maximum ? maximum : value);
}
static inline int gridNoteAt(int layout, int root, int scaleIndex, int base, int row, int column) {
  if (layout == 0) {
    const int note = base + row * 5 + column;
    return note >= 0 && note < 128 ? note : -1;
  }
  if (layout == 2) {
    if (column >= 12) return -1;
    const int note = 12 + row * 12 + column;
    return note >= 0 && note < 128 ? note : -1;
  }
  const sfs::Scale& scale = sfs::SCALES[gridClampi(scaleIndex, 0, sfs::NUM_SCALES - 1)];
  const int size = scale.size < 1 ? 1 : scale.size;
  const int rowStep = std::max(1, static_cast<int>(std::lround(size * 5.0 / 12.0)));
  const int degree = row * rowStep + column;
  const int origin = (base - ((base % 12) + 12) % 12) + root;
  const int note = origin + (degree / size) * 12 + static_cast<int>(std::lround(scale.intervals[degree % size]));
  return note >= 0 && note < 128 ? note : -1;
}`;

function removeFunctionDefinition(source, marker, definitionIndex = 0) {
  let start = source.indexOf(marker);
  let foundDefinitions = 0;
  while (start >= 0) {
    const bodyStart = source.indexOf("{", start + marker.length);
    if (bodyStart < 0) return source;
    const declarationEnd = source.indexOf(";", start + marker.length);
    if (declarationEnd < 0 || bodyStart < declarationEnd) {
      let depth = 0;
      for (let index = bodyStart; index < source.length; index++) {
        if (source[index] === "{") depth++;
        else if (source[index] === "}" && --depth === 0) {
          if (foundDefinitions === definitionIndex)
            return source.slice(0, start) + source.slice(index + 1);
          foundDefinitions++;
          start = source.indexOf(marker, index + 1);
          break;
        }
      }
      if (depth !== 0)
        throw new Error(`Unterminated function definition after ${marker}`);
      continue;
    }
    start = source.indexOf(marker, declarationEnd + 1);
  }
  return source;
}

function repairSignalFunctionSetSource(source, model) {
  if (
    ["Phase", "Play", "Record"].includes(model) &&
    source.includes("DRWAV_API const char* drwav_version_string")
  ) {
    const drWavDeclarationPrelude = `#ifndef DRWAV_API
#define DRWAV_API extern
#endif
#ifndef DRWAV_PRIVATE
#define DRWAV_PRIVATE static
#endif
#ifndef DR_WAV_IMPLEMENTATION
#define DR_WAV_IMPLEMENTATION
#endif
#define DRWAV_MAX_SAMPLE_RATE 384000
#define DRWAV_MAX_CHANNELS 256
#define DRWAV_MAX_BITS_PER_SAMPLE 64`;
    if (!source.includes(`${drWavDeclarationPrelude}\n`))
      source = source.replace(
        '#include "rack_web_export.hpp"',
        `#include "rack_web_export.hpp"\n${drWavDeclarationPrelude}`,
      );
    source = source.replace(/^#define DRWAV_SIZE_MAX\s+0xFFFFFFFF\s*$/m, "");
    const moduleBoundary = {
      Phase: "struct SampleData {",
      Play: "struct SfzRegion {",
      Record: "struct NoteParamQuantity : ParamQuantity {",
    }[model];
    if (!source.includes(`#undef R\n${moduleBoundary}`))
      source = source.replace(moduleBoundary, `#undef R\n${moduleBoundary}`);
    if (["Play", "Record"].includes(model) && !source.includes("gridNoteAt(")) {
      const gridConstants = source.includes("static const int GRID_COLS")
        ? ""
        : "static const int GRID_COLS = 12, GRID_ROWS = 8;\n";
      source = source.replace(
        `#undef R\n${moduleBoundary}`,
        `#undef R\n${gridConstants}${pushGridFunctions}\n\n${moduleBoundary}`,
      );
    }
    if (
      model === "Phase" &&
      !source.includes(
        "using PhaseSampleT = float;\nstatic const size_t MAX_SAMPLE_LENGTH",
      )
    )
      source = source.replace(
        "using PhaseSampleT = float;",
        `using PhaseSampleT = float;
static const size_t MAX_SAMPLE_LENGTH = 48000 * 60 * 10;
static const size_t MAX_REC_LENGTH = 48000 * 60;`,
      );
  }

  const scaleTable = source.indexOf("static const Scale SCALES[]");
  if (scaleTable >= 0) {
    const scaleDefinition = /(struct Scale\s*\{[\s\S]*?\};)/.exec(source);
    if (!scaleDefinition || scaleDefinition.index > scaleTable) {
      const definition = scaleDefinition?.[1] ?? scaleType;
      if (scaleDefinition)
        source =
          source.slice(0, scaleDefinition.index) +
          source.slice(scaleDefinition.index + scaleDefinition[1].length);
      source = source.replace(
        "static const Scale SCALES[]",
        `${definition}\n\nstatic const Scale SCALES[]`,
      );
    }
  }

  if (["Shift", "Wave"].includes(model) && !source.includes(`#undef N\nstruct ${model}`))
    source = source.replace(`struct ${model} : Module`, `#undef N\nstruct ${model} : Module`);

  if (model === "OpEnv") {
    source = source.replace(
      /^int32_t tanhtab\[TANH_N_SAMPLES << 1\];\s*$/m,
      "",
    );
    source = source.replace(
      "extern int32_t tanhtab[TANH_N_SAMPLES << 1];",
      "extern int32_t tanhtab[TANH_N_SAMPLES << 1];\nint32_t tanhtab[TANH_N_SAMPLES << 1]{};",
    );
    if (!/\bOUT_BUS_ADD\s*=/.test(source))
      source = source.replace(
        "const FmAlgorithm algorithms[32] = {",
        "static constexpr int OUT_BUS_ADD = 1 << 2;\n\nconst FmAlgorithm algorithms[32] = {",
      );
    if (!source.includes("struct FmAlgorithm {"))
      source = source.replace(
        "const FmAlgorithm algorithms[32] = {",
        "struct FmAlgorithm { int ops[6]; };\n\nconst FmAlgorithm algorithms[32] = {",
      );
    if (!source.includes("struct OpEnvEngine::Impl {"))
      source = source.replace(
        "OpEnvEngine::OpEnvEngine() : p_(new Impl) {}",
        `${opEnvImplementation}\n\nOpEnvEngine::OpEnvEngine() : p_(new Impl) {}`,
      );
    source = source
      .replace("qrate = min(qrate, 63);", "qrate = std::min(qrate, 63);")
      .replace("a = max(0x80, a);", "a = std::max(0x80, a);")
      .replace(/\bstring::f\(/g, "rack::string::f(");
  }
  if (model === "Operator") {
    if (!source.includes('#include "bell_patches.h"'))
      source = source.replace(
        '#include "rack_web_export.hpp"',
        '#include "bell_patches.h"\n#include "rack_web_export.hpp"',
      );
    source = source
      .replace(
        /template<typename T>\s*inline static T min\(const T& a, const T& b\) \{\s*return a < b \? a : b;\s*\}\s*/,
        "",
      )
      .replace(
        /template<typename T>\s*inline static T max\(const T& a, const T& b\) \{\s*return a > b \? a : b;\s*\}\s*/,
        "",
      );
    source = removeFunctionDefinition(source, "void neon_fm_kernel(");
    source = removeFunctionDefinition(source, "int ScaleRate(", 1);
    source = source.replace(
      /^int32_t tanhtab\[TANH_N_SAMPLES << 1\];\s*$/m,
      "",
    );
    source = source.replace(
      "extern int32_t tanhtab[TANH_N_SAMPLES << 1];",
      "extern int32_t tanhtab[TANH_N_SAMPLES << 1];\nint32_t tanhtab[TANH_N_SAMPLES << 1]{};",
    );
    if (!source.includes("class Controllers;"))
      source = source.replace(
        "struct BellEngineImpl;",
        "class Controllers;\nstruct BellEngineImpl;",
      );
    if (!source.includes("struct BellEngineImpl {"))
      source = source.replace(
        "BellEngine::BellEngine() : p_(new BellEngineImpl) {}",
        `${bellEngineImplementation}\n\nBellEngine::BellEngine() : p_(new BellEngineImpl) {}`,
      );
  }
  return source;
}

const eventDecoder = `
  static constexpr int rackWebActionBase = ${ACTION_BASE};
  static constexpr int rackWebEventShift = ${EVENT_SHIFT};
  static bool rackWebDecodeAction(int id, int& event, int& x, int& y, bool& shift) {
    const int encoded = id - rackWebActionBase;
    if (encoded < 0) return false;
    event = encoded >> rackWebEventShift;
    shift = ((encoded >> 21) & 1) != 0;
    y = (encoded >> 10) & 1023;
    x = encoded & 1023;
    return event >= 0 && event <= 5;
  }`;

const adapters = {
  Band: `
  std::array<float, 17 + FFT_BINS> rackWebDisplay {};
  int rackWebVisualCount() const override { return static_cast<int>(rackWebDisplay.size()); }
  float* rackWebVisualBuffer() override {
    rackWebDisplay[0] = dispF0;
    rackWebDisplay[1] = dispSR;
    rackWebDisplay[2] = dispWidth;
    rackWebDisplay[3] = spectrumMax;
    for (int band = 0; band < N_BANDS; ++band) {
      rackWebDisplay[4 + band * 3] = dispCenterHarm[band];
      rackWebDisplay[5 + band * 3] = dispLevel[band];
      rackWebDisplay[6 + band * 3] = dispOn[band] ? 1.f : 0.f;
    }
    rackWebDisplay[16] = followPitch && detValid && inputs[AUDIO_INPUT].isConnected() ? 1.f : 0.f;
    for (int bin = 0; bin < FFT_BINS; ++bin) rackWebDisplay[17 + bin] = spectrum[bin];
    return rackWebDisplay.data();
  }`,
  Cycle: `
  std::array<float, 26 + MAX_STEPS> rackWebDisplay {};
  int rackWebVisualCount() const override { return static_cast<int>(rackWebDisplay.size()); }
  float* rackWebVisualBuffer() override {
    rackWebDisplay[0] = dispPhase;
    rackWebDisplay[1] = dispFreqHz;
    rackWebDisplay[2] = dispSpread;
    rackWebDisplay[3] = dispStab;
    rackWebDisplay[4] = dispClocked ? 1.f : 0.f;
    rackWebDisplay[5] = dispBarsPerCycle;
    rackWebDisplay[6] = static_cast<float>(dispBarInCycle);
    rackWebDisplay[7] = static_cast<float>(dispDivIdx);
    rackWebDisplay[8] = static_cast<float>(dispNSteps);
    rackWebDisplay[9] = dispBeatFrac;
    for (int channel = 0; channel < N_CH; ++channel) {
      rackWebDisplay[10 + channel * 4] = dispShape[channel];
      rackWebDisplay[11 + channel * 4] = dispAmp[channel];
      rackWebDisplay[12 + channel * 4] = dispScale[channel];
      rackWebDisplay[13 + channel * 4] = dispOffset[channel];
    }
    for (int step = 0; step < MAX_STEPS; ++step) rackWebDisplay[26 + step] = randSteps[step];
    return rackWebDisplay.data();
  }`,
  Intone: `
  std::array<float, NUM_FORMANTS * 3> rackWebDisplay {};
  int rackWebVisualCount() const override { return static_cast<int>(rackWebDisplay.size()); }
  float* rackWebVisualBuffer() override {
    for (int formant = 0; formant < NUM_FORMANTS; ++formant) {
      rackWebDisplay[formant * 3] = currentFormantFreq[formant];
      rackWebDisplay[formant * 3 + 1] = currentFormantBW[formant];
      rackWebDisplay[formant * 3 + 2] = currentFormantAmp[formant];
    }
    return rackWebDisplay.data();
  }`,
  Meter: `
  std::array<float, 32> rackWebDisplay {};
  int rackWebVisualCount() const override { return static_cast<int>(rackWebDisplay.size()); }
  float* rackWebVisualBuffer() override {
    rackWebDisplay[0] = displayedBpm;
    rackWebDisplay[1] = static_cast<float>(displayedSixteenth);
    rackWebDisplay[2] = static_cast<float>(activeNumerator);
    rackWebDisplay[3] = static_cast<float>(activeDenominator);
    rackWebDisplay[4] = running ? 1.f : 0.f;
    rackWebDisplay[5] = extClockConnected ? 1.f : 0.f;
    rackWebDisplay[6] = static_cast<float>(barsSinceReset);
    rackWebDisplay[7] = syncFlash;
    for (int output = 0; output < NUM_OUTPUTS; ++output) {
      rackWebDisplay[8 + output] = displayedSwing[output];
      rackWebDisplay[14 + output] = pulseFlash[output];
      rackWebDisplay[20 + output] = static_cast<float>(pulseFlashIdx[output]);
      rackWebDisplay[26 + output] = static_cast<float>(pulseInBar[output]);
    }
    return rackWebDisplay.data();
  }`,
  Muse: `
  static constexpr int rackWebScopeOffset = 59;
  std::array<float, rackWebScopeOffset + SCOPE_LEN * 2> rackWebDisplay {};
  int rackWebVisualCount() const override { return static_cast<int>(rackWebDisplay.size()); }
  float* rackWebVisualBuffer() override {
    rackWebDisplay[0] = static_cast<float>(core.binCounter);
    rackWebDisplay[1] = static_cast<float>(core.mod12Counter);
    rackWebDisplay[2] = static_cast<float>(core.sr);
    rackWebDisplay[3] = running ? 1.f : 0.f;
    rackWebDisplay[4] = clockFlash;
    rackWebDisplay[5] = isFollowing() ? 1.f : 0.f;
    rackWebDisplay[6] = static_cast<float>(hopsFromMasterCached);
    rackWebDisplay[7] = static_cast<float>(cvScaleMode);
    rackWebDisplay[8] = static_cast<float>(scopeFilled);
    for (int voice = 0; voice < 4; ++voice) {
      rackWebDisplay[9 + voice] = static_cast<float>(core.theme[voice]);
      rackWebDisplay[13 + voice] = static_cast<float>(core.interval[voice]);
    }
    for (int tap = 0; tap < N_TAPS; ++tap) rackWebDisplay[17 + tap] = core.tap(tap) ? 1.f : 0.f;
    rackWebDisplay[57] = static_cast<float>(core.pitchAddr());
    rackWebDisplay[58] = voctForPitchAddr(core.pitchAddr());
    for (int point = 0; point < SCOPE_LEN; ++point) {
      const int index = (scopeHead + point) % SCOPE_LEN;
      rackWebDisplay[rackWebScopeOffset + point] = static_cast<float>(scopePitch[index]);
      rackWebDisplay[rackWebScopeOffset + SCOPE_LEN + point] = static_cast<float>(scopeFb[index]);
    }
    return rackWebDisplay.data();
  }`,
  Overtone: `
  static constexpr int rackWebWaveOffset = DISPLAY_POINTS * (NUM_OVERTONES + 1);
  std::array<float, DISPLAY_POINTS * (NUM_OVERTONES + 2) + NUM_OVERTONES> rackWebDisplay {};
  int rackWebVisualCount() const override { return static_cast<int>(rackWebDisplay.size()); }
  float* rackWebVisualBuffer() override {
    if (displayDirty) updateDisplayBuffer();
    for (int point = 0; point < DISPLAY_POINTS; ++point) {
      rackWebDisplay[point] = displayFundamental[point];
      for (int harmonic = 0; harmonic < NUM_OVERTONES; ++harmonic)
        rackWebDisplay[DISPLAY_POINTS * (harmonic + 1) + point] = displayHarmonics[harmonic][point];
      rackWebDisplay[rackWebWaveOffset + point] = displayBuffer[point];
    }
    for (int harmonic = 0; harmonic < NUM_OVERTONES; ++harmonic)
      rackWebDisplay[rackWebWaveOffset + DISPLAY_POINTS + harmonic] = activeHarmonics[harmonic] ? 1.f : 0.f;
    return rackWebDisplay.data();
  }`,
  Swell: `
  std::array<float, 5 + SCOPE_HALF * 2> rackWebDisplay {};
  int rackWebVisualCount() const override { return static_cast<int>(rackWebDisplay.size()); }
  float* rackWebVisualBuffer() override {
    rackWebDisplay[0] = V;
    rackWebDisplay[1] = dispCurve;
    rackWebDisplay[2] = dispRiseTime;
    rackWebDisplay[3] = dispDecayTime;
    rackWebDisplay[4] = static_cast<float>(scopeWriteIdx);
    for (int point = 0; point < SCOPE_HALF; ++point)
      rackWebDisplay[5 + point] = scopePast[(scopeWriteIdx + point) % SCOPE_HALF];
    Rise futureRises[MAX_RISES];
    for (int rise = 0; rise < MAX_RISES; ++rise) futureRises[rise] = rises[rise];
    float futureValue = V;
    for (int point = 0; point < SCOPE_HALF; ++point) {
      bool anyRise = false;
      for (int rise = 0; rise < MAX_RISES; ++rise) {
        if (!futureRises[rise].active) continue;
        anyRise = true;
        const float remaining = futureRises[rise].deltaTotal - futureRises[rise].deltaAdded;
        if (remaining <= 0.f) { futureRises[rise].active = false; continue; }
        const float linearRate = futureRises[rise].deltaTotal / futureRises[rise].riseTime;
        const float exponentialRate = remaining * 3.f / futureRises[rise].riseTime;
        const float rate = (1.f - dispCurve) * linearRate + dispCurve * exponentialRate;
        const float delta = std::min(rate * SCOPE_DT, remaining);
        futureRises[rise].deltaAdded += delta;
        const float headroom = std::max(0.f, 10.f - futureValue);
        futureValue += delta * (headroom / 10.f);
        if (futureRises[rise].deltaAdded >= futureRises[rise].deltaTotal - .0001f || futureRises[rise].deltaAdded >= 10.f)
          futureRises[rise].active = false;
      }
      if (!anyRise && futureValue > 0.f) {
        const float linearRate = 10.f / dispDecayTime;
        const float exponentialRate = futureValue / dispDecayTime;
        futureValue = std::max(0.f, futureValue - ((1.f - dispCurve) * linearRate + dispCurve * exponentialRate) * SCOPE_DT);
      }
      futureValue = std::min(10.f, futureValue);
      rackWebDisplay[5 + SCOPE_HALF + point] = futureValue;
    }
    return rackWebDisplay.data();
  }`,
  Wave: `
  static constexpr int rackWebHeaderSize = 11;
  static constexpr int rackWebLiveOffset = rackWebHeaderSize;
  static constexpr int rackWebSlotOffset = rackWebLiveOffset + MINI_SIZE;
  static constexpr int rackWebSlotStride = MINI_SIZE + 1;
  std::array<float, rackWebSlotOffset + NUM_SLOTS * rackWebSlotStride> rackWebDisplay {};
  int rackWebVisualCount() const override { return static_cast<int>(rackWebDisplay.size()); }
  float* rackWebVisualBuffer() override {
    rackWebDisplay[0] = static_cast<float>(snapCount);
    rackWebDisplay[1] = static_cast<float>(playPosition);
    rackWebDisplay[2] = currentVelocity;
    for (int slot = 0; slot < NUM_SLOTS; ++slot) rackWebDisplay[3 + slot] = static_cast<float>(captureOrder[slot]);
    for (int point = 0; point < MINI_SIZE; ++point) rackWebDisplay[rackWebLiveOffset + point] = liveMini[point];
    for (int slot = 0; slot < NUM_SLOTS; ++slot) {
      const int offset = rackWebSlotOffset + slot * rackWebSlotStride;
      rackWebDisplay[offset] = tables[slot].ready ? 1.f : 0.f;
      for (int point = 0; point < MINI_SIZE; ++point) rackWebDisplay[offset + 1 + point] = tables[slot].mini[point];
    }
    return rackWebDisplay.data();
  }`,
  Arrange: `
  static constexpr int rackWebPhraseStride = 12;
  std::array<float, 5 + NUM_PHRASES * rackWebPhraseStride> rackWebDisplay {};
  int rackWebVisualCount() const override { return static_cast<int>(rackWebDisplay.size()); }
  float* rackWebVisualBuffer() override {
    rackWebDisplay[0] = static_cast<float>(curPhrase); rackWebDisplay[1] = static_cast<float>(editPhrase);
    rackWebDisplay[2] = static_cast<float>(barInPhrase); rackWebDisplay[3] = static_cast<float>(barsSinceReset);
    rackWebDisplay[4] = started ? 1.f : 0.f;
    for (int phrase = 0; phrase < NUM_PHRASES; ++phrase) {
      const int offset = 5 + phrase * rackWebPhraseStride;
      rackWebDisplay[offset] = static_cast<float>(bars[phrase]); rackWebDisplay[offset + 1] = active[phrase] ? 1.f : 0.f;
      rackWebDisplay[offset + 2] = static_cast<float>(effRoot(phrase)); rackWebDisplay[offset + 3] = static_cast<float>(effScale(phrase));
      rackWebDisplay[offset + 4] = static_cast<float>(effBpm(phrase));
      rackWebDisplay[offset + 5] = headOf(LINK_ROOT_PARAM, phrase) != phrase ? 1.f : 0.f;
      rackWebDisplay[offset + 6] = headOf(LINK_SCALE_PARAM, phrase) != phrase ? 1.f : 0.f;
      rackWebDisplay[offset + 7] = headOf(LINK_BPM_PARAM, phrase) != phrase ? 1.f : 0.f;
      for (int channel = 0; channel < NUM_CHANNELS; ++channel) rackWebDisplay[offset + 8 + channel] = chanOn[phrase][channel] ? 1.f : 0.f;
    }
    return rackWebDisplay.data();
  }
${eventDecoder}
  void rackWebTriggerAction(int id, bool activeAction) override {
    if (!activeAction) return;
    int event, ix, iy; bool shift;
    if (!rackWebDecodeAction(id, event, ix, iy, shift)) return;
    (void)shift;
    const float x = static_cast<float>(ix) / 1023.f * 400.f, y = static_cast<float>(iy) / 1023.f * 157.f;
    for (int phrase = 0; phrase < NUM_PHRASES; ++phrase) {
      const float px = 14.f + phrase * 48.f;
      if (event == 3 && x >= px && x <= px + 36.f && y >= 18.f && y <= 54.f) {
        this->active[phrase] = !this->active[phrase]; return;
      }
      if (event != 0) continue;
      for (int bar = 0; bar < MAX_BARS; ++bar) {
        const int column = bar % 4, row = bar / 4;
        if (x >= 15.f + phrase * 48.f + column * 9.f && x <= 22.f + phrase * 48.f + column * 9.f
            && y >= 68.f + row * 9.f && y <= 75.f + row * 9.f) {
          bars[phrase] = bar + 1; editPhrase = phrase; return;
        }
      }
      for (int channel = 0; channel < NUM_CHANNELS; ++channel)
        if (x >= 15.f + phrase * 48.f && x <= 49.f + phrase * 48.f && y >= 106.f + channel * 11.f && y <= 115.f + channel * 11.f) {
          chanOn[phrase][channel] = !chanOn[phrase][channel]; return;
        }
      if (x >= px && x <= px + 36.f && y >= 18.f && y <= 54.f) { editPhrase = phrase; return; }
    }
  }`,
  MeterX: `
  std::array<float, 1> rackWebDisplay {};
  int rackWebVisualCount() const override { return 1; }
  float* rackWebVisualBuffer() override { rackWebDisplay[0] = barPos; return rackWebDisplay.data(); }`,
  OpEnv: `
  static constexpr int rackWebEnvOffset = 8, rackWebScopeOffset = rackWebEnvOffset + ENV_N;
  static constexpr int rackWebVoiceOffset = rackWebScopeOffset + SCOPE_N, rackWebBankOffset = rackWebVoiceOffset + 12;
  std::array<float, rackWebBankOffset + 33> rackWebDisplay {};
  int rackWebVisualCount() const override { return static_cast<int>(rackWebDisplay.size()); }
  float* rackWebVisualBuffer() override {
    rackWebDisplay.fill(0.f);
    rackWebDisplay[0] = static_cast<float>(dispVoice); rackWebDisplay[1] = static_cast<float>(dispBank);
    rackWebDisplay[2] = releaseFrac; rackWebDisplay[3] = envValid ? 1.f : 0.f;
    for (int level = 0; level < 4; ++level) rackWebDisplay[4 + level] = levelAmps[level];
    for (int point = 0; point < ENV_N; ++point) rackWebDisplay[rackWebEnvOffset + point] = envCurve[point];
    for (int point = 0; point < SCOPE_N; ++point) rackWebDisplay[rackWebScopeOffset + point] = scope[(scopeHead + point) % SCOPE_N];
    for (int index = 0; index < 11 && dispName[index]; ++index) rackWebDisplay[rackWebVoiceOffset + index] = static_cast<unsigned char>(dispName[index]);
    const std::string bank = dispBank >= 0 && dispBank < static_cast<int>(banks.size()) ? banks[dispBank].name : std::string();
    for (int index = 0; index < 32 && index < static_cast<int>(bank.size()); ++index) rackWebDisplay[rackWebBankOffset + index] = static_cast<unsigned char>(bank[index]);
    return rackWebDisplay.data();
  }`,
  Operator: `
  static constexpr int rackWebEnvOffset = 41, rackWebScopeOffset = rackWebEnvOffset + ENV_N;
  static constexpr int rackWebVoiceOffset = rackWebScopeOffset + SCOPE_N, rackWebBankOffset = rackWebVoiceOffset + 12;
  std::array<float, rackWebBankOffset + 33> rackWebDisplay {};
  int rackWebVisualCount() const override { return static_cast<int>(rackWebDisplay.size()); }
  float* rackWebVisualBuffer() override {
    rackWebDisplay.fill(0.f);
    rackWebDisplay[0] = static_cast<float>(screenTab); rackWebDisplay[1] = static_cast<float>(dispAlgo);
    rackWebDisplay[2] = static_cast<float>(dispCarrier); rackWebDisplay[3] = static_cast<float>(dispVoice); rackWebDisplay[4] = static_cast<float>(dispBank);
    for (int op = 0; op < 6; ++op) rackWebDisplay[5 + op] = opEnabled[op] ? 1.f : 0.f;
    const AlgoOp* algorithm = kAlgo[clamp(dispAlgo, 0, 31)];
    for (int op = 0; op < 6; ++op) {
      const int offset = 11 + op * 5;
      rackWebDisplay[offset] = static_cast<float>(algorithm[op].id); rackWebDisplay[offset + 1] = static_cast<float>(algorithm[op].x);
      rackWebDisplay[offset + 2] = static_cast<float>(algorithm[op].y); rackWebDisplay[offset + 3] = static_cast<float>(algorithm[op].link);
      rackWebDisplay[offset + 4] = static_cast<float>(algorithm[op].fb);
    }
    for (int point = 0; point < ENV_N; ++point) rackWebDisplay[rackWebEnvOffset + point] = envCurve[point];
    for (int point = 0; point < SCOPE_N; ++point) rackWebDisplay[rackWebScopeOffset + point] = scope[(scopeHead + point) % SCOPE_N];
    for (int index = 0; index < 11 && dispName[index]; ++index) rackWebDisplay[rackWebVoiceOffset + index] = static_cast<unsigned char>(dispName[index]);
    const std::string bank = dispBank >= 0 && dispBank < static_cast<int>(banks.size()) ? banks[dispBank].name : std::string();
    for (int index = 0; index < 32 && index < static_cast<int>(bank.size()); ++index) rackWebDisplay[rackWebBankOffset + index] = static_cast<unsigned char>(bank[index]);
    return rackWebDisplay.data();
  }
${eventDecoder}
  void rackWebTriggerAction(int id, bool activeAction) override {
    if (!activeAction) return;
    int event, ix, iy; bool shift;
    if (!rackWebDecodeAction(id, event, ix, iy, shift) || event != 0) return;
    (void)shift;
    const float x = static_cast<float>(ix) / 1023.f * 174.f, y = static_cast<float>(iy) / 1023.f * 159.f;
    if (y >= 8.f && y <= 26.f) {
      if (x >= 7.f && x <= 85.f) screenTab = 0;
      else if (x >= 87.f && x <= 165.f) screenTab = 1;
      return;
    }
    if (screenTab != 0) return;
    const AlgoOp* algorithm = kAlgo[clamp(dispAlgo, 0, 31)];
    for (int op = 0; op < 6; ++op) {
      const float left = 12.567f + 26.f * algorithm[op].x, top = 56.f + 26.f * algorithm[op].y;
      if (x >= left && x <= left + 18.f && y >= top && y <= top + 18.f) { toggleOp(algorithm[op].id); return; }
    }
  }`,
  Phase: `
  static constexpr int rackWebMiniOffset = 18, rackWebCueAOffset = rackWebMiniOffset + WAVEFORM_POINTS * 2;
  static constexpr int rackWebCueBOffset = rackWebCueAOffset + 128;
  std::array<float, rackWebCueBOffset + 128> rackWebDisplay {};
  int rackWebDrag = 0, rackWebDragCue = -1;
  int rackWebVisualCount() const override { return static_cast<int>(rackWebDisplay.size()); }
  void rackWebFillPhaseRow(int row, SampleData& sample, LoopState& loop, RecState& recording) {
    const int offset = row * 9;
    const bool loaded = sample.loaded.load();
    rackWebDisplay[offset] = loaded ? 1.f : 0.f;
    rackWebDisplay[offset + 1] = sample.loopStart; rackWebDisplay[offset + 2] = sample.loopEnd;
    rackWebDisplay[offset + 3] = sample.length ? static_cast<float>(loop.playhead / static_cast<double>(sample.length)) : 0.f;
    rackWebDisplay[offset + 4] = sample.length ? static_cast<float>(loop.rotationOffset / static_cast<double>(sample.length)) : 0.f;
    rackWebDisplay[offset + 5] = recording.phase != RecState::IDLE ? 1.f : 0.f;
    rackWebDisplay[offset + 6] = recording.recBuffer.empty() ? 0.f : static_cast<float>(recording.writePos.load()) / static_cast<float>(recording.recBuffer.size());
    rackWebDisplay[offset + 7] = static_cast<float>(std::min<size_t>(sample.transients.size(), 128));
    rackWebDisplay[offset + 8] = sample.length ? 1.f / static_cast<float>(sample.length) : 0.f;
    const int miniOffset = rackWebMiniOffset + row * WAVEFORM_POINTS;
    if (recording.phase != RecState::IDLE && !recording.recBuffer.empty()) {
      const size_t written = recording.writePos.load();
      for (int point = 0; point < WAVEFORM_POINTS; ++point) {
        const size_t begin = static_cast<size_t>(static_cast<double>(point) / WAVEFORM_POINTS * written);
        const size_t end = static_cast<size_t>(static_cast<double>(point + 1) / WAVEFORM_POINTS * written);
        float peak = 0.f;
        const size_t step = std::max<size_t>(1, (end > begin ? end - begin : 1) / 16);
        for (size_t sampleIndex = begin; sampleIndex < end && sampleIndex < recording.recBuffer.size(); sampleIndex += step)
          peak = std::max(peak, std::fabs(sampleToFloat(recording.recBuffer[sampleIndex])));
        rackWebDisplay[miniOffset + point] = peak;
      }
    } else {
      for (int point = 0; point < WAVEFORM_POINTS; ++point)
        rackWebDisplay[miniOffset + point] = point < static_cast<int>(sample.waveformMini.size()) ? sample.waveformMini[point] : 0.f;
    }
    const int cueOffset = row == 0 ? rackWebCueAOffset : rackWebCueBOffset;
    for (int cue = 0; cue < 128; ++cue)
      rackWebDisplay[cueOffset + cue] = cue < static_cast<int>(sample.transients.size()) && sample.length
        ? static_cast<float>(sample.transients[cue]) / static_cast<float>(sample.length) : 0.f;
  }
  float* rackWebVisualBuffer() override {
    rackWebDisplay.fill(0.f); rackWebFillPhaseRow(0, sampleA, loopA, recA); rackWebFillPhaseRow(1, sampleB, loopB, recB);
    return rackWebDisplay.data();
  }
${eventDecoder}
  int rackWebNearestCue(SampleData& sample, float x, float radius) {
    if (!sample.loaded.load() || !sample.length) return -1;
    int best = -1; float distance = radius;
    for (int cue = 0; cue < static_cast<int>(sample.transients.size()); ++cue) {
      const float current = std::fabs(x - static_cast<float>(sample.transients[cue]) / static_cast<float>(sample.length));
      if (current < distance) { distance = current; best = cue; }
    }
    return best;
  }
  void rackWebTriggerAction(int id, bool activeAction) override {
    if (!activeAction) return;
    int event, ix, iy; bool shift;
    if (!rackWebDecodeAction(id, event, ix, iy, shift)) return;
    (void)shift;
    const float x = static_cast<float>(ix) / 1023.f; const int row = iy >= 512 ? 1 : 0;
    SampleData& sample = row ? sampleB : sampleA;
    if (event == 2) { if (rackWebDrag == 5 || rackWebDrag == 6) sortCues(sample); rackWebDrag = 0; rackWebDragCue = -1; return; }
    if (!sample.loaded.load() || !sample.length) return;
    if (event == 3) {
      if (std::fabs(x - sample.loopStart) < .025f || std::fabs(x - sample.loopEnd) < .025f) return;
      const int cue = rackWebNearestCue(sample, x, .015f);
      if (cue >= 0) removeCue(sample, cue); else addCue(sample, static_cast<size_t>(x * sample.length));
      return;
    }
    if (event == 0) {
      if (std::fabs(x - sample.loopStart) < .025f) rackWebDrag = row ? 3 : 1;
      else if (std::fabs(x - sample.loopEnd) < .025f) rackWebDrag = row ? 4 : 2;
      else { rackWebDragCue = rackWebNearestCue(sample, x, .015f); if (rackWebDragCue >= 0) rackWebDrag = row ? 6 : 5; }
    }
    if (event != 0 && event != 1) return;
    if (rackWebDrag == 1 || rackWebDrag == 3) sample.loopStart = clamp(x, 0.f, sample.loopEnd - .01f);
    else if (rackWebDrag == 2 || rackWebDrag == 4) sample.loopEnd = clamp(x, sample.loopStart + .01f, 1.f);
    else if ((rackWebDrag == 5 || rackWebDrag == 6) && rackWebDragCue >= 0)
      moveCue(sample, rackWebDragCue, static_cast<size_t>(x * sample.length));
  }`,
  Play: `
  static constexpr int rackWebMappedOffset = 6, rackWebRootOffset = rackWebMappedOffset + 128;
  static constexpr int rackWebPlayingOffset = rackWebRootOffset + 128, rackWebGridOffset = rackWebPlayingOffset + 128;
  static constexpr int rackWebNameOffset = rackWebGridOffset + GRID_COLS * GRID_ROWS, rackWebInfoOffset = rackWebNameOffset + 49;
  std::array<float, rackWebInfoOffset + 49> rackWebDisplay {};
  bool rackWebDragging = false;
  int rackWebVisualCount() const override { return static_cast<int>(rackWebDisplay.size()); }
  float* rackWebVisualBuffer() override {
    rackWebDisplay.fill(0.f);
    rackWebDisplay[0] = static_cast<float>(kbView); rackWebDisplay[1] = static_cast<float>(gridLayout);
    rackWebDisplay[2] = static_cast<float>(gridRoot); rackWebDisplay[3] = static_cast<float>(gridScale);
    rackWebDisplay[4] = static_cast<float>(gridBase); rackWebDisplay[5] = static_cast<float>(dispCount);
    for (int note = 0; note < 128; ++note) {
      rackWebDisplay[rackWebMappedOffset + note] = static_cast<float>(dispMapped[note]);
      rackWebDisplay[rackWebRootOffset + note] = static_cast<float>(dispRoot[note]);
      rackWebDisplay[rackWebPlayingOffset + note] = static_cast<float>(dispPlaying[note]);
    }
    for (int row = 0; row < GRID_ROWS; ++row) for (int column = 0; column < GRID_COLS; ++column)
      rackWebDisplay[rackWebGridOffset + row * GRID_COLS + column] = static_cast<float>(gridNoteAt(gridLayout, gridRoot, gridScale, gridBase, row, column));
    for (int index = 0; index < 48 && dispName[index]; ++index) rackWebDisplay[rackWebNameOffset + index] = static_cast<unsigned char>(dispName[index]);
    for (int index = 0; index < 48 && dispInfo[index]; ++index) rackWebDisplay[rackWebInfoOffset + index] = static_cast<unsigned char>(dispInfo[index]);
    return rackWebDisplay.data();
  }
${eventDecoder}
  int rackWebGridHit(float x, float y) {
    const float width = 215.551f, height = 168.307f, top = 32.f, margin = 6.f;
    const float pad = std::min((width - 2.f * margin) / GRID_COLS, (height - 6.f - top) / GRID_ROWS);
    const float x0 = (width - pad * GRID_COLS) * .5f, y0 = top + std::max(0.f, (height - 6.f - top - pad * GRID_ROWS) * .5f);
    const int column = static_cast<int>((x - x0) / pad), displayRow = static_cast<int>((y - y0) / pad);
    if (x < x0 || y < y0 || column < 0 || column >= GRID_COLS || displayRow < 0 || displayRow >= GRID_ROWS) return -1;
    return gridNoteAt(gridLayout, gridRoot, gridScale, gridBase, GRID_ROWS - 1 - displayRow, column);
  }
  int rackWebPianoHit(float x, float y) {
    const float left = 6.f, top = 122.307f, width = 203.551f, height = 28.f;
    if (x < left || x > left + width || y < top || y > top + height) return -1;
    const int whiteCount = playWhiteBefore(PKB_HI + 1); const float whiteWidth = width / whiteCount;
    const float blackHeight = height * .62f, blackWidth = whiteWidth * .6f;
    if (y <= top + blackHeight) for (int note = PKB_LO; note <= PKB_HI; ++note) if (!playIsWhite(note)) {
      const float blackX = left + playWhiteBefore(note) * whiteWidth - blackWidth * .5f;
      if (x >= blackX && x <= blackX + blackWidth) return note;
    }
    const int selected = static_cast<int>((x - left) / whiteWidth); int found = 0;
    for (int note = PKB_LO; note <= PKB_HI; ++note) if (playIsWhite(note) && found++ == selected) return note;
    return -1;
  }
  void rackWebTriggerAction(int id, bool activeAction) override {
    if (!activeAction) return; int event, ix, iy; bool shift;
    if (!rackWebDecodeAction(id, event, ix, iy, shift)) return; (void)shift;
    const float x = static_cast<float>(ix) / 1023.f * 215.551f, y = static_cast<float>(iy) / 1023.f * 168.307f;
    if (event == 2) { uiNote = -1; rackWebDragging = false; return; }
    if (event == 0 && y >= 4.f && y <= 19.f) { kbView = x < 107.7755f ? 1 : 0; return; }
    if (event != 0 && event != 1) return;
    const int note = kbView == 1 ? rackWebGridHit(x, y) : rackWebPianoHit(x, y);
    if (note >= 0) { uiNote = note; rackWebDragging = true; } else if (event == 1 && rackWebDragging) uiNote = -1;
  }`,
  Record: `
  static constexpr int rackWebSampledOffset = 9, rackWebGridOffset = rackWebSampledOffset + 128;
  static constexpr int rackWebScopeMinOffset = rackWebGridOffset + GRID_COLS * GRID_ROWS, rackWebScopeMaxOffset = rackWebScopeMinOffset + SCOPE_N;
  static constexpr int rackWebNameOffset = rackWebScopeMaxOffset + SCOPE_N, rackWebStatusOffset = rackWebNameOffset + 49;
  std::array<float, rackWebStatusOffset + 49> rackWebDisplay {};
  bool rackWebDragging = false;
  int rackWebVisualCount() const override { return static_cast<int>(rackWebDisplay.size()); }
  float* rackWebVisualBuffer() override {
    rackWebDisplay.fill(0.f);
    rackWebDisplay[0] = static_cast<float>(kbView); rackWebDisplay[1] = static_cast<float>(gridLayout);
    rackWebDisplay[2] = static_cast<float>(gridRoot); rackWebDisplay[3] = static_cast<float>(gridScale); rackWebDisplay[4] = static_cast<float>(gridBase);
    rackWebDisplay[5] = static_cast<float>(kbLo); rackWebDisplay[6] = static_cast<float>(kbHi); rackWebDisplay[7] = static_cast<float>(kbCur); rackWebDisplay[8] = dispProg;
    for (int note = 0; note < 128; ++note) rackWebDisplay[rackWebSampledOffset + note] = static_cast<float>(kbSampled[note]);
    for (int row = 0; row < GRID_ROWS; ++row) for (int column = 0; column < GRID_COLS; ++column)
      rackWebDisplay[rackWebGridOffset + row * GRID_COLS + column] = static_cast<float>(gridNoteAt(gridLayout, gridRoot, gridScale, gridBase, row, column));
    for (int point = 0; point < SCOPE_N; ++point) { rackWebDisplay[rackWebScopeMinOffset + point] = scopeMin[point]; rackWebDisplay[rackWebScopeMaxOffset + point] = scopeMax[point]; }
    for (int index = 0; index < 48 && dispName[index]; ++index) rackWebDisplay[rackWebNameOffset + index] = static_cast<unsigned char>(dispName[index]);
    for (int index = 0; index < 48 && dispStatus[index]; ++index) rackWebDisplay[rackWebStatusOffset + index] = static_cast<unsigned char>(dispStatus[index]);
    return rackWebDisplay.data();
  }
${eventDecoder}
  int rackWebGridHit(float x, float y) {
    const float width = 215.551f, height = 168.307f, top = 40.f, margin = 6.f;
    const float pad = std::min((width - 2.f * margin) / GRID_COLS, (height - 6.f - top) / GRID_ROWS);
    const float x0 = (width - pad * GRID_COLS) * .5f, y0 = top + std::max(0.f, (height - 6.f - top - pad * GRID_ROWS) * .5f);
    const int column = static_cast<int>((x - x0) / pad), displayRow = static_cast<int>((y - y0) / pad);
    if (x < x0 || y < y0 || column < 0 || column >= GRID_COLS || displayRow < 0 || displayRow >= GRID_ROWS) return -1;
    return gridNoteAt(gridLayout, gridRoot, gridScale, gridBase, GRID_ROWS - 1 - displayRow, column);
  }
  int rackWebPianoHit(float x, float y) {
    const float left = 6.f, top = 138.307f, width = 203.551f, height = 26.f;
    if (x < left || x > left + width || y < top || y > top + height) return -1;
    const int whiteCount = recWhiteBefore(KB_HI + 1); const float whiteWidth = width / whiteCount;
    const float blackHeight = height * .62f, blackWidth = whiteWidth * .6f;
    if (y <= top + blackHeight) for (int note = KB_LO; note <= KB_HI; ++note) if (!recIsWhite(note)) {
      const float blackX = left + recWhiteBefore(note) * whiteWidth - blackWidth * .5f;
      if (x >= blackX && x <= blackX + blackWidth) return note;
    }
    const int selected = static_cast<int>((x - left) / whiteWidth); int found = 0;
    for (int note = KB_LO; note <= KB_HI; ++note) if (recIsWhite(note) && found++ == selected) return note;
    return -1;
  }
  void rackWebTriggerAction(int id, bool activeAction) override {
    if (!activeAction) return; int event, ix, iy; bool shift;
    if (!rackWebDecodeAction(id, event, ix, iy, shift)) return; (void)shift;
    const float x = static_cast<float>(ix) / 1023.f * 215.551f, y = static_cast<float>(iy) / 1023.f * 168.307f;
    if (event == 2) { uiNote = -1; rackWebDragging = false; return; }
    if (event == 0 && y >= 4.f && y <= 19.f) { kbView = x < 107.7755f ? 1 : 0; return; }
    if (event != 0 && event != 1) return;
    const int note = kbView == 1 ? rackWebGridHit(x, y) : rackWebPianoHit(x, y);
    if (note >= 0) { uiNote = note; rackWebDragging = true; } else if (event == 1 && rackWebDragging) uiNote = -1;
  }`,
  Gravity: `
  static constexpr int rackWebTrailPoints = 128;
  static constexpr int rackWebHungryOffset = 87;
  static constexpr int rackWebTrailOffset = 286;
  std::array<float, rackWebTrailOffset + rackWebTrailPoints * 4> rackWebDisplay {};
  std::array<float, rackWebTrailPoints> rackWebTrailX {}, rackWebTrailY {};
  std::array<bool, rackWebTrailPoints> rackWebTrailPen {}, rackWebTrailBreak {};
  int rackWebTrailHead = 0, rackWebTrailCount = 0;
  int rackWebLastTeleport = -1, rackWebLastPatternGeneration = -1;
  float rackWebLastTrailX = 0.f, rackWebLastTrailY = 0.f;
  int rackWebDragging = DRAG_NONE;
  void rackWebSampleTrail() {
    if (mode != MODE_TURTLE && mode != MODE_PATTERN) { rackWebTrailCount = 0; return; }
    bool trailBreak = false;
    if (mode == MODE_PATTERN && ptGen != rackWebLastPatternGeneration) {
      rackWebTrailCount = 0; rackWebTrailHead = 0; trailBreak = true;
      rackWebLastPatternGeneration = ptGen;
    }
    if (tuTeleport != rackWebLastTeleport) { trailBreak = true; rackWebLastTeleport = tuTeleport; }
    const float dx = trackedX - rackWebLastTrailX, dy = trackedY - rackWebLastTrailY;
    if (rackWebTrailCount > 0 && !trailBreak && dx * dx + dy * dy < .0036f) return;
    rackWebTrailX[rackWebTrailHead] = trackedX;
    rackWebTrailY[rackWebTrailHead] = trackedY;
    rackWebTrailPen[rackWebTrailHead] = tuPenDown;
    rackWebTrailBreak[rackWebTrailHead] = trailBreak;
    rackWebLastTrailX = trackedX; rackWebLastTrailY = trackedY;
    rackWebTrailHead = (rackWebTrailHead + 1) % rackWebTrailPoints;
    rackWebTrailCount = std::min(rackWebTrailCount + 1, rackWebTrailPoints);
  }
  int rackWebVisualCount() const override { return static_cast<int>(rackWebDisplay.size()); }
  float* rackWebVisualBuffer() override {
    rackWebSampleTrail();
    rackWebDisplay.fill(0.f);
    rackWebDisplay[0] = static_cast<float>(mode);
    rackWebDisplay[1] = static_cast<float>(gravAngle);
    rackWebDisplay[2] = trackedX; rackWebDisplay[3] = trackedY;
    rackWebDisplay[4] = dispB1x; rackWebDisplay[5] = dispB1y;
    rackWebDisplay[6] = dispB2x; rackWebDisplay[7] = dispB2y;
    for (int sector = 0; sector < NUM_SECTORS; ++sector) rackWebDisplay[8 + sector] = dispGateFlash[sector];
    rackWebDisplay[20] = static_cast<float>(gwPlanetCount);
    for (int planet = 0; planet < MAX_PLANETS; ++planet) {
      rackWebDisplay[21 + planet * 3] = static_cast<float>(gwPlanetRad[planet] * std::cos(gwPlanetAng[planet]));
      rackWebDisplay[22 + planet * 3] = static_cast<float>(gwPlanetRad[planet] * std::sin(gwPlanetAng[planet]));
      rackWebDisplay[23 + planet * 3] = static_cast<float>(gwPlanetMass[planet]);
    }
    rackWebDisplay[36] = static_cast<float>(bzCount);
    for (int ball = 0; ball < MAX_BALLS; ++ball) {
      rackWebDisplay[37 + ball * 2] = static_cast<float>(bzX[ball]);
      rackWebDisplay[38 + ball * 2] = static_cast<float>(bzY[ball]);
    }
    rackWebDisplay[55] = bzAiming ? 1.f : 0.f;
    rackWebDisplay[56] = static_cast<float>(bzAimX); rackWebDisplay[57] = static_cast<float>(bzAimY);
    rackWebDisplay[58] = tuX; rackWebDisplay[59] = tuY; rackWebDisplay[60] = tuHeading;
    rackWebDisplay[61] = tuPenDown ? 1.f : 0.f; rackWebDisplay[62] = static_cast<float>(tuCmd);
    rackWebDisplay[63] = static_cast<float>(ptN); rackWebDisplay[64] = static_cast<float>(ptQ);
    rackWebDisplay[65] = static_cast<float>(ptD); rackWebDisplay[66] = static_cast<float>(ptCount);
    rackWebDisplay[67] = static_cast<float>(ptSeg); rackWebDisplay[68] = ptProg;
    rackWebDisplay[69] = static_cast<float>(hmFrom); rackWebDisplay[70] = static_cast<float>(hmTo);
    rackWebDisplay[71] = hmProg; rackWebDisplay[72] = hmHeading;
    rackWebDisplay[73] = static_cast<float>(hmLevel); rackWebDisplay[74] = hmLevelFlash;
    for (int sector = 0; sector < NUM_SECTORS; ++sector) rackWebDisplay[75 + sector] = sectorOut[sector];
    rackWebDisplay[81] = gwSunPull; rackWebDisplay[82] = static_cast<float>(gwVx); rackWebDisplay[83] = static_cast<float>(gwVy);
    rackWebDisplay[84] = static_cast<float>(hmScore); rackWebDisplay[85] = static_cast<float>(hmLevel); rackWebDisplay[86] = hmLevelFlash;
    for (int node = 0; node < HM_NODES; ++node) {
      rackWebDisplay[rackWebHungryOffset + node] = hmPassRing[node] ? 1.f : 0.f;
      rackWebDisplay[rackWebHungryOffset + HM_NODES + node] = hmPassRad[node] ? 1.f : 0.f;
      rackWebDisplay[rackWebHungryOffset + HM_NODES * 2 + node] = hmBigDot[node] ? 1.f : 0.f;
      rackWebDisplay[rackWebHungryOffset + HM_NODES * 3 + node] = hmSmallDot[node] ? 1.f : 0.f;
    }
    rackWebDisplay[279] = static_cast<float>(tuCmdSeq); rackWebDisplay[280] = tuMoveRate;
    rackWebDisplay[281] = tuCmdDur; rackWebDisplay[282] = tuTurnRate;
    rackWebDisplay[283] = static_cast<float>(tuTeleport); rackWebDisplay[284] = static_cast<float>(ptGen);
    rackWebDisplay[285] = static_cast<float>(rackWebTrailCount);
    const int first = (rackWebTrailHead - rackWebTrailCount + rackWebTrailPoints) % rackWebTrailPoints;
    for (int point = 0; point < rackWebTrailPoints; ++point) {
      const int source = (first + point) % rackWebTrailPoints, offset = rackWebTrailOffset + point * 4;
      rackWebDisplay[offset] = rackWebTrailX[source]; rackWebDisplay[offset + 1] = rackWebTrailY[source];
      rackWebDisplay[offset + 2] = rackWebTrailPen[source] ? 1.f : 0.f;
      rackWebDisplay[offset + 3] = rackWebTrailBreak[source] ? 1.f : 0.f;
    }
    return rackWebDisplay.data();
  }
${eventDecoder}
  void rackWebTriggerAction(int id, bool active) override {
    if (!active) return;
    int event, ix, iy; bool shift;
    if (!rackWebDecodeAction(id, event, ix, iy, shift)) return;
    (void)shift;
    const float px = static_cast<float>(ix) / 1023.f * 177.165f;
    const float py = static_cast<float>(iy) / 1023.f * 177.165f;
    const float cx = 88.5825f, cy = 88.5825f, radius = 82.5825f;
    const float mx = (px - cx) / (radius / REACH);
    const float my = (py - cy) / (radius / REACH);
    if (event == 0) {
      if (mode == MODE_BILLIARDS) {
        const float dx = mx - trackedX, dy = my - trackedY;
        if (std::sqrt(dx * dx + dy * dy) < 14.f / (radius / REACH)) {
          rackWebDragging = 98; bzAiming = true; bzAimX = mx; bzAimY = my; return;
        }
      }
      if (mode == MODE_PENDULUM) {
        const float tipDx = mx - dispB2x, tipDy = my - dispB2y;
        const float elbowDx = mx - dispB1x, elbowDy = my - dispB1y;
        const float tipDistance = std::sqrt(tipDx * tipDx + tipDy * tipDy);
        const float elbowDistance = std::sqrt(elbowDx * elbowDx + elbowDy * elbowDy);
        const float threshold = 11.f / (radius / REACH);
        const int joint = tipDistance <= elbowDistance && tipDistance < threshold ? DRAG_TIP
          : elbowDistance < threshold ? DRAG_ELBOW : DRAG_NONE;
        if (joint != DRAG_NONE) {
          rackWebDragging = joint; dragJoint = joint; dragTargetX = mx; dragTargetY = my;
          prevDragTh1 = th1; prevDragTh2 = th2; w1Smooth = 0.0; w2Smooth = 0.0; return;
        }
      }
      const float rimDistance = std::sqrt((px - cx) * (px - cx) + (py - cy) * (py - cy));
      if (rimDistance > radius * .7f) rackWebDragging = 99;
    }
    if ((event == 0 || event == 1) && rackWebDragging != DRAG_NONE) {
      if (rackWebDragging == 99) params[GRAVITY_PARAM].setValue(clamp(std::atan2(mx, my) / static_cast<float>(M_PI), -1.f, 1.f));
      else if (rackWebDragging == 98) { bzAimX = mx; bzAimY = my; }
      else { dragTargetX = mx; dragTargetY = my; }
    }
    if (event == 2) {
      if (rackWebDragging == 98) { billiardsLaunch(bzAimX, bzAimY); bzAiming = false; }
      else if (rackWebDragging != 99) dragJoint = DRAG_NONE;
      rackWebDragging = DRAG_NONE;
    }
  }`,
};

function beatAdapter() {
  return `
  static constexpr int rackWebHeaderSize = 5;
  static constexpr int rackWebPatternStride = 3 + MAX_STEPS * 4;
  std::array<float, rackWebHeaderSize + NUM_PATTERNS * rackWebPatternStride> rackWebDisplay {};
  int rackWebDrag = 0, rackWebDragStep = -1;
  bool rackWebPaint = false;
  int rackWebVisualCount() const override { return static_cast<int>(rackWebDisplay.size()); }
  float* rackWebVisualBuffer() override {
    rackWebDisplay[0] = static_cast<float>(editPattern); rackWebDisplay[1] = static_cast<float>(playPattern);
    rackWebDisplay[2] = static_cast<float>(playStep); rackWebDisplay[3] = static_cast<float>(editMode);
    rackWebDisplay[4] = static_cast<float>(currentBar);
    for (int pattern = 0; pattern < NUM_PATTERNS; ++pattern) {
      const int offset = rackWebHeaderSize + pattern * rackWebPatternStride;
      rackWebDisplay[offset] = patterns[pattern].active ? 1.f : 0.f;
      rackWebDisplay[offset + 1] = static_cast<float>(patterns[pattern].length);
      rackWebDisplay[offset + 2] = static_cast<float>(patterns[pattern].repeats);
      for (int step = 0; step < MAX_STEPS; ++step) {
        rackWebDisplay[offset + 3 + step * 4] = patterns[pattern].steps[step] ? 1.f : 0.f;
        rackWebDisplay[offset + 4 + step * 4] = patterns[pattern].velocities[step];
        rackWebDisplay[offset + 5 + step * 4] = patterns[pattern].accents[step] ? 1.f : 0.f;
        rackWebDisplay[offset + 6 + step * 4] = patterns[pattern].probabilities[step];
      }
    }
    return rackWebDisplay.data();
  }
${eventDecoder}
  static int rackWebCell(float value, float start, float pitch, int count, float size) {
    for (int index = 0; index < count; ++index) if (value >= start + index * pitch && value < start + index * pitch + size) return index;
    return -1;
  }
  void rackWebTriggerAction(int id, bool active) override {
    if (!active) return;
    int event, ix, iy; bool shift;
    if (!rackWebDecodeAction(id, event, ix, iy, shift)) return;
    (void)shift;
    const float x = static_cast<float>(ix) / 1023.f * 174.f;
    const float y = static_cast<float>(iy) / 1023.f * 155.f;
    const int tab = y >= 8.f && y < 26.f ? rackWebCell(x, 7.f, 40.f, 4, 38.f) : -1;
    const int pattern = y >= 111.f && y < 129.f ? rackWebCell(x, 7.f, 20.f, 8, 18.f) : -1;
    const int repeat = y >= 137.f && y < 145.f ? rackWebCell(x, 7.f, 20.f, 8, 18.f) : -1;
    const int length = y >= 75.f && y < 83.f ? rackWebCell(x, 7.f, 10.f, 16, 8.f) : -1;
    const int column = rackWebCell(x, 7.f, 20.f, 8, 18.f);
    const int row = y >= 35.f && y < 53.f ? 0 : y >= 55.f && y < 73.f ? 1 : -1;
    const int step = column >= 0 && row >= 0 ? row * 8 + column : -1;
    if (event == 3 && pattern >= 0) {
      patterns[pattern].active = !patterns[pattern].active;
      if (!patterns[playPattern].active) { playPattern = nextActivePattern(playPattern); playStep = 0; }
      return;
    }
    if ((event == 4 || event == 5) && pattern >= 0) {
      patterns[pattern].repeats = clamp(patterns[pattern].repeats + (event == 4 ? 1 : -1), 1, MAX_REPEATS);
      return;
    }
    if (event == 2) { rackWebDrag = 0; rackWebDragStep = -1; return; }
    if (event == 0) {
      if (tab >= 0) { editMode = tab; return; }
      if (pattern >= 0) { editPattern = pattern; rackWebDrag = 5; return; }
      if (repeat >= 0) { patterns[editPattern].repeats = repeat + 1; rackWebDrag = 6; return; }
      if (length >= 0) { patterns[editPattern].length = length + 1; rackWebDrag = 4; return; }
      if (step >= 0) {
        Pattern& selected = patterns[editPattern];
        if (step >= selected.length) selected.length = step + 1;
        if (editMode == MODE_STEPS) { selected.steps[step] = !selected.steps[step]; rackWebPaint = selected.steps[step]; rackWebDrag = 1; }
        else if (editMode == MODE_ACC) { selected.accents[step] = !selected.accents[step]; rackWebPaint = selected.accents[step]; if (rackWebPaint) selected.steps[step] = true; rackWebDrag = 3; }
        else { const float value = clamp(1.f - (y - (35.f + row * 20.f)) / 18.f, 0.f, 1.f); (editMode == MODE_PROB ? selected.probabilities[step] : selected.velocities[step]) = value; selected.steps[step] = true; rackWebDrag = 2; rackWebDragStep = step; }
        return;
      }
    }
    if (event != 1) return;
    Pattern& selected = patterns[editPattern];
    if (rackWebDrag == 1 && step >= 0 && step < selected.length) selected.steps[step] = rackWebPaint;
    else if (rackWebDrag == 3 && step >= 0 && step < selected.length) { selected.accents[step] = rackWebPaint; if (rackWebPaint) selected.steps[step] = true; }
    else if (rackWebDrag == 4 && length >= 0) selected.length = length + 1;
    else if (rackWebDrag == 5 && pattern >= 0) editPattern = pattern;
    else if (rackWebDrag == 6 && repeat >= 0) selected.repeats = repeat + 1;
    else if (rackWebDrag == 2 && rackWebDragStep >= 0) {
      const int dragRow = rackWebDragStep / 8;
      const float value = clamp(1.f - (y - (35.f + dragRow * 20.f)) / 18.f, 0.f, 1.f);
      (editMode == MODE_PROB ? selected.probabilities[rackWebDragStep] : selected.velocities[rackWebDragStep]) = value;
    }
  }`;
}

function chanceAdapter() {
  return `
  static constexpr int rackWebHeaderSize = 11;
  static constexpr int rackWebPatternStride = 12;
  std::array<float, rackWebHeaderSize + NUM_NODES * 5 + NUM_NODES * rackWebPatternStride + NUM_NODES * NUM_NODES> rackWebDisplay {};
  int rackWebDragPattern = -1;
  int rackWebVisualCount() const override { return static_cast<int>(rackWebDisplay.size()); }
  float* rackWebVisualBuffer() override {
    rackWebDisplay[0] = static_cast<float>(editPat); rackWebDisplay[1] = static_cast<float>(playPat);
    rackWebDisplay[2] = static_cast<float>(curRepeat); rackWebDisplay[3] = static_cast<float>(curNodeIdx);
    rackWebDisplay[4] = static_cast<float>(maxPosDeg); rackWebDisplay[5] = dispRunning ? 1.f : 0.f;
    rackWebDisplay[6] = static_cast<float>(curRoot); rackWebDisplay[7] = static_cast<float>(curScale);
    rackWebDisplay[8] = harmonyEnabled() ? 1.f : 0.f; rackWebDisplay[9] = static_cast<float>(seqLen);
    rackWebDisplay[10] = static_cast<float>(previewLen);
    for (int node = 0; node < NUM_NODES; ++node) {
      rackWebDisplay[11 + node] = static_cast<float>(coreNote[node]);
      rackWebDisplay[19 + node] = static_cast<float>(playNote[node]);
      rackWebDisplay[27 + node] = static_cast<float>(harmNote[node]);
      rackWebDisplay[35 + node] = pathRest[node] ? 1.f : 0.f;
      rackWebDisplay[43 + node] = static_cast<float>(seq[node]);
      const int offset = 51 + node * rackWebPatternStride;
      rackWebDisplay[offset] = patActive(node) ? 1.f : 0.f;
      rackWebDisplay[offset + 1] = static_cast<float>(patRepeats(node));
      rackWebDisplay[offset + 2] = patternReseed[node] ? 1.f : 0.f;
      rackWebDisplay[offset + 3] = static_cast<float>(node == playPat ? curRepeat : 0);
      for (int point = 0; point < NUM_NODES; ++point) rackWebDisplay[offset + 4 + point] = static_cast<float>(patShape[node][point]);
    }
    const int gateOffset = 51 + NUM_NODES * rackWebPatternStride;
    for (int pattern = 0; pattern < NUM_NODES; ++pattern)
      for (int step = 0; step < NUM_NODES; ++step)
        rackWebDisplay[gateOffset + pattern * NUM_NODES + step] = static_cast<float>(patternGate[pattern][step]);
    return rackWebDisplay.data();
  }
${eventDecoder}
  void rackWebTriggerAction(int id, bool active) override {
    if (!active) return;
    int event, ix, iy; bool shift;
    if (!rackWebDecodeAction(id, event, ix, iy, shift)) return;
    const float x = 14.f + static_cast<float>(ix) / 1023.f * 400.f;
    const float y = static_cast<float>(iy) / 1023.f * 178.f;
    int pattern = -1;
    for (int index = 0; index < NUM_NODES; ++index) if (x >= 18.f + index * 49.f && x < 65.f + index * 49.f) { pattern = index; break; }
    if (event == 2) { rackWebDragPattern = -1; return; }
    if ((event == 4 || event == 5) && pattern >= 0 && y >= 19.f && y < 54.f) {
      auto& value = params[PATREP_PARAM + pattern];
      value.setValue(clamp(value.getValue() + (event == 4 ? 1.f : -1.f), 1.f, 8.f)); return;
    }
    if (event == 3 && pattern >= 0 && y >= 19.f && y < 47.f) {
      auto& value = params[PATTERN_PARAM + pattern]; value.setValue(value.getValue() > .5f ? 0.f : 1.f); return;
    }
    if (event == 0 && pattern >= 0) {
      const float localX = x - (18.f + pattern * 49.f);
      if (y >= 20.5f && y < 31.5f && localX >= 34.f && localX < 45.f) { patternReseed[pattern] = !patternReseed[pattern]; return; }
      if (y >= 49.f && y < 54.f) { rackWebDragPattern = pattern; params[PATREP_PARAM + pattern].setValue(clamp(std::floor(localX / (47.f / 8.f)) + 1.f, 1.f, 8.f)); return; }
      if (y >= 19.f && y < 47.f) { editPat = pattern; return; }
      if (y >= 62.f && y < 80.f) { int& gate = patternGate[editPat][pattern]; gate = shift ? (gate == 2 ? 1 : 2) : (gate == 0 ? 1 : 0); recomputePending = true; return; }
    }
    if (event == 1 && rackWebDragPattern >= 0) {
      const float localX = x - (18.f + rackWebDragPattern * 49.f);
      params[PATREP_PARAM + rackWebDragPattern].setValue(clamp(std::floor(localX / (47.f / 8.f)) + 1.f, 1.f, 8.f));
    }
  }`;
}

function noteAdapter() {
  return `
  static constexpr int rackWebHeaderSize = 8;
  static constexpr int rackWebPatternStride = 3 + N_STEPS * 5;
  std::array<float, rackWebHeaderSize + N_PATTERNS * rackWebPatternStride> rackWebDisplay {};
  int rackWebDrag = 0, rackWebDragColumn = -1, rackWebDragPitch = -1;
  bool rackWebPaint = false;
  int rackWebVisualCount() const override { return static_cast<int>(rackWebDisplay.size()); }
  float* rackWebVisualBuffer() override {
    rackWebDisplay[0] = static_cast<float>(editPattern); rackWebDisplay[1] = static_cast<float>(playPattern);
    rackWebDisplay[2] = static_cast<float>(playStep); rackWebDisplay[3] = static_cast<float>(currentBar);
    rackWebDisplay[4] = static_cast<float>(editMode); rackWebDisplay[5] = static_cast<float>(rootNote);
    rackWebDisplay[6] = static_cast<float>(scaleIndex); rackWebDisplay[7] = static_cast<float>(octaveShift);
    for (int pattern = 0; pattern < N_PATTERNS; ++pattern) {
      const int offset = rackWebHeaderSize + pattern * rackWebPatternStride;
      rackWebDisplay[offset] = patterns[pattern].active ? 1.f : 0.f;
      rackWebDisplay[offset + 1] = static_cast<float>(patterns[pattern].length);
      rackWebDisplay[offset + 2] = static_cast<float>(patterns[pattern].repeats);
      for (int step = 0; step < N_STEPS; ++step) {
        rackWebDisplay[offset + 3 + step * 5] = static_cast<float>(patterns[pattern].pitches[step]);
        rackWebDisplay[offset + 4 + step * 5] = patterns[pattern].velocities[step];
        rackWebDisplay[offset + 5 + step * 5] = patterns[pattern].accents[step] ? 1.f : 0.f;
        rackWebDisplay[offset + 6 + step * 5] = patterns[pattern].probabilities[step];
        rackWebDisplay[offset + 7 + step * 5] = patterns[pattern].legato[step] ? 1.f : 0.f;
      }
    }
    return rackWebDisplay.data();
  }
${eventDecoder}
  static int rackWebCell(float value, float start, float pitch, int count, float size) {
    for (int index = 0; index < count; ++index) if (value >= start + index * pitch && value < start + index * pitch + size) return index;
    return -1;
  }
  void rackWebTriggerAction(int id, bool active) override {
    if (!active) return;
    int event, ix, iy; bool shift;
    if (!rackWebDecodeAction(id, event, ix, iy, shift)) return;
    const float x = static_cast<float>(ix) / 1023.f * 174.f;
    const float y = static_cast<float>(iy) / 1023.f * 228.f;
    const int tab = y >= 8.f && y < 26.f ? rackWebCell(x, 7.f, 40.f, 4, 38.f) : -1;
    const int column = rackWebCell(x, 7.f, 20.f, 8, 18.f);
    const int visualRow = y >= 35.f && y < 152.f ? clamp(static_cast<int>((y - 35.f) / 9.f), 0, 12) : -1;
    const int pitch = visualRow >= 0 ? 12 - visualRow : -1;
    const int length = y >= 156.f && y < 164.f ? column : -1;
    const int pattern = y >= 190.f && y < 208.f ? column : -1;
    const int repeat = y >= 216.f && y < 224.f ? column : -1;
    if (event == 3 && pattern >= 0) { patterns[pattern].active = !patterns[pattern].active; if (!patterns[playPattern].active) { playPattern = nextActivePattern(playPattern); playStep = 0; } return; }
    if ((event == 4 || event == 5) && pattern >= 0) { patterns[pattern].repeats = clamp(patterns[pattern].repeats + (event == 4 ? 1 : -1), 1, N_REPEATS); return; }
    if (event == 2) { rackWebDrag = 0; rackWebDragColumn = -1; rackWebDragPitch = -1; return; }
    if (event == 0) {
      if (tab >= 0) { editMode = tab; return; }
      if (pattern >= 0) { editPattern = pattern; rackWebDrag = 5; return; }
      if (repeat >= 0) { patterns[editPattern].repeats = repeat + 1; rackWebDrag = 6; return; }
      if (length >= 0) { patterns[editPattern].length = length + 1; rackWebDrag = 4; return; }
      if (column >= 0 && visualRow >= 0) {
        Pattern& selected = patterns[editPattern];
        if (shift) { selected.legato[column] = !selected.legato[column]; return; }
        if ((editMode == MODE_STEPS || editMode == MODE_ACC) && pitch >= currentRowCount()) return;
        if (editMode == MODE_STEPS) { selected.legato[column] = false; selected.pitches[column] = selected.pitches[column] == pitch ? -1 : pitch; rackWebDragPitch = selected.pitches[column]; rackWebDrag = 1; }
        else if (editMode == MODE_ACC) { selected.accents[column] = !selected.accents[column]; rackWebPaint = selected.accents[column]; if (rackWebPaint && selected.pitches[column] < 0) selected.pitches[column] = pitch; rackWebDrag = 3; }
        else { const float value = clamp(1.f - (y - 35.f) / 117.f, 0.f, 1.f); (editMode == MODE_PROB ? selected.probabilities[column] : selected.velocities[column]) = value; rackWebDrag = 2; rackWebDragColumn = column; }
        return;
      }
    }
    if (event != 1) return;
    Pattern& selected = patterns[editPattern];
    if (rackWebDrag == 1 && column >= 0 && column < selected.length) { selected.pitches[column] = rackWebDragPitch; selected.legato[column] = false; }
    else if (rackWebDrag == 3 && column >= 0 && column < selected.length) { selected.accents[column] = rackWebPaint; if (rackWebPaint && selected.pitches[column] < 0 && pitch >= 0 && pitch < currentRowCount()) selected.pitches[column] = pitch; }
    else if (rackWebDrag == 4 && length >= 0) selected.length = length + 1;
    else if (rackWebDrag == 5 && pattern >= 0) editPattern = pattern;
    else if (rackWebDrag == 6 && repeat >= 0) selected.repeats = repeat + 1;
    else if (rackWebDrag == 2 && rackWebDragColumn >= 0) { const float value = clamp(1.f - (y - 35.f) / 117.f, 0.f, 1.f); (editMode == MODE_PROB ? selected.probabilities[rackWebDragColumn] : selected.velocities[rackWebDragColumn]) = value; }
  }`;
}

export function adaptSignalFunctionSetBrowserSource(source, model) {
  source = repairSignalFunctionSetSource(source, model);
  const body =
    model === "Beat"
      ? beatAdapter()
      : model === "Chance"
        ? chanceAdapter()
        : model === "Note"
          ? noteAdapter()
          : adapters[model];
  return body
    ? replaceExport(source, model, body)
    : source;
}

export const signalFunctionSetActionContract = {
  actionBase: ACTION_BASE,
  eventShift: EVENT_SHIFT,
};

const visualGeometry = {
  Arrange: [11.811, 35.433, 366.142, 143.799],
  Band: [15, 34.99, 330, 88.583],
  Beat: [7.087, 36.024, 135.827, 121.063],
  Chance: [14.764, 35.433, 360.236, 160.335],
  Cycle: [15, 34.99, 360, 87.49],
  Gravity: [135.827, 100.394, 177.165, 177.165],
  Intone: [17.126, 41.339, 205.748, 70.866],
  Meter: [8.858, 35.433, 252.283, 76.772],
  MeterX: [0, 0, 120, 380],
  Muse: [274.99, 45.502, 159.449, 206.693],
  MuseScope: [274.99, 258.1, 159.449, 41.339],
  Note: [7.087, 35.433, 135.827, 177.165],
  Overtone: [17.126, 41.339, 115.748, 70.866],
  OpEnv: [12.5, 36.407, 274.606, 88.583],
  Operator: [7.087, 35.433, 135.827, 124.104],
  Phase: [7.5, 41.339, 270, 70.866],
  Play: [11.811, 35.433, 215.551, 168.307],
  Record: [11.811, 35.433, 215.551, 168.307],
  Swell: [7.087, 35.433, 75.886, 53.15],
  Wave: [10.335, 35.433, 219.39, 94.488],
};

export function signalFunctionSetVisuals(model) {
  const views = model === "Muse" ? ["Muse", "MuseScope"] : [model];
  return views.flatMap((view) => {
    const geometry = visualGeometry[view];
    if (
      !geometry ||
      (!adapters[model] && !["Beat", "Chance", "Note"].includes(model))
    )
      return [];
    const [x, y, width, height] = geometry;
    return [
      {
        kind: "signal-function-set",
        model: view,
        actionBase: ACTION_BASE,
        eventShift: EVENT_SHIFT,
        x,
        y,
        width,
        height,
      },
    ];
  });
}
