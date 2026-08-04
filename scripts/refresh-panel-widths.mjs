#!/usr/bin/env node
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

const execute = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RACK_PANEL_HEIGHT = 380;
const RACK_HP_WIDTH = 15;
const sourceRoots = [
  path.join(root, ".build", "ui-geometry", "sources"),
  path.join(root, ".build", "panel-widths", "sources"),
];

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function atomicJson(file, value) {
  const temporary = `${file}.building-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temporary, file);
}

function safeSegment(value, label) {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._+-]*$/.test(value))
    throw new Error(`Unsafe ${label}: ${value}`);
  return value;
}

function normalizedAssetName(value) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function svgPanelWidthFromText(input) {
  const head = input.slice(0, 16_384);
  const tag = /<svg\b[^>]*>/i.exec(head)?.[0] ?? "";
  const dimension = (name) =>
    new RegExp(
      `\\b${name}\\s*=\\s*["']([0-9.]+)\\s*(mm|cm|in|px|pt|pc)?\\s*["']`,
      "i",
    ).exec(tag);
  const declaredWidth = dimension("width");
  const declaredHeight = dimension("height");
  const viewBox =
    /\bviewBox\s*=\s*["']\s*[-+0-9.eE]+[\s,]+[-+0-9.eE]+[\s,]+([-+0-9.eE]+)[\s,]+([-+0-9.eE]+)/i.exec(
      tag,
    );
  const unitScale = (unit) =>
    unit === "mm"
      ? 75 / 25.4
      : unit === "cm"
        ? 75 / 2.54
        : unit === "in"
          ? 75
          : unit === "pt"
            ? 75 / 72
            : unit === "pc"
              ? 75 / 6
              : 1;
  const widthUnit = declaredWidth?.[2]?.toLowerCase();
  const heightUnit = declaredHeight?.[2]?.toLowerCase();
  let width =
    widthUnit && widthUnit !== "px"
      ? Number(declaredWidth[1]) * unitScale(widthUnit)
      : null;
  if (!Number.isFinite(width) && declaredWidth && declaredHeight) {
    const declaredWidthPixels = Number(declaredWidth[1]) * unitScale(widthUnit);
    const declaredHeightPixels =
      Number(declaredHeight[1]) * unitScale(heightUnit);
    width = (declaredWidthPixels / declaredHeightPixels) * RACK_PANEL_HEIGHT;
  }
  if (!Number.isFinite(width) && viewBox) {
    width = (Number(viewBox[1]) / Number(viewBox[2])) * RACK_PANEL_HEIGHT;
  }
  if (!Number.isFinite(width) || width <= 0 || width > 400 * RACK_HP_WIDTH)
    return null;
  const rounded = Math.round(width * 1_000) / 1_000;
  const integer = Math.round(rounded);
  return Math.abs(rounded - integer) <= 0.01 ? integer : rounded;
}

function svgPanelWidth(file) {
  return svgPanelWidthFromText(fs.readFileSync(file, "utf8"));
}

function svgFiles(directory, output = []) {
  if (!fs.existsSync(directory)) return output;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (
      [".git", ".build", "build", "dep", "deps", "doc", "docs"].includes(
        entry.name,
      )
    )
      continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) svgFiles(target, output);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".svg"))
      output.push(target);
  }
  return output;
}

function cachedSourceCheckout(module) {
  const plugin = safeSegment(module.plugin, "plugin slug");
  const commit = safeSegment(module.sourceCommit, "source commit");
  return (
    sourceRoots
      .map((directory) => path.join(directory, plugin, commit))
      .find(
        (directory) =>
          fs.existsSync(directory) &&
          fs.readdirSync(directory).some((name) => name !== ".git"),
      ) ?? null
  );
}

async function sourceCheckout(module, cloneMissing) {
  const cached = cachedSourceCheckout(module);
  if (cached || !cloneMissing) return cached;
  const plugin = safeSegment(module.plugin, "plugin slug");
  const commit = safeSegment(module.sourceCommit, "source commit");
  const checkout = path.join(sourceRoots[1], plugin, commit);
  fs.mkdirSync(checkout, { recursive: true });
  if (!fs.existsSync(path.join(checkout, ".git"))) {
    await execute("git", ["init", "--quiet", checkout], { cwd: root });
    const sourceUrl = new URL(module.sourceUrl);
    if (!["http:", "https:"].includes(sourceUrl.protocol))
      throw new Error(`Unsupported source URL protocol for ${module.key}`);
    sourceUrl.protocol = "https:";
    await execute(
      "git",
      ["-C", checkout, "remote", "add", "origin", sourceUrl.href],
      { cwd: root },
    );
  }
  const fetchOptions = {
    cwd: root,
    timeout: 120_000,
    maxBuffer: 8 * 1024 * 1024,
  };
  try {
    await execute(
      "git",
      [
        "-C",
        checkout,
        "fetch",
        "--quiet",
        "--depth=1",
        "--filter=blob:none",
        "origin",
        commit,
      ],
      fetchOptions,
    );
  } catch {
    await execute(
      "git",
      ["-C", checkout, "config", "--unset-all", "remote.origin.promisor"],
      fetchOptions,
    ).catch(() => {});
    await execute(
      "git",
      [
        "-C",
        checkout,
        "config",
        "--unset-all",
        "remote.origin.partialclonefilter",
      ],
      fetchOptions,
    ).catch(() => {});
    await execute(
      "git",
      [
        "-C",
        checkout,
        "fetch",
        "--quiet",
        "origin",
        "+refs/heads/*:refs/remotes/origin/*",
      ],
      fetchOptions,
    );
  }
  await execute(
    "git",
    ["-C", checkout, "checkout", "--quiet", "--detach", "FETCH_HEAD"],
    {
      cwd: root,
      timeout: 30_000,
    },
  );
  return checkout;
}

function sourceFiles(directory, output = []) {
  if (!fs.existsSync(directory)) return output;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (
      [".git", ".build", "build", "dep", "deps", "doc", "docs", "res"].includes(
        entry.name,
      )
    )
      continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) sourceFiles(target, output);
    else if (
      entry.isFile() &&
      /\.(?:c|cc|cpp|cxx|h|hh|hpp)$/i.test(entry.name) &&
      fs.statSync(target).size <= 2_000_000
    )
      output.push(target);
  }
  return output;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function modelRegistration(module, text) {
  return new RegExp(
    `createModel\\s*<([\\s\\S]{0,500}?)>\\s*\\(\\s*["']${escapeRegex(module.model)}["']`,
  ).exec(text);
}

function registeredWidget(module, text) {
  const match = modelRegistration(module, text);
  if (!match) return null;
  const expression = match[1].split(",").at(-1)?.trim().split(/\s+/).at(-1);
  if (!expression) return null;
  return {
    expression,
    name: expression.replace(/<.*$/, "").split("::").at(-1),
    templateArgument: Number(/<(\d+)>$/.exec(expression)?.[1]),
  };
}

function checkoutSourceIndex(checkout, sourceByCheckout) {
  let source = sourceByCheckout.get(checkout);
  if (source) return source;
  source = {
    assets: svgFiles(checkout),
    code: sourceFiles(checkout).map((file) => ({
      file,
      text: fs.readFileSync(file, "utf8"),
    })),
  };
  sourceByCheckout.set(checkout, source);
  return source;
}

function registeredPanelAssets(module, source) {
  const widgetNames = source.code.flatMap(({ text }) => {
    const widget = registeredWidget(module, text);
    return widget ? [widget.name] : [];
  });
  const quotedAssets = [];
  for (const widgetName of new Set(widgetNames)) {
    const declaration = new RegExp(
      `(?:class|struct)\\s+${escapeRegex(widgetName)}\\b|${escapeRegex(widgetName)}\\s*::\\s*${escapeRegex(widgetName)}\\s*\\(`,
      "g",
    );
    for (const { text } of source.code) {
      for (const match of text.matchAll(declaration)) {
        const body = text.slice(match.index, match.index + 30_000);
        const panel =
          /(?:setPanel|loadPanel)\s*\([\s\S]{0,500}?["']([^"']+\.svg)["']/i.exec(
            body,
          );
        if (panel) quotedAssets.push(panel[1]);
      }
    }
  }
  return source.assets.filter((file) =>
    quotedAssets.some(
      (quoted) =>
        path.normalize(file).endsWith(path.normalize(quoted)) ||
        normalizedAssetName(path.basename(file)) ===
          normalizedAssetName(path.basename(quoted)),
    ),
  );
}

function arithmeticValue(expression, templateArgument) {
  let normalized = expression
    .replace(/RACK_GRID_WIDTH/g, "15")
    .replace(/\b([0-9.]+)f\b/g, "$1");
  if (Number.isFinite(templateArgument))
    normalized = normalized.replace(/\bx\b/g, String(templateArgument));
  if (!/^[0-9+*/().\s-]+$/.test(normalized)) return null;
  try {
    const value = Function(`"use strict"; return (${normalized});`)();
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function sourceProgrammaticWidth(module, source) {
  const namedHp = /(?:Blank|Color)(\d+)HP$/i.exec(module.model);
  if (namedHp) return Number(namedHp[1]) * RACK_HP_WIDTH;

  const registrations = source.code.flatMap(({ text }) => {
    const widget = registeredWidget(module, text);
    return widget ? [widget] : [];
  });
  const widths = [];
  for (const widget of registrations) {
    const declaration = new RegExp(
      `(?:class|struct)\\s+${escapeRegex(widget.name)}\\b|${escapeRegex(widget.name)}\\s*::\\s*${escapeRegex(widget.name)}\\s*\\(`,
      "g",
    );
    for (const { text } of source.code) {
      for (const match of text.matchAll(declaration)) {
        const body = text.slice(match.index, match.index + 30_000);
        const macroUnits =
          /CREATE_PANEL\s*\(\s*[^,]+,\s*[^,]+,\s*([0-9.]+)/.exec(body);
        if (macroUnits) widths.push(Number(macroUnits[1]) * RACK_HP_WIDTH);
        const boxWidth =
          /(?:this->)?box\.size\s*=\s*(?:math::)?Vec\(\s*([^,]+),\s*(?:380|RACK_GRID_HEIGHT)\b/.exec(
            body,
          );
        const value =
          boxWidth && arithmeticValue(boxWidth[1], widget.templateArgument);
        if (value) widths.push(value);
      }
    }
  }
  const unique = [
    ...new Set(widths.map((width) => Math.round(width * 1_000) / 1_000)),
  ];
  return unique.length === 1 ? unique[0] : null;
}

function sourceAssetWidth(module, checkout, sourceByCheckout) {
  const source = checkoutSourceIndex(checkout, sourceByCheckout);
  const programmatic = sourceProgrammaticWidth(module, source);
  if (programmatic) return programmatic;
  const registered = registeredPanelAssets(module, source);
  const registeredWidths = [
    ...new Set(registered.map(svgPanelWidth).filter(Number.isFinite)),
  ];
  if (registeredWidths.length === 1) return registeredWidths[0];

  const model = normalizedAssetName(module.model);
  const matches = source.assets.filter(
    (file) =>
      normalizedAssetName(path.basename(file, path.extname(file))) === model,
  );
  const widths = [
    ...new Set(matches.map(svgPanelWidth).filter(Number.isFinite)),
  ];
  return widths.length === 1 ? widths[0] : null;
}

async function runPool(items, concurrency, task) {
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (cursor < items.length) await task(items[cursor++], cursor);
    }),
  );
}

export function webpDimensions(input) {
  const bytes = Buffer.from(input);
  if (
    bytes.length < 20 ||
    bytes.toString("ascii", 0, 4) !== "RIFF" ||
    bytes.toString("ascii", 8, 12) !== "WEBP"
  )
    return null;

  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunk = bytes.toString("ascii", offset, offset + 4);
    const length = bytes.readUInt32LE(offset + 4);
    const payload = offset + 8;
    if (
      chunk === "VP8L" &&
      payload + 5 <= bytes.length &&
      bytes[payload] === 0x2f
    ) {
      const packed = bytes.readUInt32LE(payload + 1);
      return {
        width: 1 + (packed & 0x3fff),
        height: 1 + ((packed >>> 14) & 0x3fff),
      };
    }
    if (chunk === "VP8X" && payload + 10 <= bytes.length) {
      return {
        width: 1 + bytes.readUIntLE(payload + 4, 3),
        height: 1 + bytes.readUIntLE(payload + 7, 3),
      };
    }
    if (
      chunk === "VP8 " &&
      payload + 10 <= bytes.length &&
      bytes[payload + 3] === 0x9d &&
      bytes[payload + 4] === 0x01 &&
      bytes[payload + 5] === 0x2a
    ) {
      return {
        width: bytes.readUInt16LE(payload + 6) & 0x3fff,
        height: bytes.readUInt16LE(payload + 8) & 0x3fff,
      };
    }
    offset = payload + length + (length & 1);
  }
  return null;
}

export function rackPanelWidth(dimensions) {
  if (
    !dimensions ||
    !Number.isSafeInteger(dimensions.width) ||
    !Number.isSafeInteger(dimensions.height) ||
    dimensions.width <= 0 ||
    dimensions.height <= 0
  )
    return null;
  const raw = (dimensions.width / dimensions.height) * RACK_PANEL_HEIGHT;
  const width = Math.round(raw / RACK_HP_WIDTH) * RACK_HP_WIDTH;
  if (
    width < RACK_HP_WIDTH ||
    width > 400 * RACK_HP_WIDTH ||
    Math.abs(raw - width) > 0.1
  )
    return null;
  return width;
}

export function mergePanelWidth(module, width) {
  return Number.isFinite(width) && width > 0 && module.width !== width
    ? { ...module, width }
    : module;
}

async function main() {
  const indexPath = path.join(root, "index.json");
  const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  const concurrency = Math.max(
    1,
    Math.min(64, Number(option("--concurrency", 32))),
  );
  const timeoutMs = Math.max(1_000, Number(option("--timeout-ms", 10_000)));
  const limit = Math.max(1, Number(option("--limit", Number.MAX_SAFE_INTEGER)));
  const key = option("--key", null);
  const plugin = option("--plugin", null);
  const write = process.argv.includes("--write");
  const sourceOnly = process.argv.includes("--source-only");
  const sourceFallback =
    sourceOnly ||
    process.argv.includes("--source-cache") ||
    process.argv.includes("--clone-missing");
  const cloneMissing = process.argv.includes("--clone-missing");
  const candidates = (sourceOnly ? [] : index.packages)
    .filter((module) => module.screenshotUrl)
    .filter(
      (module) =>
        (!key || module.key === key) && (!plugin || module.plugin === plugin),
    )
    .slice(0, limit);
  const byKey = new Map(index.packages.map((module) => [module.key, module]));
  const changedKeys = [];
  const failures = [];

  await runPool(candidates, concurrency, async (module, completed) => {
    try {
      const response = await fetch(module.screenshotUrl, {
        headers: { range: "bytes=0-1023" },
        redirect: "follow",
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const dimensions = webpDimensions(await response.arrayBuffer());
      const width = rackPanelWidth(dimensions);
      if (!width)
        throw new Error(
          `invalid Rack panel dimensions ${JSON.stringify(dimensions)}`,
        );
      const next = mergePanelWidth(module, width);
      if (next !== module) {
        byKey.set(module.key, next);
        changedKeys.push(module.key);
      }
    } catch (error) {
      failures.push({
        key: module.key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    if (completed % 500 === 0)
      process.stderr.write(`[${completed}/${candidates.length}]\n`);
  });
  const screenshotChanged = changedKeys.length;

  const sourceFailures = [];
  const sourceUnresolved = [];
  let sourceChecked = 0;
  let sourceMatched = 0;
  if (sourceFallback) {
    const sourceCandidates = index.packages
      .filter((module) => !module.screenshotUrl)
      .filter(
        (module) =>
          (!key || module.key === key) && (!plugin || module.plugin === plugin),
      )
      .slice(0, limit);
    const groups = [
      ...Map.groupBy(
        sourceCandidates,
        (module) => `${module.plugin}\0${module.sourceCommit}`,
      ).values(),
    ];
    const sourceByCheckout = new Map();
    await runPool(groups, Math.min(concurrency, 8), async (modules) => {
      let checkout;
      try {
        checkout = await sourceCheckout(modules[0], cloneMissing);
      } catch (error) {
        sourceFailures.push({
          key: modules[0].key,
          error: error instanceof Error ? error.message : String(error),
        });
        return;
      }
      for (const module of modules) {
        sourceChecked += 1;
        if (!checkout) {
          sourceUnresolved.push(module.key);
          continue;
        }
        const width = sourceAssetWidth(module, checkout, sourceByCheckout);
        if (!width) {
          sourceUnresolved.push(module.key);
          continue;
        }
        sourceMatched += 1;
        const current = byKey.get(module.key) ?? module;
        const next = mergePanelWidth(current, width);
        if (next !== current) {
          byKey.set(module.key, next);
          changedKeys.push(module.key);
        }
      }
    });
  }

  if (write && changedKeys.length) {
    const packages = index.packages.map(
      (module) => byKey.get(module.key) ?? module,
    );
    atomicJson(indexPath, {
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

  process.stdout.write(
    `${JSON.stringify(
      {
        checked: candidates.length,
        changed: changedKeys.length,
        changes: changedKeys.map((changedKey) => ({
          key: changedKey,
          from: index.packages.find((module) => module.key === changedKey)
            ?.width,
          to: byKey.get(changedKey)?.width,
        })),
        screenshotChanged,
        unchanged: candidates.length - screenshotChanged - failures.length,
        failures,
        sourceChecked,
        sourceMatched,
        sourceUnresolved,
        sourceFailures,
        write,
      },
      null,
      2,
    )}\n`,
  );
  if (failures.length || sourceFailures.length) process.exitCode = 2;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
    );
    process.exitCode = 1;
  });
