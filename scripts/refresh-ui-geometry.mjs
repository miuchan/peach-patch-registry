#!/usr/bin/env node
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

const execute = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const buildRoot = path.join(root, ".build", "ui-geometry");
const sourceCache = path.join(buildRoot, "sources");
const resultRoot = path.join(buildRoot, "results");
const statePath = path.join(buildRoot, "state.json");
const scaffold = path.join(root, "scripts", "scaffold-library-module.mjs");

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function safeSegment(value, label) {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._+-]*$/.test(value))
    throw new Error(`Unsafe ${label}: ${value}`);
  return value;
}

function visibleWidgets(module) {
  return [
    ...module.params.filter((item) => !item.hidden && !item.contextOnly),
    ...module.inputs.filter((item) => !item.hidden),
    ...module.outputs.filter((item) => !item.hidden),
  ];
}

function validPosition(position) {
  return Boolean(
    position && Number.isFinite(position.x) && Number.isFinite(position.y),
  );
}

export function uiGeometryIssueCount(module) {
  const widgets = visibleWidgets(module).filter((item) =>
    validPosition(item.position),
  );
  let issues = widgets.filter(
    ({ position }) =>
      position.x < 0 ||
      position.x > module.width ||
      position.y < 0 ||
      position.y > 380,
  ).length;
  for (let index = 0; index < widgets.length; index += 1) {
    const current = widgets[index].position;
    for (
      let candidate = index + 1;
      candidate < widgets.length;
      candidate += 1
    ) {
      const other = widgets[candidate].position;
      if (Math.hypot(current.x - other.x, current.y - other.y) < 3) issues += 1;
    }
  }
  return issues;
}

export function hasCompleteUiGeometry(module) {
  return (
    visibleWidgets(module).every((item) => validPosition(item.position)) &&
    uiGeometryIssueCount(module) === 0
  );
}

function mergeItems(current, refreshed) {
  const byId = new Map(refreshed.map((item) => [item.id, item]));
  return current.map((item) => {
    const next = byId.get(item.id);
    return validPosition(next?.position)
      ? { ...item, position: next.position }
      : item;
  });
}

export function mergeUiGeometry(current, refreshed) {
  const width = current.width;
  const candidate = {
    ...current,
    width,
    params: mergeItems(current.params, refreshed.params ?? []),
    inputs: mergeItems(current.inputs, refreshed.inputs ?? []),
    outputs: mergeItems(current.outputs, refreshed.outputs ?? []),
    ...(Array.isArray(refreshed.lightWidgets) && refreshed.lightWidgets.length
      ? { lightWidgets: refreshed.lightWidgets }
      : {}),
  };
  if (uiGeometryIssueCount(candidate) <= uiGeometryIssueCount(current))
    return candidate;

  let conservative = {
    ...current,
    width,
    ...(Array.isArray(refreshed.lightWidgets) && refreshed.lightWidgets.length
      ? { lightWidgets: refreshed.lightWidgets }
      : {}),
  };
  for (const collection of ["params", "inputs", "outputs"]) {
    for (const item of refreshed[collection] ?? []) {
      if (!validPosition(item.position)) continue;
      const existing = conservative[collection].find(
        (candidateItem) => candidateItem.id === item.id,
      );
      if (!existing) continue;
      const before = uiGeometryIssueCount(conservative);
      const trial = {
        ...conservative,
        [collection]: conservative[collection].map((candidateItem) =>
          candidateItem.id === item.id
            ? { ...candidateItem, position: item.position }
            : candidateItem,
        ),
      };
      const after = uiGeometryIssueCount(trial);
      if (
        (!validPosition(existing.position) && after <= before) ||
        after < before
      )
        conservative = trial;
    }
  }
  return conservative;
}

function geometryScore(module) {
  const widgets = visibleWidgets(module);
  return {
    widgets: widgets.length,
    positioned: widgets.filter((item) => validPosition(item.position)).length,
  };
}

function atomicJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.building-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temporary, file);
}

function writeGeometryChanges(index, byKey, changedKeys) {
  const packages = index.packages.map(
    (module) => byKey.get(module.key) ?? module,
  );
  atomicJson(path.join(root, "index.json"), {
    ...index,
    generatedAt: new Date().toISOString(),
    packages,
  });
  for (const changedKey of changedKeys) {
    const module = byKey.get(changedKey);
    const manifestPath = path.join(root, module.manifestUrl);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    atomicJson(manifestPath, { ...manifest, module });
  }
}

async function runPool(items, concurrency, task) {
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (cursor < items.length) {
        const item = items[cursor++];
        await task(item);
      }
    }),
  );
}

async function refreshOne(module, reuse, timeoutMs) {
  const plugin = safeSegment(module.plugin, "plugin slug");
  const model = safeSegment(module.model, "model slug");
  const output = path.join(resultRoot, plugin, model);
  const runtimeFile = path.join(output, "runtime.json");
  if (!reuse || !fs.existsSync(runtimeFile)) {
    fs.mkdirSync(output, { recursive: true });
    await execute(
      process.execPath,
      [
        scaffold,
        module.libraryUrl,
        "--source-cache-dir",
        sourceCache,
        "--output",
        output,
      ],
      {
        cwd: root,
        timeout: timeoutMs,
        maxBuffer: 16 * 1024 * 1024,
      },
    );
  }
  return JSON.parse(fs.readFileSync(runtimeFile, "utf8"));
}

async function main() {
  const indexPath = path.join(root, "index.json");
  const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  const key = option("--key", null);
  const plugin = option("--plugin", null);
  const limit = Math.max(1, Number(option("--limit", Number.MAX_SAFE_INTEGER)));
  const groupConcurrency = Math.max(
    1,
    Math.min(8, Number(option("--concurrency", 4))),
  );
  const moduleConcurrency = Math.max(
    1,
    Math.min(4, Number(option("--module-concurrency", 2))),
  );
  const timeoutMs = Math.max(10_000, Number(option("--timeout-ms", 60_000)));
  const write = process.argv.includes("--write");
  const force = process.argv.includes("--force");
  const reuse = !process.argv.includes("--no-reuse");
  const reapplyRef = option("--reapply-cache-from-ref", null);
  if (reapplyRef) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(reapplyRef))
      throw new Error(`Unsafe git ref: ${reapplyRef}`);
    const { stdout } = await execute(
      "git",
      ["show", `${reapplyRef}:index.json`],
      {
        cwd: root,
        maxBuffer: 80 * 1024 * 1024,
      },
    );
    const baseline = JSON.parse(stdout);
    const byKey = new Map(
      baseline.packages.map((module) => [module.key, module]),
    );
    const changedKeys = [];
    for (const module of baseline.packages) {
      const runtimeFile = path.join(
        resultRoot,
        safeSegment(module.plugin, "plugin slug"),
        safeSegment(module.model, "model slug"),
        "runtime.json",
      );
      if (!fs.existsSync(runtimeFile)) continue;
      const merged = mergeUiGeometry(
        module,
        JSON.parse(fs.readFileSync(runtimeFile, "utf8")),
      );
      if (JSON.stringify(merged) === JSON.stringify(module)) continue;
      byKey.set(module.key, merged);
      changedKeys.push(module.key);
    }
    if (write && changedKeys.length)
      writeGeometryChanges(baseline, byKey, changedKeys);
    const finalModules = baseline.packages.map(
      (module) => byKey.get(module.key) ?? module,
    );
    process.stdout.write(
      `${JSON.stringify(
        {
          baseline: reapplyRef,
          cached: changedKeys.length,
          completeBefore: baseline.packages.filter(hasCompleteUiGeometry)
            .length,
          completeAfter: finalModules.filter(hasCompleteUiGeometry).length,
          write,
        },
        null,
        2,
      )}\n`,
    );
    return;
  }
  const candidates = index.packages
    .filter(
      (module) =>
        (!key || module.key === key) && (!plugin || module.plugin === plugin),
    )
    .filter((module) => force || !hasCompleteUiGeometry(module))
    .slice(0, limit);
  if (key && candidates.length !== 1)
    throw new Error(
      `No refresh candidate found for ${key}; use --force to refresh complete geometry`,
    );

  const byKey = new Map(index.packages.map((module) => [module.key, module]));
  const state = fs.existsSync(statePath)
    ? JSON.parse(fs.readFileSync(statePath, "utf8"))
    : { schemaVersion: 1, modules: {} };
  const groups = [
    ...Map.groupBy(candidates, (module) => module.plugin).values(),
  ];
  let attempted = 0;
  let improved = 0;
  let completed = 0;
  let failed = 0;
  const changedKeys = [];

  const processModule = async (module) => {
    attempted += 1;
    process.stderr.write(`[${attempted}/${candidates.length}] ${module.key}\n`);
    const before = geometryScore(module);
    try {
      const refreshed = await refreshOne(module, reuse, timeoutMs);
      const merged = mergeUiGeometry(module, refreshed);
      const after = geometryScore(merged);
      if (after.positioned > before.positioned) improved += 1;
      if (JSON.stringify(merged) !== JSON.stringify(module)) {
        byKey.set(module.key, merged);
        changedKeys.push(module.key);
      }
      state.modules[module.key] = { status: "complete", before, after };
      completed += 1;
    } catch (error) {
      state.modules[module.key] = {
        status: "failed",
        error: [
          error instanceof Error ? error.message : String(error),
          typeof error?.stderr === "string" ? error.stderr : "",
        ]
          .filter(Boolean)
          .join("\n")
          .slice(-12000),
      };
      failed += 1;
    }
    atomicJson(statePath, state);
  };

  await runPool(groups, groupConcurrency, async (group) => {
    const [first, ...rest] = group;
    if (first) await processModule(first);
    await runPool(rest, moduleConcurrency, processModule);
  });

  if (write && changedKeys.length) {
    writeGeometryChanges(index, byKey, changedKeys);
  }

  const finalModules = index.packages.map(
    (module) => byKey.get(module.key) ?? module,
  );
  const summary = {
    candidates: candidates.length,
    attempted,
    completed,
    failed,
    improved,
    changed: changedKeys.length,
    completeBefore: index.packages.filter(hasCompleteUiGeometry).length,
    completeAfter: finalModules.filter(hasCompleteUiGeometry).length,
    write,
    statePath,
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (failed) process.exitCode = 2;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
    );
    process.exitCode = 1;
  });
