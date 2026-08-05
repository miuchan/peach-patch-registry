#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { webpDimensions } from "./refresh-panel-widths.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function visibleCollections(module) {
  return {
    params: module.params.filter((item) => !item.hidden && !item.contextOnly),
    inputs: module.inputs.filter((item) => !item.hidden),
    outputs: module.outputs.filter((item) => !item.hidden),
  };
}

function validPosition(position) {
  return Boolean(position && Number.isFinite(position.x) && Number.isFinite(position.y));
}

function positionBounds(position) {
  const width = Number.isFinite(position.width) ? position.width : 0;
  const height = Number.isFinite(position.height) ? position.height : 0;
  return position.centered
    ? {
        left: position.x - width / 2,
        right: position.x + width / 2,
        top: position.y - height / 2,
        bottom: position.y + height / 2,
      }
    : {
        left: position.x,
        right: position.x + width,
        top: position.y,
        bottom: position.y + height,
      };
}

function safeArtworkPath(value) {
  if (typeof value !== "string" || !value || /^[a-z][a-z0-9+.-]*:/i.test(value)) return null;
  const candidate = path.resolve(root, value);
  const prefix = `${root}${path.sep}`;
  return candidate.startsWith(prefix) ? candidate : null;
}

export function moduleUiIssues(module) {
  const issues = [];
  if (!Number.isFinite(module.width) || module.width <= 0)
    issues.push({ kind: "invalid-panel-width", width: module.width });
  if (typeof module.screenshotUrl !== "string" || !module.screenshotUrl)
    issues.push({ kind: "missing-panel-artwork" });
  else {
    const localArtwork = safeArtworkPath(module.screenshotUrl);
    if (localArtwork) {
      if (!fs.existsSync(localArtwork)) issues.push({ kind: "missing-local-panel-artwork", path: module.screenshotUrl });
      else {
        try {
          const dimensions = webpDimensions(fs.readFileSync(localArtwork));
          if (!dimensions || dimensions.width !== module.width || dimensions.height !== 380)
            issues.push({
              kind: "panel-artwork-dimensions",
              path: module.screenshotUrl,
              actual: dimensions,
              expected: { width: module.width, height: 380 },
            });
        } catch (error) {
          issues.push({
            kind: "invalid-local-panel-artwork",
            path: module.screenshotUrl,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    } else if (!/^https:\/\//.test(module.screenshotUrl))
      issues.push({ kind: "invalid-panel-artwork-url", value: module.screenshotUrl });
  }

  const collections = visibleCollections(module);
  for (const [group, items] of Object.entries(collections)) {
    for (const item of items) {
      if (!validPosition(item.position)) {
        issues.push({ kind: "missing-widget-position", group, id: item.id, name: item.name });
        continue;
      }
      const bounds = positionBounds(item.position);
      if (
        bounds.right < 0 ||
        bounds.left > module.width ||
        bounds.bottom < 0 ||
        bounds.top > 380
      )
        issues.push({
          kind: "widget-outside-panel",
          group,
          id: item.id,
          name: item.name,
          position: item.position,
        });
    }
  }
  return issues;
}

export function auditModuleUi(index) {
  const modules = index.packages.map((module) => ({
    key: module.key,
    issues: moduleUiIssues(module),
  }));
  const affected = modules.filter((module) => module.issues.length);
  const counts = {};
  for (const module of affected)
    for (const issue of module.issues) counts[issue.kind] = (counts[issue.kind] ?? 0) + 1;
  return {
    packageCount: index.packages.length,
    complete: index.packages.length - affected.length,
    affected: affected.length,
    counts,
    modules: affected,
  };
}

function main() {
  const index = JSON.parse(fs.readFileSync(path.join(root, "index.json"), "utf8"));
  const report = auditModuleUi(index);
  const reportPath = process.argv.includes("--report")
    ? path.resolve(process.argv[process.argv.indexOf("--report") + 1])
    : null;
  if (reportPath) {
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  }
  const summary = {
    packageCount: report.packageCount,
    complete: report.complete,
    affected: report.affected,
    counts: report.counts,
    ...(reportPath ? { report: reportPath } : {}),
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (report.affected) process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
