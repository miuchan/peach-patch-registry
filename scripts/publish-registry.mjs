#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const value = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const catalogPath = path.resolve(value("--catalog", path.join(root, ".build", "catalog.json")));
const dynamicRoot = path.resolve(value("--dynamic-root", path.join(root, "public", "dynamic-plugins")));
const targetKey = value("--key", null);
const indexPath = path.join(root, "index.json");
const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
const catalog = fs.existsSync(catalogPath)
  ? JSON.parse(fs.readFileSync(catalogPath, "utf8"))
  : index.packages;
const byKey = new Map(index.packages.map((item) => [item.key, item]));

const safe = (value, label) => {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._+-]*$/.test(value))
    throw new Error(`Unsafe ${label}: ${value}`);
  return value;
};
const digest = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const writeJson = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
};

const candidates = catalog.filter((item) => !targetKey || item.key === targetKey);
if (targetKey && candidates.length !== 1) throw new Error(`Unknown registry key: ${targetKey}`);
let updated = 0;
for (const item of candidates) {
  const dynamic = path.join(dynamicRoot, item.plugin, item.model, "module.wasm");
  const existing = byKey.get(item.key);
  const sourceArtifact = fs.existsSync(dynamic)
    ? dynamic
    : existing?.wasmUrl
      ? path.join(root, existing.wasmUrl)
      : null;
  if (!sourceArtifact || !fs.existsSync(sourceArtifact)) continue;

  const plugin = safe(item.plugin, "plugin slug");
  const model = safe(item.model, "model slug");
  const version = safe(item.version || existing?.version || "0.0.0", "version");
  const relativeArtifact = `packages/${plugin}/${model}/${version}/module.wasm`;
  const relativeManifest = `packages/${plugin}/${model}/${version}/manifest.json`;
  const artifactPath = path.join(root, relativeArtifact);
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  if (sourceArtifact !== artifactPath) fs.copyFileSync(sourceArtifact, artifactPath);
  const module = {
    ...(existing || {}),
    ...item,
    key: item.key,
    plugin,
    model,
    version,
    wasmUrl: relativeArtifact,
    manifestUrl: relativeManifest,
    ...(item.localBuild?.sourceCommit ? { sourceCommit: item.localBuild.sourceCommit } : {}),
    artifact: { sha256: digest(artifactPath), size: fs.statSync(artifactPath).size },
  };
  delete module.localBuild;
  byKey.set(module.key, module);
  writeJson(path.join(root, relativeManifest), {
    schemaVersion: 1,
    abiVersion: "0.3",
    module,
    source: { url: module.sourceUrl, commit: item.localBuild?.sourceCommit ?? module.sourceCommit ?? null },
    build: {
      strategy: module.runtime?.strategy ?? "ordered-translation",
      fingerprint: item.localBuild?.fingerprint ?? null,
      builtAt: item.localBuild?.builtAt ?? null,
    },
  });
  updated += 1;
}

const packages = [...byKey.values()].sort((left, right) => left.key.localeCompare(right.key));
writeJson(indexPath, {
  ...index,
  generatedAt: new Date().toISOString(),
  packageCount: packages.length,
  totalBytes: packages.reduce((total, item) => total + item.artifact.size, 0),
  packages,
});
console.log(JSON.stringify({ updated, packages: packages.length, index: indexPath }, null, 2));
