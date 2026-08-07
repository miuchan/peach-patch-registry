#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scaffoldLibraryModule } from "./scaffold-library-module.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function target(url) {
  const parsed = new URL(url);
  const parts = parsed.pathname.split("/").filter(Boolean);
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== "library.vcvrack.com" ||
    parts.length !== 2 ||
    parts.some((part) => !/^[A-Za-z0-9_-]+$/.test(part))
  )
    throw new Error(`Invalid VCV Library module URL: ${url}`);
  return { key: parts.join("/"), plugin: parts[0], model: parts[1] };
}

async function compile(url, output, sourceCache, sourceTool) {
  const stdout = process.stdout.write.bind(process.stdout);
  process.stdout.write = () => true;
  try {
    const argumentsList = [
      url,
      "--source-cache-dir",
      sourceCache,
      "--output",
      output,
      "--compile",
    ];
    if (sourceTool) argumentsList.push("--source-tool", sourceTool);
    await scaffoldLibraryModule(argumentsList);
  } finally {
    process.stdout.write = stdout;
  }
}

function stageRuntimeResources(module, output) {
  if (
    module.key !== "BGal256/DressMeUp" &&
    module.key !== "Cella/Loud" &&
    module.key !== "CosineKitty-Sapphire/Moots" &&
    module.key !== "voxglitch/onepoint" &&
    module.key !== "voxglitch/onezero" &&
    module.key !== "wiqid-anomalies/fullscope" &&
    module.key !== "Ahornberg/FlyingFader" &&
    module.key !== "DelexanderVol1/Algomorph" &&
    module.key !== "DelexanderVol1/AlgomorphSmall" &&
    module.key !== "Biset/Biset-Regex" &&
    module.key !== "Biset/Biset-Regex-Condensed" &&
    module.key !== "Biset/Biset-Blank" &&
    !module.key.startsWith("Biset/Biset-Tracker") &&
    module.plugin !== "Kilpatrick-Toolbox" &&
    module.plugin !== "alefsbits"
  )
    return;
  const adapter = JSON.parse(fs.readFileSync(path.join(output, "adapter.json"), "utf8"));
  const sourceDirectory = adapter.source?.directory;
  if (typeof sourceDirectory !== "string")
    throw new Error(`${module.key} scaffold does not record its source directory`);
  const destination = path.join(output, "resources");
  fs.rmSync(destination, { recursive: true, force: true });
  fs.mkdirSync(destination, { recursive: true });
  if (module.key === "Biset/Biset-Blank") {
    for (const name of ["Blank.svg", "Blank-Wild.svg", "Blank-Gang.svg", "Blank-Army.svg", "FT88-Regular.ttf"])
      fs.copyFileSync(path.join(sourceDirectory, "res", name), path.join(destination, name));
    return;
  }
  if (
    module.key === "Biset/Biset-Regex" ||
    module.key === "Biset/Biset-Regex-Condensed" ||
    module.key.startsWith("Biset/Biset-Tracker")
  ) {
    fs.copyFileSync(
      path.join(sourceDirectory, "res", "FT88-Regular.ttf"),
      path.join(destination, "FT88-Regular.ttf"),
    );
    return;
  }
  if (module.key === "DelexanderVol1/Algomorph" || module.key === "DelexanderVol1/AlgomorphSmall") {
    const graphSource = fs.readFileSync(path.join(sourceDirectory, "src", "GraphData.cpp"), "utf8");
    const graphCount = 1980;
    const arrays = [
      ["xNodeData", 9],
      ["yNodeData", 9],
      ["moveCurveData", 18],
      ["xCurveData", 47],
      ["yCurveData", 47],
      ["xPolygonData", 90],
      ["yPolygonData", 90],
    ].map(([name, stride]) => {
      const declaration = new RegExp(`GraphData::${name}\\s*\\[[^=]+\\]\\s*=\\s*\\{`).exec(graphSource);
      if (!declaration) throw new Error(`${module.key} cannot find GraphData::${name}`);
      const open = graphSource.indexOf("{", declaration.index);
      let depth = 0;
      let close = -1;
      for (let index = open; index < graphSource.length; index += 1) {
        if (graphSource[index] === "{") depth += 1;
        else if (graphSource[index] === "}" && --depth === 0) {
          close = index;
          break;
        }
      }
      if (close < 0) throw new Error(`${module.key} has an unterminated GraphData::${name}`);
      const body = graphSource.slice(open + 1, close), rows = [];
      let rowDepth = 0, rowStart = -1;
      for (let index = 0; index < body.length; index += 1) {
        if (body[index] === "{") {
          if (rowDepth === 0) rowStart = index + 1;
          rowDepth += 1;
        } else if (body[index] === "}") {
          rowDepth -= 1;
          if (rowDepth === 0 && rowStart >= 0) {
            rows.push(body.slice(rowStart, index));
            rowStart = -1;
          }
        }
      }
      if (rows.length !== graphCount)
        throw new Error(`${module.key} GraphData::${name} has ${rows.length} rows; expected ${graphCount}`);
      const values = rows.flatMap((row, rowIndex) => {
        const parsed = Array.from(
          row.matchAll(/[-+]?(?:\d+\.\d*|\.\d+|\d+)(?:[eE][-+]?\d+)?/g),
          (match) => Number(match[0]),
        );
        if (parsed.length > Number(stride) || parsed.some((value) => !Number.isFinite(value)))
          throw new Error(
            `${module.key} GraphData::${name} row ${rowIndex} has ${parsed.length} values; expected at most ${stride}`,
          );
        return [...parsed, ...Array(Number(stride) - parsed.length).fill(0)];
      });
      const expected = graphCount * Number(stride);
      if (values.length !== expected)
        throw new Error(
          `${module.key} GraphData::${name} has ${values.length} values; expected ${expected}`,
        );
      return { name, stride: Number(stride), values };
    });
    const headerWords = 9;
    const byteLength = headerWords * 4 + arrays.reduce((sum, entry) => sum + entry.values.length * 4, 0);
    const graphFile = Buffer.allocUnsafe(byteLength);
    const header = [0x31474c41, graphCount, ...arrays.map((entry) => entry.stride)];
    header.forEach((value, index) => graphFile.writeUInt32LE(value, index * 4));
    let offset = headerWords * 4;
    for (const entry of arrays)
      for (const value of entry.values) {
        graphFile.writeFloatLE(value, offset);
        offset += 4;
      }
    fs.writeFileSync(path.join(destination, "algomorph-graphs.bin"), graphFile);
    fs.copyFileSync(
      path.join(sourceDirectory, "res", "MiriamLibre-Regular.ttf"),
      path.join(destination, "MiriamLibre-Regular.ttf"),
    );
    return;
  }
  if (module.key === "Ahornberg/FlyingFader") {
    fs.copyFileSync(
      path.join(sourceDirectory, "res", "fonts", "Comili-Book.ttf"),
      path.join(destination, "Comili-Book.ttf"),
    );
    for (const name of [
      "MotorizedFaderBackground.svg",
      ...["white", "grey", "black", "red", "blue", "green", "brown", "orange", "pink", "purple"].map(
        (color) => `MotorizedFaderHandle_${color}.svg`,
      ),
    ])
      fs.copyFileSync(path.join(sourceDirectory, "res", "knobs", name), path.join(destination, name));
    return;
  }
  if (module.key === "wiqid-anomalies/fullscope") {
    fs.copyFileSync(
      path.join(sourceDirectory, "res", "font", "OfficeCodePro-Light.ttf"),
      path.join(destination, "OfficeCodePro-Light.ttf"),
    );
    return;
  }
  if (module.key === "Cella/Loud") {
    for (const name of ["JetBrainsMono-Medium.ttf", "SofiaSansExtraCondensed-Regular.ttf"])
      fs.copyFileSync(path.join(sourceDirectory, "res", "fonts", name), path.join(destination, name));
    return;
  }
  if (module.plugin === "Kilpatrick-Toolbox") {
    fs.copyFileSync(
      path.join(sourceDirectory, "res", "components", "fixedsys.ttf"),
      path.join(destination, "fixedsys.ttf"),
    );
    return;
  }
  if (module.key === "voxglitch/onepoint" || module.key === "voxglitch/onezero") {
    fs.copyFileSync(
      path.join(sourceDirectory, "res", "fonts", "ShareTechMono-Regular.ttf"),
      path.join(destination, "ShareTechMono-Regular.ttf"),
    );
    return;
  }
  if (module.key === "CosineKitty-Sapphire/Moots") {
    for (const name of [
      "moots_label_gate.svg",
      "moots_label_gate_h.svg",
      "moots_label_trigger.svg",
      "moots_label_trigger_h.svg",
    ])
      fs.copyFileSync(path.join(sourceDirectory, "res", name), path.join(destination, name));
    return;
  }
  if (module.plugin === "alefsbits") {
    const runtime = JSON.parse(fs.readFileSync(path.join(output, "runtime.json"), "utf8"));
    const panels = (runtime.runtime?.visuals ?? []).filter(
      (visual) => visual.kind === "alefsbits-panel",
    );
    if (panels.length !== 1) throw new Error(`${module.key} has no unique alefsbits panel visual`);
    const panelFile = panels[0].panelFile;
    const source = path.resolve(sourceDirectory, "res", panelFile);
    const resourceRoot = path.resolve(sourceDirectory, "res");
    if (!source.startsWith(`${resourceRoot}${path.sep}`) || !fs.existsSync(source))
      throw new Error(`${module.key} panel resource is invalid: ${panelFile}`);
    const target = path.join(destination, panelFile);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
    return;
  }
  const imageRoot = path.join(sourceDirectory, "res", "images");
  for (const name of ["Background.png", "Body.png"])
    fs.copyFileSync(path.join(imageRoot, name), path.join(destination, name));
  fs.cpSync(path.join(imageRoot, "clothes"), path.join(destination, "clothes"), {
    recursive: true,
    filter: (source) => fs.statSync(source).isDirectory() || source.endsWith(".png"),
  });
}

async function main() {
  const file = option("--file", null);
  const outputRoot = path.resolve(
    option("--output-root", path.join(root, ".build", "behavior-scaffolds")),
  );
  const sourceCache = path.resolve(
    option("--source-cache-dir", path.join(root, ".build", "ui-geometry", "sources")),
  );
  const sourceTool = option("--source-tool", null);
  const resolvedSourceTool = sourceTool ? path.resolve(sourceTool) : null;
  const publish = process.argv.includes("--publish");
  const optionValues = new Set(
    ["--file", "--output-root", "--source-cache-dir", "--source-tool"]
      .map((name) => option(name, null))
      .filter(Boolean),
  );
  const positional = process.argv
    .slice(2)
    .filter((value) => !value.startsWith("--") && !optionValues.has(value));
  const urls = [
    ...(file
      ? fs
          .readFileSync(path.resolve(file), "utf8")
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line && !line.startsWith("#"))
      : []),
    ...positional.filter((value) => value.startsWith("https://")),
  ];
  if (!urls.length) throw new Error("Provide module URLs or --file <newline-delimited URLs>");
  const successes = [];
  const failures = [];
  for (const [index, url] of urls.entries()) {
    const module = target(url);
    const output = path.join(outputRoot, module.plugin, module.model);
    process.stderr.write(`[${index + 1}/${urls.length}] ${module.key}\n`);
    try {
      await compile(url, output, sourceCache, resolvedSourceTool);
      stageRuntimeResources(module, output);
      successes.push({ ...module, output });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`  failed: ${message}\n`);
      failures.push({ ...module, message });
    }
  }
  if (publish && successes.length) {
    const { spawnSync } = await import("node:child_process");
    const script = path.join(root, "scripts", "publish-scaffold-results.mjs");
    const result = spawnSync(
      process.execPath,
      [script, "--publish", ...successes.map((item) => item.output)],
      { cwd: root, stdio: "inherit" },
    );
    if (result.error) throw result.error;
    if (result.status !== 0)
      throw new Error(`Publishing compiled scaffolds exited with ${result.status}`);
  }
  const report = {
    attempted: urls.length,
    compiled: successes.length,
    failed: failures.length,
    successes,
    failures,
  };
  fs.mkdirSync(outputRoot, { recursive: true });
  fs.writeFileSync(
    path.join(outputRoot, "batch-report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (failures.length) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
