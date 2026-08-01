#!/usr/bin/env node
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execute = promisify(execFile);
const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const buildRoot = path.join(projectDir, ".build");
const queuePath = path.join(buildRoot, "open-source-modules.json");
const statePath = path.join(buildRoot, "open-source-build-state.json");
const catalogPath = path.join(buildRoot, "catalog.json");
const outputRoot = path.join(buildRoot, "open-source-builds");
const sourceCacheDir = path.join(buildRoot, "sources");
const sourceLicenseExclusions = new Map([
  ["STS", "The source owner stated that the repository was unintentionally public and that its code and ports must not be redistributed: https://community.vcvrack.com/t/sts-odyssey/18614/7"],
]);
const value = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const limit = value("--limit") ? Number(value("--limit")) : Number.POSITIVE_INFINITY;
const pluginFilter = value("--plugin");
const modelFilter = value("--model");
const sourceDirOverride = value("--source-dir") ? path.resolve(value("--source-dir")) : undefined;
const retry = process.argv.includes("--retry");
const force = process.argv.includes("--force");
const keepSource = process.argv.includes("--keep-source");
const keepBuild = process.argv.includes("--keep-build");
const concurrency = Math.max(1, Math.min(8, Number(value("--concurrency") || Math.min(4, os.availableParallelism()))));
if (sourceDirOverride && (!pluginFilter || !modelFilter))
  throw new Error("--source-dir requires one explicit --plugin and --model target");

if (!fs.existsSync(queuePath)) throw new Error("Run npm run source:discover first");
if (!fs.existsSync(catalogPath)) {
  fs.mkdirSync(path.dirname(catalogPath), { recursive: true });
  fs.writeFileSync(catalogPath, `${JSON.stringify(JSON.parse(fs.readFileSync(path.join(projectDir, "index.json"), "utf8")).packages, null, 2)}\n`);
}
const queue = JSON.parse(fs.readFileSync(queuePath, "utf8"));
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const definitions = new Map(catalog.map((item) => [item.key, item]));
const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, "utf8")) : { schemaVersion: 1, modules: {} };

function persist() {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
  fs.writeFileSync(catalogPath, `${JSON.stringify([...definitions.values()].sort((a, b) => a.key.localeCompare(b.key)), null, 2)}\n`);
}

function sourceFailureAssessment(error, item) {
  const message = [
    error instanceof Error ? error.message : String(error),
    typeof error?.stderr === "string" ? error.stderr : "",
  ].filter(Boolean).join("\n");
  if (/repository (?:not found|does not exist)|could not read from remote repository/i.test(message)) {
    return {
      strategy: "source-unavailable",
      compileEligible: false,
      requiresReview: true,
      blockers: [{ kind: "source-unavailable", sourceUrl: item.sourceUrl }],
    };
  }
  return undefined;
}

for (const item of queue.moduleRecords) {
  const exclusion = sourceLicenseExclusions.get(item.plugin);
  if (!exclusion || definitions.has(item.key)) continue;
  state.modules[item.key] = {
    status: "failed",
    finishedAt: new Date().toISOString(),
    error: `Excluded from the open-source registry. ${exclusion}`,
    assessment: {
      strategy: "excluded-source-license",
      compileEligible: false,
      requiresReview: false,
      blockers: ["source-license"],
    },
  };
}
persist();

const candidates = queue.moduleRecords.filter((item) =>
  !sourceLicenseExclusions.has(item.plugin) &&
  (!pluginFilter || item.plugin === pluginFilter) &&
  (!modelFilter || item.model === modelFilter) &&
  (force || !definitions.has(item.key)) &&
  (retry || state.modules[item.key]?.status !== "failed"),
).slice(0, limit);
let succeeded = 0;
let failed = 0;
let started = 0;
let removedSourceRepositories = 0;

function removePluginSource(plugin) {
  if (keepSource) return;
  if (!/^[A-Za-z0-9][A-Za-z0-9._+-]*$/.test(plugin))
    throw new Error(`Unsafe plugin cache key ${plugin}`);
  const target = path.join(sourceCacheDir, plugin);
  if (fs.existsSync(target)) removedSourceRepositories += 1;
  fs.rmSync(target, { recursive: true, force: true });
}

const groups = new Map();
for (const item of candidates) {
  const group = groups.get(item.plugin) || [];
  group.push(item);
  groups.set(item.plugin, group);
}

async function processItem(item) {
  const buildDir = path.join(outputRoot, item.plugin, item.model);
  fs.mkdirSync(buildDir, { recursive: true });
  const previousState = state.modules[item.key];
  state.modules[item.key] = { status: "building", startedAt: new Date().toISOString() };
  persist();
  started += 1;
  process.stderr.write(`[${started}/${candidates.length}] ${item.key}\n`);
  try {
    const scaffoldArguments = [
      path.join(projectDir, "scripts", "scaffold-library-module.mjs"),
      item.libraryUrl,
      "--source-cache-dir", sourceCacheDir,
      "--output", buildDir,
      "--compile",
    ];
    if (sourceDirOverride) scaffoldArguments.push("--source-dir", sourceDirOverride);
    const { stdout } = await execute(process.execPath, scaffoldArguments, { cwd: projectDir, timeout: 15 * 60 * 1000, maxBuffer: 32 * 1024 * 1024 });
    const result = JSON.parse(stdout);
    const runtime = JSON.parse(fs.readFileSync(path.join(buildDir, "runtime.json"), "utf8"));
    const destination = path.join(projectDir, "public", "dynamic-plugins", item.plugin, item.model);
    fs.mkdirSync(destination, { recursive: true });
    fs.copyFileSync(result.artifact, path.join(destination, "module.wasm"));
    if (item.plugin === "MSM") {
      const componentSource = path.join(sourceCacheDir, item.plugin, result.source?.commit || "", "res"),
        componentDestination = path.join(projectDir, "public", "rack-components", "msm");
      for (const directory of ["Knobs", "Switch", "Button", "Slider", "Port"]) {
        const source = path.join(componentSource, directory);
        if (!fs.existsSync(source)) continue;
        fs.cpSync(source, path.join(componentDestination, directory), {
          recursive: true,
          filter: (entry) => fs.statSync(entry).isDirectory() || /\.svg$/i.test(entry),
        });
      }
    }
    if (item.plugin === "ImpromptuModular") {
      const componentSource = path.join(
          sourceCacheDir,
          item.plugin,
          result.source?.commit || "",
          "res",
          "comp",
          "complib",
        ),
        componentDestination = path.join(
          projectDir,
          "public",
          "rack-components",
          "impromptu",
        );
      for (const name of ["Trimpot.svg", "Trimpot_bg.svg", "Rogan1PWhite_fg.svg", "Rogan1S.svg", "Rogan1PSWhite_fg.svg"]) {
        const source = path.join(componentSource, name);
        if (!fs.existsSync(source)) continue;
        fs.mkdirSync(componentDestination, { recursive: true });
        fs.copyFileSync(source, path.join(componentDestination, name));
      }
      const segmentFont = path.join(
        sourceCacheDir,
        item.plugin,
        result.source?.commit || "",
        "res",
        "fonts",
        "Segment14.ttf",
      );
      if (fs.existsSync(segmentFont)) {
        fs.mkdirSync(componentDestination, { recursive: true });
        fs.copyFileSync(segmentFont, path.join(componentDestination, "Segment14.ttf"));
      }
    }
    if (item.key === "ModularMooch/Wolfram") {
      const fontSource = path.join(
          sourceCacheDir,
          item.plugin,
          result.source?.commit || "",
          "res",
          "fonts",
          "wolfram.ttf",
        ),
        componentSource = path.join(
          sourceCacheDir,
          item.plugin,
          result.source?.commit || "",
          "res",
          "components",
        ),
        componentDestination = path.join(
          projectDir,
          "public",
          "rack-components",
          "modular-mooch",
        );
      fs.mkdirSync(componentDestination, { recursive: true });
      if (fs.existsSync(fontSource))
        fs.copyFileSync(fontSource, path.join(componentDestination, "wolfram.ttf"));
      for (const name of [
        "M1900hBlackEncoder.svg",
        "M1900hBlackKnob.svg",
        "M1900hKnob_fg.svg",
        "RectangleLuckyLight.svg",
      ]) {
        const source = path.join(componentSource, name);
        if (fs.existsSync(source))
          fs.copyFileSync(source, path.join(componentDestination, name));
      }
    }
    if (item.plugin === "Leviathan") {
      const componentSource = path.join(
          sourceCacheDir,
          item.plugin,
          result.source?.commit || "",
          "res",
          "icon",
        ),
        componentDestination = path.join(
          projectDir,
          "public",
          "rack-components",
          "leviathan",
        );
      for (const name of ["HaloKnob2Back.svg", "HaloKnobCenter.svg", "HaloKnobCenterLit.svg", "Eclipse2Knob.svg", "gear_knob_tiny.svg", "gold_button.svg", "PlasmaSwitchSmall.png"]) {
        const source = path.join(componentSource, name);
        if (!fs.existsSync(source)) continue;
        fs.mkdirSync(componentDestination, { recursive: true });
        fs.copyFileSync(source, path.join(componentDestination, name));
      }
    }
    if (item.plugin === "LifeFormModular") {
      const componentSource = path.join(
          sourceCacheDir,
          item.plugin,
          result.source?.commit || "",
          "res",
        ),
        componentDestination = path.join(
          projectDir,
          "public",
          "rack-components",
          "lifeform",
        );
      for (const name of [
        "LFMKnob.svg",
        "LFMNuKnob.svg",
        "LFMTinyKnob.svg",
        "LFMSlider.svg",
        "LFMSliderWhiteHandle.svg",
        "MS_0.svg",
        "MS_1.svg",
        "LFMSwitch_0.svg",
        "LFMSwitch_1.svg",
        "LFMSwitch_2.svg",
      ]) {
        const source = path.join(componentSource, name);
        if (!fs.existsSync(source)) continue;
        fs.mkdirSync(componentDestination, { recursive: true });
        fs.copyFileSync(source, path.join(componentDestination, name));
      }
    }
    if (item.plugin === "LomasModules") {
      const componentSource = path.join(
          sourceCacheDir,
          item.plugin,
          result.source?.commit || "",
          "res",
          "Components",
        ),
        componentDestination = path.join(
          projectDir,
          "public",
          "rack-components",
          "lomas",
        );
      for (const name of [
        "RubberButton.svg",
        "RubberButton1.svg",
        "RubberSmallButton.svg",
        "RubberSmallButton1.svg",
        "RoundGrayKnob.svg",
        "RoundSmallGrayKnob.svg",
        "RoundBigGrayKnob.svg",
      ]) {
        const source = path.join(componentSource, name);
        if (!fs.existsSync(source)) continue;
        fs.mkdirSync(componentDestination, { recursive: true });
        fs.copyFileSync(source, path.join(componentDestination, name));
      }
    }
    if (item.plugin === "LyraeModules") {
      const componentSource = path.join(
          sourceCacheDir,
          item.plugin,
          result.source?.commit || "",
          "res",
        ),
        componentDestination = path.join(
          projectDir,
          "public",
          "rack-components",
          "lyrae",
        );
      for (const name of [
        "HexKnob.svg",
        "MedHexKnob.svg",
        "SmallHexKnob.svg",
        "SmallHexKnobInverted.svg",
        "Jack.svg",
      ]) {
        const source = path.join(componentSource, name);
        if (!fs.existsSync(source)) continue;
        fs.mkdirSync(componentDestination, { recursive: true });
        fs.copyFileSync(source, path.join(componentDestination, name));
      }
    }
    if (item.key === "Interrobang/ScribbleStrip") {
      const source = path.join(
          sourceCacheDir,
          item.plugin,
          result.source?.commit || "",
          "res",
          "mad-midnight-marker-font",
          "MadMidnightMarker-na91.ttf",
        ),
        destination = path.join(
          projectDir,
          "public",
          "rack-components",
          "interrobang",
          "MadMidnightMarker-na91.ttf",
        );
      if (fs.existsSync(source)) {
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.copyFileSync(source, destination);
      }
    }
    runtime.wasmUrl = `/dynamic-plugins/${item.plugin}/${item.model}/module.wasm`;
    runtime.runtime = { ...(runtime.runtime || {}), strategy: result.assessment?.strategy || "direct-rack-source-adapter" };
    runtime.localBuild = {
      builtAt: new Date().toISOString(),
      sourceCommit: result.source?.commit || null,
      batch: true,
    };
    definitions.set(item.key, runtime);
    state.modules[item.key] = { status: "compiled", finishedAt: new Date().toISOString(), sourceCommit: result.source?.commit || null };
    succeeded += 1;
  } catch (error) {
    const assessmentFile = path.join(buildDir, "adapter.json");
    let assessment = sourceFailureAssessment(error, item) ?? previousState?.assessment;
    try { assessment = JSON.parse(fs.readFileSync(assessmentFile, "utf8")).assessment; } catch {}
    state.modules[item.key] = {
      status: "failed",
      finishedAt: new Date().toISOString(),
      error: [
        error instanceof Error ? error.message : String(error),
        typeof error?.stderr === "string" ? error.stderr : "",
      ].filter(Boolean).join("\n").slice(-16000),
      assessment,
    };
    failed += 1;
  }
  persist();
  if (!keepBuild) fs.rmSync(buildDir, { recursive: true, force: true });
}

for (const [plugin, items] of groups) {
  try {
    const [first, ...rest] = items;
    if (first) await processItem(first);
    const pluginCheckoutReady = fs.existsSync(path.join(sourceCacheDir, plugin));
    if (!pluginCheckoutReady || concurrency === 1) {
      for (const item of rest) await processItem(item);
      continue;
    }
    let cursor = 0;
    await Promise.all(Array.from(
      { length: Math.min(concurrency, rest.length) },
      async () => {
        while (cursor < rest.length) {
          const item = rest[cursor];
          cursor += 1;
          await processItem(item);
        }
      },
    ));
  } finally {
    removePluginSource(plugin);
  }
}

console.log(JSON.stringify({ attempted: candidates.length, succeeded, failed, concurrency, catalogModules: definitions.size, removedSourceRepositories, statePath }, null, 2));
if (failed) process.exitCode = 2;
