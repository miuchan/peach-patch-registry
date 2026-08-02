import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("Branches publishes its 90px panel with exact control dimensions", () => {
  const index = JSON.parse(fs.readFileSync(path.join(root, "index.json"), "utf8"));
  const manifest = JSON.parse(fs.readFileSync(
    path.join(root, "packages/AudibleInstruments/Branches/2.0.0/manifest.json"),
    "utf8",
  )).module;
  const module = index.packages.find((item) => item.key === "AudibleInstruments/Branches");
  assert.ok(module);
  assert.equal(module.width, 90);
  assert.equal(manifest.width, 90);

  const controls = module.params.map(({ id, position }) => ({ id, position }));
  assert.deepEqual(controls, manifest.params.map(({ id, position }) => ({ id, position })));
  assert.deepEqual(controls.map(({ position }) => [position.width, position.height]), [
    [39.6836, 39.6836],
    [39.6836, 39.6836],
    [15.36, 15.3577],
    [15.36, 15.3577],
  ]);

  const rightEdge = Math.max(...controls.map(({ position }) =>
    position.x + (position.centered ? position.width / 2 : position.width)));
  assert.equal(Math.ceil(rightEdge / 15) * 15, 90);
});
