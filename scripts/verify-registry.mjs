#!/usr/bin/env node
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const index = JSON.parse(fs.readFileSync(path.join(root, "index.json"), "utf8"));
const keys = new Set();
for (const item of index.packages) {
  if (keys.has(item.key)) throw new Error(`Duplicate key ${item.key}`);
  keys.add(item.key);
  const file = path.join(root, item.wasmUrl);
  const content = fs.readFileSync(file);
  const digest = crypto.createHash("sha256").update(content).digest("hex");
  if (content.byteLength !== item.artifact.size || digest !== item.artifact.sha256)
    throw new Error(`Integrity mismatch ${item.key}`);
  const manifest = JSON.parse(fs.readFileSync(path.join(path.dirname(file), "manifest.json"), "utf8"));
  if (manifest.module.key !== item.key || manifest.module.artifact.sha256 !== digest)
    throw new Error(`Manifest mismatch ${item.key}`);
}

const cliPackage = index.packages.find((item) => item.manifestUrl);
if (!cliPackage) throw new Error("Registry contains no installable package manifest");
const prefix = fs.mkdtempSync(path.join(os.tmpdir(), "peach-registry-verify-"));
try {
  const cli = path.join(root, "bin", "peach.mjs");
  execFileSync(process.execPath, [cli, "install", cliPackage.key, "--registry", path.join(root, "index.json"), "--prefix", prefix], { stdio: "pipe" });
  execFileSync(process.execPath, [cli, "verify", cliPackage.key, "--registry", path.join(root, "index.json"), "--prefix", prefix], { stdio: "pipe" });
  const installed = JSON.parse(fs.readFileSync(path.join(prefix, "packages", cliPackage.plugin, cliPackage.model, cliPackage.version, "manifest.json"), "utf8"));
  if (installed.module?.key !== cliPackage.key || installed.module?.artifact?.sha256 !== cliPackage.artifact.sha256)
    throw new Error(`CLI installed an incomplete manifest for ${cliPackage.key}`);
} finally {
  fs.rmSync(prefix, { recursive: true, force: true });
}

console.log(`verified ${keys.size} packages (${index.totalBytes} bytes) and local CLI install`);
