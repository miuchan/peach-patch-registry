#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function atomicJson(file, value) {
  const temporary = `${file}.building-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temporary, file);
}

async function runPool(items, concurrency, task) {
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) await task(items[cursor++], cursor);
  }));
}

export function clearMissingScreenshot(module, status) {
  return status === 404 && module.screenshotUrl
    ? { ...module, screenshotUrl: "" }
    : module;
}

async function main() {
  const indexPath = path.join(root, "index.json");
  const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  const concurrency = Math.max(1, Math.min(64, Number(option("--concurrency", 40))));
  const timeoutMs = Math.max(1_000, Number(option("--timeout-ms", 10_000)));
  const limit = Math.max(1, Number(option("--limit", Number.MAX_SAFE_INTEGER)));
  const write = process.argv.includes("--write");
  const candidates = index.packages.filter((module) => module.screenshotUrl).slice(0, limit);
  const byKey = new Map(index.packages.map((module) => [module.key, module]));
  const changedKeys = [];
  const statuses = {};
  let networkFailures = 0;

  await runPool(candidates, concurrency, async (module, completed) => {
    try {
      const response = await fetch(module.screenshotUrl, {
        method: "HEAD",
        redirect: "follow",
        signal: AbortSignal.timeout(timeoutMs),
      });
      statuses[response.status] = (statuses[response.status] ?? 0) + 1;
      const next = clearMissingScreenshot(module, response.status);
      if (next !== module) {
        byKey.set(module.key, next);
        changedKeys.push(module.key);
      }
    } catch {
      networkFailures += 1;
    }
    if (completed % 500 === 0) process.stderr.write(`[${completed}/${candidates.length}]\n`);
  });

  if (write && changedKeys.length) {
    const packages = index.packages.map((module) => byKey.get(module.key) ?? module);
    atomicJson(indexPath, { ...index, generatedAt: new Date().toISOString(), packages });
    for (const key of changedKeys) {
      const module = byKey.get(key);
      const manifestPath = path.join(root, module.manifestUrl);
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      atomicJson(manifestPath, { ...manifest, module });
    }
  }

  process.stdout.write(`${JSON.stringify({
    checked: candidates.length,
    statuses,
    networkFailures,
    missing: changedKeys.length,
    write,
  }, null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
