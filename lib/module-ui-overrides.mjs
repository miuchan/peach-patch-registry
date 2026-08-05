const hiddenPanelParams = new Map([
  ["23volts/Morph", new Set([8, 9])],
  ["AriaSalvatrice/Q", new Set([52, 53, 54])],
  ["AriaSalvatrice/Quack", new Set([54])],
  // These controls are deliberately constructed wholly outside their native
  // Rack panels and are not part of the visible UI.
  ["AuntyLangtonsFree/MusicalAnt", new Set([14])],
  ["Myth/Molphar", new Set([25])],
  ["RJModules/KTF", new Set([4])],
  ["RJModules/RangeLFO", new Set([0, 3, 4, 5, 6])],
]);

const contextOnlyParams = new Map([
  ["ModularFungi/Opsylloscope", new Set([5, 7, 8, 13, 16, 17, 19])],
]);

const runtimeVisuals = new Map([
  [
    "23volts/Morph",
    {
      kind: "morph-pad",
      xParam: 8,
      yParam: 9,
      x: 0,
      y: 23,
      width: 195,
      height: 162,
    },
  ],
]);

const reviewedParamPositions = new Map([
  [
    "FrozenWasteland/SeriouslySlowEG",
    new Map([
      // The locked upstream source contains `Vec(97, 2537)` for the Attack
      // Days button while its matching light and every neighbouring row prove
      // the intended y coordinate is 237 (center y = 246).
      [
        10,
        {
          x: 106,
          y: 246,
          width: 18,
          height: 18,
          centered: true,
          widget: "rack::componentlibrary::VCVButton",
        },
      ],
    ]),
  ],
]);

/**
 * Applies source-reviewed semantics for controls that intentionally do not own
 * a native ParamWidget. This shared layer keeps source scaffolds and native UI
 * refreshes from disagreeing about custom displays, context menus, and module
 * variants that share a larger DSP parameter enum.
 */
export function applyModuleUiOverrides(module) {
  const hidden = hiddenPanelParams.get(module.key);
  const contextOnly = contextOnlyParams.get(module.key);
  const reviewedPositions = reviewedParamPositions.get(module.key);
  const params = module.params.map((param) => {
    if (hidden?.has(param.id)) {
      const { position: _position, contextOnly: _contextOnly, ...rest } = param;
      return { ...rest, hidden: true };
    }
    if (contextOnly?.has(param.id)) {
      const { position: _position, hidden: _hidden, ...rest } = param;
      return { ...rest, contextOnly: true };
    }
    const position = reviewedPositions?.get(param.id);
    if (position) {
      const { hidden: _hidden, contextOnly: _contextOnly, ...rest } = param;
      return { ...rest, position };
    }
    return param;
  });
  const visual = runtimeVisuals.get(module.key);
  if (!visual) return { ...module, params };
  const visuals = [
    ...(module.runtime?.visuals ?? []).filter(
      (candidate) => candidate.kind !== visual.kind,
    ),
    visual,
  ];
  return { ...module, params, runtime: { ...(module.runtime ?? {}), visuals } };
}
