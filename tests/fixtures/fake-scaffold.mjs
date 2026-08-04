#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const value = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const libraryUrl = new URL(process.argv[2]);
const [plugin, model] = libraryUrl.pathname.split("/").filter(Boolean);
const output = path.resolve(value("--output"));
const sourceCache = path.resolve(value("--source-cache-dir"));
const commit = plugin === "MSM" ? "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" : "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const source = path.join(sourceCache, plugin, commit);
fs.mkdirSync(source, { recursive: true });
fs.mkdirSync(output, { recursive: true });

if (model === "Slow") {
  await new Promise((resolve) => setTimeout(resolve, 2_000));
}

if (model === "SlowChild") {
  const marker = path.join(path.dirname(sourceCache), "orphan-marker");
  spawn(process.execPath, [
    "-e",
    `setTimeout(() => require("node:fs").writeFileSync(${JSON.stringify(marker)}, "orphaned\\n"), 600)`,
  ], { stdio: "ignore" });
  await new Promise((resolve) => setTimeout(resolve, 2_000));
}

if (model.startsWith("Parallel")) {
  const lock = path.join(sourceCache, plugin, "parallel-lock");
  let owner = false;
  try {
    fs.mkdirSync(lock);
    owner = true;
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    fs.writeFileSync(path.join(sourceCache, plugin, "parallel-observed"), "yes\n");
  }
  await new Promise((resolve) => setTimeout(resolve, owner ? 400 : 50));
  if (owner) fs.rmSync(lock, { recursive: true, force: true });
}

if (model === "Fail") {
  fs.writeFileSync(path.join(output, "adapter.json"), `${JSON.stringify({
    assessment: {
      strategy: "manual-browser-adapter",
      compileEligible: false,
      requiresReview: true,
      blockers: ["fixture-failure"],
    },
  }, null, 2)}\n`);
  process.stderr.write("fixture compiler rejected the module\n");
  process.exit(7);
}

if (plugin === "MSM") {
  const knobs = path.join(source, "res", "Knobs");
  fs.mkdirSync(knobs, { recursive: true });
  fs.writeFileSync(path.join(knobs, "FixtureKnob.svg"), "<svg/>\n");
  fs.writeFileSync(path.join(knobs, "Ignored.png"), "not-an-svg\n");
}

const artifact = path.join(output, "module.wasm");
fs.writeFileSync(artifact, `${plugin}/${model} fixture wasm\n`);
fs.writeFileSync(path.join(output, "runtime.json"), `${JSON.stringify({
  key: `${plugin}/${model}`,
  plugin,
  model,
  name: `${plugin} ${model}`,
  version: "1.0.0",
  description: "Scheduler fixture",
  runtime: { state: "fixture" },
}, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({
  key: `${plugin}/${model}`,
  artifact,
  source: { commit },
  assessment: { strategy: "fixture-source-adapter", compileEligible: true },
})}\n`);
