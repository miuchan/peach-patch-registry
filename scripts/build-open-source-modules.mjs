#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Compatibility entrypoint for batch source builds. Rust owns queue filtering,
// process timeouts, plugin-group concurrency, state, cleanup, and artifact/asset
// staging; the existing Node source adapter remains the compiler subprocess.
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
    "build",
    "--root",
    root,
    "--node",
    process.execPath,
    "--format",
    "json",
    ...process.argv.slice(2),
  ],
  { stdio: "inherit" },
);

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
