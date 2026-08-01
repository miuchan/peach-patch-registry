#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(projectDir, "web-runtime", "modules.json");
const manifest = JSON.parse(fs.readFileSync(output, "utf8"));
fs.writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`${output}\n`);
