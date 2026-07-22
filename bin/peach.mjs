#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const DEFAULT_REGISTRY = "https://raw.githubusercontent.com/miuchan/peach-patch-registry/main/index.json";
const args = process.argv.slice(2);
const take = (name, fallback) => {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = args[index + 1];
  args.splice(index, 2);
  return value;
};
const registry = take("--registry", process.env.PEACH_PATCH_REGISTRY || DEFAULT_REGISTRY);
const prefix = path.resolve(take("--prefix", path.join(os.homedir(), ".peach-patch")));
const [command = "help", query = ""] = args;

async function json(source) {
  if (/^https?:\/\//.test(source)) {
    const response = await fetch(source, { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error(`${source} returned ${response.status}`);
    return { data: await response.json(), base: response.url };
  }
  const file = path.resolve(source);
  return { data: JSON.parse(await fs.readFile(file, "utf8")), base: new URL(`file://${file}`).href };
}

function artifactUrl(base, relative) {
  return new URL(relative, base).href;
}

async function bytes(url) {
  if (url.startsWith("file:")) return fs.readFile(new URL(url));
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

function verify(module, content) {
  const actual = crypto.createHash("sha256").update(content).digest("hex");
  if (content.byteLength !== module.artifact.size || actual !== module.artifact.sha256)
    throw new Error(`Integrity check failed for ${module.key}`);
}

const { data: index, base } = await json(registry);
if (index.schemaVersion !== 1 || !Array.isArray(index.packages)) throw new Error("Unsupported registry schema");
const find = (key) => {
  const item = index.packages.find((candidate) => candidate.key.toLowerCase() === key.toLowerCase());
  if (!item) throw new Error(`Package not found: ${key}`);
  return item;
};

if (command === "list" || command === "search") {
  const needle = command === "search" ? query.toLowerCase() : "";
  for (const item of index.packages.filter((candidate) =>
    `${candidate.key} ${candidate.name} ${candidate.brand} ${candidate.description}`.toLowerCase().includes(needle),
  )) console.log(`${item.key.padEnd(42)} ${item.version.padEnd(12)} ${item.name}`);
} else if (command === "info") {
  console.log(JSON.stringify(find(query), null, 2));
} else if (command === "install") {
  const item = find(query);
  const content = await bytes(artifactUrl(base, item.wasmUrl));
  verify(item, content);
  const target = path.join(prefix, "packages", item.plugin, item.model, item.version);
  await fs.mkdir(target, { recursive: true });
  const temporary = path.join(target, `module.wasm.${process.pid}.tmp`);
  await fs.writeFile(temporary, content);
  await fs.rename(temporary, path.join(target, "module.wasm"));
  await fs.writeFile(path.join(target, "manifest.json"), `${JSON.stringify(item, null, 2)}\n`);
  console.log(`${item.key}@${item.version} installed in ${target}`);
} else if (command === "verify") {
  const item = find(query);
  const target = path.join(prefix, "packages", item.plugin, item.model, item.version, "module.wasm");
  verify(item, await fs.readFile(target));
  console.log(`${item.key}@${item.version} verified`);
} else {
  console.log("peach <search QUERY|list|info KEY|install KEY|verify KEY> [--registry URL|FILE] [--prefix DIR]");
}
