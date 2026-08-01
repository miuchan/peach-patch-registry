#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const indexDir = path.join(projectDir, ".cache", "vcv-library-sources", "library-index");
const outputIndex = process.argv.indexOf("--output");
const output = path.resolve(outputIndex >= 0 ? process.argv[outputIndex + 1] : path.join(projectDir, ".build", "open-source-modules.json"));
const catalog = JSON.parse(fs.readFileSync(path.join(projectDir, "index.json"), "utf8")).packages;
const compiled = new Set(catalog.map((item) => item.key));
const openLicense = /(?:^|\b)(?:AGPL|Apache|Artistic|BSD|CC0|GPL|ISC|LGPL|MIT|MPL|Unlicense|Zlib)(?:\b|-)/i;

const sourceRevision = execFileSync("git", ["-C", indexDir, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const snapshot = fs.mkdtempSync(path.join(os.tmpdir(), "peach-library-"));
const archive = path.join(snapshot, "manifests.tar");
execFileSync("git", ["-C", indexDir, "archive", "--format=tar", `--output=${archive}`, sourceRevision, "manifests"]);
execFileSync("tar", ["-xf", archive, "-C", snapshot]);
const manifestFiles = fs.readdirSync(path.join(snapshot, "manifests"))
  .filter((file) => file.endsWith(".json"))
  .map((file) => `manifests/${file}`);
const packages = [];
const modules = [];

for (const file of manifestFiles) {
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(path.join(snapshot, file), "utf8"));
  } catch {
    continue;
  }
  if (!manifest.sourceUrl || !openLicense.test(manifest.license || "") || !Array.isArray(manifest.modules)) continue;
  const plugin = manifest.slug || path.basename(file, ".json");
  const packageModules = manifest.modules.filter((item) => item?.slug).map((item) => {
    const key = `${plugin}/${item.slug}`;
    const entry = {
      key,
      plugin,
      model: item.slug,
      name: item.name || item.slug,
      description: item.description || "",
      tags: item.tags || [],
      version: manifest.version || "0.0.0",
      license: manifest.license,
      sourceUrl: manifest.sourceUrl,
      libraryUrl: `https://library.vcvrack.com/${plugin}/${item.slug}`,
      compiled: compiled.has(key),
    };
    modules.push(entry);
    return key;
  });
  packages.push({
    plugin,
    name: manifest.name || plugin,
    version: manifest.version || "0.0.0",
    license: manifest.license,
    sourceUrl: manifest.sourceUrl,
    modules: packageModules,
  });
}

const result = {
  schemaVersion: 1,
  discoveredAt: new Date().toISOString(),
  sourceRevision,
  packages: packages.length,
  modules: modules.length,
  compiled: modules.filter((item) => item.compiled).length,
  pending: modules.filter((item) => !item.compiled).length,
  packageRecords: packages,
  moduleRecords: modules,
};
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
fs.rmSync(snapshot, { recursive: true, force: true });
console.log(JSON.stringify({ output, packages: result.packages, modules: result.modules, compiled: result.compiled, pending: result.pending }, null, 2));
