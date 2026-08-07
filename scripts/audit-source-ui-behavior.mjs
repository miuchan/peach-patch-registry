import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const registry = JSON.parse(readFileSync("index.json", "utf8"));
const discovery = JSON.parse(readFileSync(".build/open-source-modules.json", "utf8"));
const records = new Map(discovery.moduleRecords.map((record) => [record.key, record]));
const sourceRoots = [
  ".build/ui-interaction-audit/sources",
  ".build/native-module-ui/sources",
  ".build/ui-geometry/sources",
  ".build/panel-widths/sources",
  ".build/sources",
];

function exactSource(module) {
  for (const root of sourceRoots) {
    const candidate = path.join(root, module.plugin, module.sourceCommit ?? "");
    try {
      if (statSync(path.join(candidate, "plugin.json")).isFile()) return candidate;
    } catch {}
  }
  if (!module.sourceCommit) {
    for (const root of sourceRoots) {
      const pluginRoot = path.join(root, module.plugin);
      try {
        for (const entry of readdirSync(pluginRoot, { withFileTypes: true })) {
          if (!entry.isDirectory()) continue;
          const candidate = path.join(pluginRoot, entry.name);
          if (statSync(path.join(candidate, "plugin.json")).isFile()) return candidate;
        }
      } catch {}
    }
  }
  return null;
}

function sourceFiles(root) {
  const result = [];
  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if ([".git", "build", "dep", "deps", "vendor", "test", "tests"].includes(entry.name))
        continue;
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(target);
      else if (/\.(?:cpp|cc|cxx|h|hh|hpp)$/i.test(entry.name)) result.push(target);
    }
  }
  visit(root);
  return result.map((file) => ({ file, source: readFileSync(file, "utf8") }));
}

function closingBrace(source, open) {
  let depth = 0;
  let quoted = null;
  let escaped = false;
  for (let index = open; index < source.length; index++) {
    const character = source[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quoted) quoted = null;
      continue;
    }
    if (character === '"' || character === "'") quoted = character;
    else if (character === "{") depth += 1;
    else if (character === "}" && --depth === 0) return index;
  }
  return -1;
}

function typeContract(files, type) {
  const name = String(type).split("::").at(-1).replace(/<.*$/, "").trim();
  if (!/^\w+$/.test(name)) return null;
  for (const item of files) {
    const expression = new RegExp(`\\b(?:struct|class)\\s+${name}\\b([^;{]*)\\{`, "g");
    const match = expression.exec(item.source);
    if (!match) continue;
    const open = item.source.indexOf("{", match.index);
    const close = closingBrace(item.source, open);
    if (close < 0) continue;
    const body = item.source.slice(open + 1, close);
    const implementations = files
      .flatMap((candidate) => [
        ...candidate.source.matchAll(
          new RegExp(`\\b${name}\\s*::\\s*(?:${name}|onButton|onDragStart|onDragMove|onDragEnd|onHoverKey|onHoverScroll|onSelectKey|onDoubleClick|onHover|onScroll|drawLayer|draw)\\s*\\(`, "g"),
        ),
      ])
      .map((implementation) => {
        const source = files.find((candidate) => candidate.source === implementation.input)?.source;
        const bodyOpen = source?.indexOf("{", implementation.index) ?? -1;
        const bodyClose = bodyOpen < 0 ? -1 : closingBrace(source, bodyOpen);
        return bodyOpen < 0 || bodyClose < 0 ? "" : source.slice(implementation.index, bodyClose + 1);
      })
      .join("\n");
    const bases = match[1]
      .replace(/^\s*:/, "")
      .split(",")
      .map((base) => base.replace(/\b(?:public|protected|private|virtual)\b/g, "").trim())
      .filter(Boolean);
    return { name, bases, source: `${body}\n${implementations}`, file: item.file };
  }
  return null;
}

function widgetClassFor(files, model) {
  const quoted = model.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const item of files) {
    for (const match of item.source.matchAll(/\bcreate\w*Model\s*<([^>]+)>\s*\(([^;]+)\)/g)) {
      if (!new RegExp(`["']${quoted}["']`).test(match[2])) continue;
      const arguments_ = match[1].split(",").map((value) => value.trim());
      return { file: item.file, moduleType: arguments_[0], type: arguments_.at(-1) };
    }
  }
  return null;
}

function codeOnly(source) {
  let result = "";
  let mode = "code";
  let escaped = false;
  for (let index = 0; index < source.length; index++) {
    const current = source[index];
    const next = source[index + 1];
    if (mode === "line") {
      if (current === "\n") {
        mode = "code";
        result += current;
      } else result += " ";
      continue;
    }
    if (mode === "block") {
      if (current === "*" && next === "/") {
        result += "  ";
        index += 1;
        mode = "code";
      } else result += current === "\n" ? "\n" : " ";
      continue;
    }
    if (mode === "quote") {
      result += current === "\n" ? "\n" : " ";
      if (escaped) escaped = false;
      else if (current === "\\") escaped = true;
      else if (current === '"') mode = "code";
      continue;
    }
    if (mode === "apostrophe") {
      result += current === "\n" ? "\n" : " ";
      if (escaped) escaped = false;
      else if (current === "\\") escaped = true;
      else if (current === "'") mode = "code";
      continue;
    }
    if (current === "/" && next === "/") {
      result += "  ";
      index += 1;
      mode = "line";
    } else if (current === "/" && next === "*") {
      result += "  ";
      index += 1;
      mode = "block";
    } else if (current === '"') {
      result += " ";
      mode = "quote";
    } else if (current === "'") {
      result += " ";
      mode = "apostrophe";
    } else result += current;
  }
  return result;
}

function interactionMethods(source) {
  const masked = maskNestedTypeBodies(codeOnly(source));
  const methods = [];
  const pattern =
    /\b(onButton|onDragStart|onDragMove|onDragEnd|onHoverKey|onHoverScroll|onSelectKey|onDoubleClick|onHover|onScroll)\s*\([^;{}]*\)\s*(?:const\s*)?(?:override\s*)?\{/g;
  for (const match of masked.matchAll(pattern)) {
    const open = masked.indexOf("{", match.index);
    const close = closingBrace(masked, open);
    if (open < 0 || close < 0) continue;
    const body = masked.slice(open + 1, close);
    let semantic = body
      .replace(/\b[A-Za-z_]\w*(?:::[A-Za-z_]\w*)*::on(?:Button|DragStart|DragMove|DragEnd|HoverKey|HoverScroll|SelectKey|DoubleClick|Hover|Scroll)\s*\([^;]*\)\s*;/g, "")
      .replace(/\b(?:e|event)\.consume\s*\([^;]*\)\s*;/g, "")
      .replace(/\(\s*void\s*\)\s*(?:e|event)\s*;/g, "")
      .replace(/\breturn\s*;/g, "");
    const locals = [
      ...semantic.matchAll(
        /\b(?:bool|char|short|int|long|float|double|size_t|unsigned(?:\s+int)?|auto)\s+([A-Za-z_]\w*)\s*(?:=\s*[^;()]+)?;/g,
      ),
    ].map((local) => local[1]);
    semantic = semantic.replace(
      /\b(?:bool|char|short|int|long|float|double|size_t|unsigned(?:\s+int)?|auto)\s+[A-Za-z_]\w*\s*(?:=\s*[^;()]+)?;/g,
      "",
    );
    for (const local of locals) {
      const escaped = local.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      semantic = semantic.replace(
        new RegExp(`\\b${escaped}\\s*(?:=|\\+=|-=|\\*=|/=)\\s*[^;()]+;`, "g"),
        "",
      );
    }
    const inert = semantic
      .replace(/\b(?:if|else\s+if|while|switch)\s*\([^{}]*\)/g, "")
      .replace(/\belse\b/g, "")
      .replace(/[{};\s]/g, "");
    if (inert) methods.push(match[1]);
  }
  return methods;
}

/**
 * A module widget frequently declares parameter widgets, menu items, and text
 * fields inside its class body. Their callbacks are not callbacks of the
 * surrounding module panel. Keep line/offset stability while hiding those
 * nested contracts so each method is attributed only to the type that owns it.
 */
function maskNestedTypeBodies(source) {
  const output = [...source];
  const pattern = /\b(?:struct|class|enum(?:\s+class)?)\s+[A-Za-z_]\w*[^;{}]*\{/g;
  for (const match of source.matchAll(pattern)) {
    const open = source.indexOf("{", match.index);
    const close = open < 0 ? -1 : closingBrace(source, open);
    if (close < 0) continue;
    for (let index = match.index; index <= close; index++) {
      if (output[index] !== "\n") output[index] = " ";
    }
    pattern.lastIndex = close + 1;
  }
  return output.join("");
}

function isParamWidget(files, type, seen = new Set()) {
  const name = String(type).split("::").at(-1).replace(/<.*$/, "").trim();
  if (/^(?:ParamWidget|Knob|Switch|Slider|SvgKnob|SvgSwitch|SvgSlider)$/.test(name)) return true;
  if (!name || seen.has(name)) return false;
  seen.add(name);
  const contract = typeContract(files, name);
  if (contract) return contract.bases.some((base) => isParamWidget(files, base, seen));
  // Rack/component-library leaves are not always defined in the plugin source.
  // Apply the name fallback only after proving there is no local contract, so
  // a display called e.g. DisplayToggleSwitch is not mistaken for a ParamWidget.
  return /(?:ParamWidget|Knob|Switch|Slider|Button|Trimpot|Potentiometer)$/i.test(name);
}

const pluginCache = new Map();
const results = [];
for (const module of registry.packages.filter((module) => module.hidden !== true)) {
  const record = records.get(module.key) ?? {};
  const tags = (record.tags ?? []).map((tag) => tag.toLowerCase());
  const visualTagged = tags.includes("visual");
  const directory = exactSource(module);
  if (!directory) {
    results.push({
      key: module.key,
      visualTagged,
      source: module.plugin === "Core" ? "builtin" : "missing",
      visuals: (module.runtime?.visuals ?? []).map((visual) => visual.kind),
    });
    continue;
  }
  let files = pluginCache.get(directory);
  if (!files) {
    files = sourceFiles(directory);
    pluginCache.set(directory, files);
  }
  const registration = widgetClassFor(files, module.model);
  const widget = registration ? typeContract(files, registration.type) : null;
  const moduleContract = registration ? typeContract(files, registration.moduleType) : null;
  const moduleCode = moduleContract ? codeOnly(moduleContract.source) : "";
  const widgetCode = widget ? codeOnly(widget.source) : "";
  const childTypes = widget
    ? [
        ...widgetCode.matchAll(
          /(?:create(?:Widget|WidgetCentered)|new)\s*(?:<\s*)?([A-Za-z_]\w*(?:::[A-Za-z_]\w*)*)/g,
        ),
      ].map((match) => match[1])
    : [];
  const contracts = [widget, ...childTypes.map((type) => typeContract(files, type))].filter(Boolean);
  const drawTypes = contracts
    .filter((contract) => /\b(?:draw|drawLayer)\s*\(/.test(codeOnly(contract.source)))
    .map((contract) => contract.name);
  const interactions = contracts.flatMap((contract) =>
    interactionMethods(contract.source)
      .filter((method) => {
        if (contract.name !== "KilpatrickLabel") return true;
        const callback = method === "onButton" ? "onLabelButton" : "onLabelHoverScroll";
        return new RegExp(`\\b${callback}\\s*\\(`).test(moduleCode);
      })
      .map((method) => ({
        type: contract.name,
        method,
        paramWidget: isParamWidget(files, contract.name),
      })),
  );
  // Core Rack text-entry widgets inherit their editing callbacks from Rack,
  // so a plugin can create a fully interactive field without declaring a
  // single onButton()/onSelectKey() method of its own. Treat construction of
  // those controls as an interaction contract instead of silently dropping it.
  for (const type of childTypes) {
    const name = String(type).split("::").at(-1);
    if (!/(?:^|\w)(?:LedDisplay)?TextField$/i.test(name)) continue;
    interactions.push({ type: name, method: "inheritedTextEditing", paramWidget: false });
  }
  results.push({
    key: module.key,
    visualTagged,
    source: directory,
    widget: registration?.type ?? null,
    childTypes: [...new Set(childTypes)],
    drawTypes: [...new Set(drawTypes)],
    interactions: interactions.filter(
      (item, index) =>
        interactions.findIndex(
          (candidate) => candidate.type === item.type && candidate.method === item.method,
        ) === index,
    ),
    visuals: (module.runtime?.visuals ?? []).map((visual) => visual.kind),
    hoverActions: module.runtime?.hoverActions?.length ?? 0,
    hotkey: Boolean(module.runtime?.hotkey),
    globalPointer: Boolean(module.runtime?.globalPointer),
    contextControls:
      (module.params ?? []).filter((param) => param.contextOnly).length +
      (module.stateKeys ?? []).filter((state) => state.contextOnly).length,
    paramContextActions: (module.params ?? []).filter((param) => param.contextActions?.length).length,
  });
}

const report = {
  packageCount: results.length,
  sourceComplete: results.filter((item) => item.source !== "missing").length,
  sourceMissing: results.filter((item) => item.source === "missing").map((item) => item.key),
  visualTagged: results.filter((item) => item.visualTagged).length,
  missingVisuals: results
    .filter(
      (item) =>
        item.visualTagged && item.visuals.length === 0 && (item.drawTypes?.length ?? 0) > 0,
    )
    .map((item) => ({ key: item.key, drawTypes: item.drawTypes })),
  missingNonParamInteractions: results
    .filter(
      (item) =>
        item.interactions?.some((interaction) => !interaction.paramWidget) &&
        item.hoverActions === 0 &&
        !item.hotkey &&
        !item.globalPointer &&
        item.paramContextActions === 0 &&
        !(
          item.contextControls > 0 &&
          item.interactions.every((interaction) =>
            ["inheritedTextEditing", "onSelectKey"].includes(interaction.method),
          )
        ) &&
        !item.visuals.some((kind) =>
          [
            "signal-function-set",
            "alikins-hover-bridge",
            "touch-ribbon",
            "linear-ribbon",
            "voxglitch-xy",
            "param-xy-points",
            "crawl-display",
            "cell-grid",
            "morph-pad",
            "sequencer-grid",
            "phase-distortion-pad",
            "walk2-display",
            "vertical-position",
            "mouse-seq-grid",
            "cyclic-ca",
            "db-matrix",
            "flame-spectrogram",
            "path-trackpad",
            "digital-sequencer",
            "hazumi-sequencer",
            "stoch-sequencer",
            "spectrum-analyzer",
            "spectrogram",
            "wavetable-editor",
            "bidoo-sample",
            "bidoo-limonade",
            "fw-cell-bar-grid",
            "filling-station",
            "qar-rhythm",
            "cellular-auto",
            "saros-envelope",
            "trg-sequencer",
            "polar-cv-display",
            "axioma-display",
            "alias-display",
            "chord-chemist-display",
            "runshow-display",
            "sd-lines-display",
            "note-poly-display",
            "lofi-tv-display",
            "cosmic-clock-display",
            "lua-display",
            "catro-color-display",
            "panel-color",
            "vertical-label",
            "value-label",
            "editable-text",
            "specific-value",
            "native-interaction",
            "storage-scope",
            "rack-row-tool",
            "computerscare-figure",
            "computerscare-blank",
            "temporal-deck",
            "undertow-preview",
            "lomas-sampler",
            "madzine-launchpad",
            "song-mode-sequence",
            "the-kick-sample",
            "universal-rhythm",
            "madzine-waveform",
            "midi-log",
            "ml-arpeggiator",
            "madzine-scope",
            "wolfram-display",
            "corrupter-display",
            "octobir-display",
            "klokspid-dmd",
            "rkd-dividers",
            "alefsbits-turnt",
            "scribble-strip",
            "palette-engine-selector",
            "dot-matrix-text",
            "spellbook-editor",
            "digital-programmer",
            "modllz-kn8b",
            "modllz-midi-poly-mpe",
            "modllz-xpand",
            "sapphire-moots",
            "sapphire-output-selector",
            "kilpatrick-joystick",
            "kilpatrick-stereo-meter",
            "kilpatrick-test-osc",
            "sloly-pit-routing",
            "probably-note-mn",
            "voxglitch-arpseq",
            "dress-me-up",
            "bouncy-balls",
            "sort-step",
            "bacon-footer",
            "lint-buddy",
            "jw-grid",
            "jw-d1v1de",
            "jw-thing-thing",
            "jw-tree",
            "biset-tree",
            "biset-regex",
            "biset-tracker",
            "biset-tracker-output",
            "biset-tracker-state",
            "biset-blank-overlay",
            "flying-fader",
            "algomorph-display",
            "xy-pad",
            "less-mess-labels",
            "tapestry-display",
          ].includes(kind),
        ),
    )
    .map((item) => ({
      key: item.key,
      interactions: item.interactions.filter((interaction) => !interaction.paramWidget),
    })),
  results,
};
writeFileSync(
  ".build/module-behavior-audit.json",
  `${JSON.stringify(report, null, 2)}\n`,
);
process.stdout.write(
  `${JSON.stringify(
    {
      packageCount: report.packageCount,
      sourceComplete: report.sourceComplete,
      sourceMissing: report.sourceMissing.length,
      visualTagged: report.visualTagged,
      missingVisuals: report.missingVisuals.length,
      missingNonParamInteractions: report.missingNonParamInteractions.length,
    },
    null,
    2,
  )}\n`,
);
