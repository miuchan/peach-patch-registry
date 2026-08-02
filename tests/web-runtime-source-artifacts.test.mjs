import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtimeManifest = JSON.parse(
  fs.readFileSync(path.join(projectDir, "web-runtime", "modules.json"), "utf8"),
);
const keys = [
  "AudibleInstruments/Braids",
  "AudibleInstruments/Elements",
  "AudibleInstruments/Rings",
];

test("Mutable Instruments browser artifacts come only from direct Rack source builds", () => {
  for (const key of keys) {
    const runtime = runtimeManifest.modules.find((item) => item.key === key);
    assert.ok(runtime, `${key} is missing from the web runtime manifest`);
    assert.equal(runtime.strategy, "direct-rack-source-adapter");
    assert.equal(
      fs.existsSync(path.join(projectDir, "web-runtime", "plugins", `${runtime.entry}.cpp`)),
      false,
      `${key} still has a simplified C++ fallback`,
    );

    const packageManifest = JSON.parse(
      fs.readFileSync(path.join(projectDir, path.dirname(runtime.packageArtifact), "manifest.json"), "utf8"),
    );
    assert.equal(packageManifest.module.key, key);
    assert.equal(packageManifest.module.wasmUrl, runtime.packageArtifact);
    assert.equal(packageManifest.build.strategy, "direct-rack-source-adapter");
    assert.match(packageManifest.source.url, /^https:\/\/github\.com\/VCVRack\/AudibleInstruments/);
    assert.match(packageManifest.source.commit, /^[0-9a-f]{40}$/);

    const artifact = fs.readFileSync(path.join(projectDir, runtime.packageArtifact));
    assert.equal(artifact.byteLength, packageManifest.module.artifact.size);
    assert.equal(
      crypto.createHash("sha256").update(artifact).digest("hex"),
      packageManifest.module.artifact.sha256,
    );
  }
});

test("web runtime manifest reader resolves source-built artifacts", () => {
  const output = execFileSync(
    process.execPath,
    [path.join(projectDir, "scripts", "read-web-runtime-manifest.mjs"), ...keys],
    { cwd: projectDir, encoding: "utf8" },
  );
  const rows = output.trim().split("\n").map((line) => line.split("\t"));
  assert.equal(rows.length, keys.length);
  for (const row of rows) {
    assert.equal(row.length, 6);
    assert.equal(row[4], "direct-rack-source-adapter");
    assert.match(row[5], /^packages\/AudibleInstruments\/(Braids|Elements|Rings)\/2\.0\.0\/module\.wasm$/);
  }
});
