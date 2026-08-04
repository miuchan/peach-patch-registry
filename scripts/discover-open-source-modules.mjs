#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Compatibility entrypoint for source-discovery callers. Rust owns the queue
// schema, immutable Library snapshot, filtering, and compiled/pending totals.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const result = spawnSync(
  "cargo",
  [
    "run",
    "--quiet",
    "--manifest-path",
    path.join(root, "Cargo.toml"),
    "--bin",
    "peach-registry",
    "--",
    "discover",
    "--root",
    root,
    "--format",
    "json",
    ...process.argv.slice(2),
  ],
  { stdio: "inherit" },
);

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
