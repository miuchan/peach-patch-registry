#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Compatibility entrypoint for existing npm and release callers. Publication is
// now owned by the Rust maintenance binary.
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
    "publish",
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
