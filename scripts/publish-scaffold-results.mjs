#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogFile = path.join(root, ".build", "catalog.json");
const dynamicRoot = path.join(root, "public", "dynamic-plugins");

function fail(message) {
  throw new Error(message);
}

function atomicJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.building-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temporary, file);
}

function fingerprint() {
  const hash = createHash("sha256");
  hash.update(fs.readFileSync(path.join(root, "scripts", "scaffold-library-module.mjs")));
  const includeRoot = path.join(root, "web-runtime", "include");
  for (const entry of fs.readdirSync(includeRoot).sort()) {
    const file = path.join(includeRoot, entry);
    if (fs.statSync(file).isFile()) hash.update(fs.readFileSync(file));
  }
  return hash.digest("hex").slice(0, 16);
}

function scaffoldResult(directory, buildFingerprint) {
  const absolute = path.resolve(directory);
  const runtimeFile = path.join(absolute, "runtime.json");
  const adapterFile = path.join(absolute, "adapter.json");
  const wasmFile = path.join(absolute, "module.wasm");
  if (![runtimeFile, adapterFile, wasmFile].every(fs.existsSync))
    fail(`Incomplete compiled scaffold: ${absolute}`);
  const runtime = JSON.parse(fs.readFileSync(runtimeFile, "utf8"));
  const adapter = JSON.parse(fs.readFileSync(adapterFile, "utf8"));
  if (runtime.key !== adapter.key) fail(`Scaffold identity mismatch in ${absolute}`);
  const destination = path.join(dynamicRoot, runtime.plugin, runtime.model, "module.wasm");
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(wasmFile, destination);
  runtime.wasmUrl = `/dynamic-plugins/${runtime.plugin}/${runtime.model}/module.wasm`;
  runtime.runtime = {
    ...(runtime.runtime ?? {}),
    strategy: adapter.assessment?.strategy ?? "direct-rack-source-adapter",
  };
  const resources = path.join(absolute, "resources");
  if (fs.existsSync(resources)) {
    const dynamicResources = path.join(dynamicRoot, runtime.plugin, runtime.model, "resources");
    const packageResources = path.join(
      root,
      "packages",
      runtime.plugin,
      runtime.model,
      runtime.version,
      "resources",
    );
    for (const target of [dynamicResources, packageResources]) {
      fs.rmSync(target, { recursive: true, force: true });
      fs.cpSync(resources, target, { recursive: true });
    }
    for (const visual of runtime.runtime.visuals ?? [])
      if (visual.assetBase === "./resources/")
        visual.assetBase = `packages/${runtime.plugin}/${runtime.model}/${runtime.version}/resources/`;
  }
  runtime.localBuild = {
    fingerprint: buildFingerprint,
    builtAt: new Date().toISOString(),
    sourceCommit: adapter.source?.commit ?? null,
  };
  return runtime;
}

function main() {
  const publish = process.argv.includes("--publish");
  const directories = process.argv.slice(2).filter((value) => value !== "--publish");
  if (!directories.length) fail("Provide at least one compiled scaffold directory");
  const index = JSON.parse(fs.readFileSync(path.join(root, "index.json"), "utf8"));
  const existing = fs.existsSync(catalogFile)
    ? JSON.parse(fs.readFileSync(catalogFile, "utf8"))
    : index.packages;
  if (!Array.isArray(existing)) fail("Build catalog must be an array");
  const buildFingerprint = fingerprint();
  const refreshed = directories.map((directory) => scaffoldResult(directory, buildFingerprint));
  const byKey = new Map(existing.map((module) => [module.key, module]));
  for (const module of refreshed) byKey.set(module.key, module);
  const catalog = [...byKey.values()].sort((left, right) =>
    left.key.localeCompare(right.key, "en", { sensitivity: "base" }) || left.key.localeCompare(right.key),
  );
  atomicJson(catalogFile, catalog);
  if (publish) {
    const tool = path.join(root, "target", "debug", "peach-registry");
    if (!fs.existsSync(tool)) fail("Build target/debug/peach-registry before publishing");
    const publicationCatalog = path.join(root, ".build", "scaffold-publish-catalog.json");
    atomicJson(publicationCatalog, refreshed);
    execFileSync(
      tool,
      [
        "publish",
        "--root",
        root,
        "--catalog",
        publicationCatalog,
        "--dynamic-root",
        dynamicRoot,
        "--format",
        "json",
      ],
      { stdio: "inherit" },
    );
  }
  process.stdout.write(`${JSON.stringify({ staged: refreshed.map((module) => module.key), publish }, null, 2)}\n`);
}

main();
