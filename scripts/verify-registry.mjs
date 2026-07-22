#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
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
console.log(`verified ${keys.size} packages (${index.totalBytes} bytes)`);
