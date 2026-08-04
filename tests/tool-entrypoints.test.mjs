import assert from "node:assert/strict";
import crypto from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixture = path.join(root, "tests", "fixtures", "registry");

test("legacy Node entrypoints forward publication and verification to Rust", () => {
  const checkout = fs.mkdtempSync(path.join(os.tmpdir(), "peach-rust-entrypoints-"));
  try {
    fs.cpSync(fixture, checkout, { recursive: true });
    const index = JSON.parse(fs.readFileSync(path.join(checkout, "index.json"), "utf8"));
    const candidate = {
      ...index.packages[0],
      version: "1.2.0",
      localBuild: {
        sourceCommit: "2222222222222222222222222222222222222222",
        fingerprint: "node-shim-fixture-v1",
        builtAt: "2026-08-03T02:03:04.000Z",
      },
    };
    const catalog = path.join(checkout, "catalog.json");
    fs.writeFileSync(catalog, `${JSON.stringify([candidate], null, 2)}\n`);
    const dynamicRoot = path.join(checkout, "dynamic");
    const dynamicArtifact = path.join(dynamicRoot, "Fixture", "Gain", "module.wasm");
    fs.mkdirSync(path.dirname(dynamicArtifact), { recursive: true });
    fs.writeFileSync(dynamicArtifact, "node-shim-wasm\n");

    const published = JSON.parse(execFileSync(process.execPath, [
      path.join(root, "scripts", "publish-registry.mjs"),
      "--root", checkout,
      "--catalog", catalog,
      "--dynamic-root", dynamicRoot,
      "--key", "Fixture/Gain",
    ], { cwd: root, encoding: "utf8" }));
    assert.equal(published.updated, 1);
    assert.equal(published.packages, 1);

    const artifact = path.join(checkout, "packages", "Fixture", "Gain", "1.2.0", "module.wasm");
    const manifest = JSON.parse(fs.readFileSync(path.join(path.dirname(artifact), "manifest.json"), "utf8"));
    assert.equal(manifest.module.artifact.sha256, crypto.createHash("sha256").update(fs.readFileSync(artifact)).digest("hex"));
    assert.equal(manifest.build.fingerprint, "node-shim-fixture-v1");

    const verified = execFileSync(process.execPath, [
      path.join(root, "scripts", "verify-registry.mjs"),
      "--root", checkout,
    ], { cwd: root, encoding: "utf8" });
    assert.match(verified, /verified 1 packages \(15 bytes\)/);
  } finally {
    fs.rmSync(checkout, { recursive: true, force: true });
  }
});

test("publication shim preserves a failing exit status", () => {
  const result = spawnSync(process.execPath, [
    path.join(root, "scripts", "publish-registry.mjs"),
    "--key", "Fixture/DefinitelyMissing",
  ], { cwd: root, encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unknown registry key: Fixture\/DefinitelyMissing/);
});

test("source discovery shim forwards the immutable Library queue contract", () => {
  const checkout = fs.mkdtempSync(path.join(os.tmpdir(), "peach-rust-discovery-entrypoint-"));
  try {
    fs.cpSync(fixture, checkout, { recursive: true });
    const library = path.join(checkout, "library-index");
    const manifests = path.join(library, "manifests");
    fs.mkdirSync(manifests, { recursive: true });
    fs.writeFileSync(path.join(manifests, "Fixture.json"), `${JSON.stringify({
      slug: "Fixture",
      version: "1.0.0",
      license: "MIT",
      sourceUrl: "https://github.com/example/fixture",
      modules: [{ slug: "Gain" }, { slug: "Pending" }],
    }, null, 2)}\n`);
    execFileSync("git", ["init", "-q"], { cwd: library });
    execFileSync("git", ["add", "."], { cwd: library });
    execFileSync("git", [
      "-c", "user.name=Peach Tests",
      "-c", "user.email=tests@example.invalid",
      "commit", "-qm", "fixture",
    ], { cwd: library });
    const queuePath = path.join(checkout, "queue.json");
    const report = JSON.parse(execFileSync(process.execPath, [
      path.join(root, "scripts", "discover-open-source-modules.mjs"),
      "--root", checkout,
      "--library-index", library,
      "--output", queuePath,
    ], { cwd: root, encoding: "utf8" }));
    assert.deepEqual(
      { packages: report.packages, modules: report.modules, compiled: report.compiled, pending: report.pending },
      { packages: 1, modules: 2, compiled: 1, pending: 1 },
    );
    const queue = JSON.parse(fs.readFileSync(queuePath, "utf8"));
    assert.deepEqual(queue.moduleRecords.map((item) => [item.key, item.compiled]), [
      ["Fixture/Gain", true],
      ["Fixture/Pending", false],
    ]);
  } finally {
    fs.rmSync(checkout, { recursive: true, force: true });
  }
});

test("batch build shim forwards scheduling while keeping the Node adapter boundary", () => {
  const checkout = fs.mkdtempSync(path.join(os.tmpdir(), "peach-rust-build-entrypoint-"));
  try {
    fs.cpSync(fixture, checkout, { recursive: true });
    const work = path.join(checkout, "work");
    fs.mkdirSync(work, { recursive: true });
    const queue = path.join(work, "queue.json");
    fs.writeFileSync(queue, `${JSON.stringify({
      schemaVersion: 1,
      moduleRecords: [{
        key: "Fixture/Shim",
        plugin: "Fixture",
        model: "Shim",
        version: "1.0.0",
        sourceUrl: "https://github.com/example/fixture",
        libraryUrl: "https://library.vcvrack.com/Fixture/Shim",
      }],
    }, null, 2)}\n`);
    const state = path.join(work, "state.json");
    const catalog = path.join(work, "catalog.json");
    const dynamicRoot = path.join(work, "dynamic");
    const report = JSON.parse(execFileSync(process.execPath, [
      path.join(root, "scripts", "build-open-source-modules.mjs"),
      "--root", checkout,
      "--queue", queue,
      "--state", state,
      "--catalog", catalog,
      "--output-root", path.join(work, "builds"),
      "--source-cache", path.join(work, "sources"),
      "--dynamic-root", dynamicRoot,
      "--adapter-script", path.join(root, "tests", "fixtures", "fake-scaffold.mjs"),
      "--concurrency", "1",
    ], { cwd: root, encoding: "utf8" }));
    assert.deepEqual(
      { attempted: report.attempted, succeeded: report.succeeded, failed: report.failed },
      { attempted: 1, succeeded: 1, failed: 0 },
    );
    assert.equal(JSON.parse(fs.readFileSync(state, "utf8")).modules["Fixture/Shim"].status, "compiled");
    assert.equal(fs.readFileSync(path.join(dynamicRoot, "Fixture", "Shim", "module.wasm"), "utf8"), "Fixture/Shim fixture wasm\n");
  } finally {
    fs.rmSync(checkout, { recursive: true, force: true });
  }
});
