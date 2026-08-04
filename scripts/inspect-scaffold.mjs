#!/usr/bin/env node
import fs from "node:fs";
import * as scaffold from "./scaffold-library-module.mjs";
import { browserTdScopeAdapterSource } from "./td-scope-browser-adapter.mjs";
import { browserTemporalDeckAdapterSource } from "./temporal-deck-browser-adapter.mjs";

const operations = new Map([
  ...Object.entries(scaffold).filter(([, value]) => typeof value === "function"),
  ["browserTdScopeAdapterSource", browserTdScopeAdapterSource],
  ["browserTemporalDeckAdapterSource", browserTemporalDeckAdapterSource],
]);

function decode(value) {
  if (Array.isArray(value)) return value.map(decode);
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value.$map))
    return new Map(value.$map.map(([key, item]) => [decode(key), decode(item)]));
  if (Array.isArray(value.$set)) return new Set(value.$set.map(decode));
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decode(item)]));
}

function encode(_key, value) {
  if (value instanceof Map) return { $map: [...value.entries()] };
  if (value instanceof Set) return { $set: [...value] };
  return value;
}

async function dispatch(request) {
  const operation = operations.get(request.operation);
  if (!operation)
    throw new Error(`Unsupported scaffold inspection operation: ${request.operation}`);
  return operation(...(request.arguments ?? []));
}

try {
  const request = decode(JSON.parse(fs.readFileSync(0, "utf8")));
  const result = Array.isArray(request)
    ? await Promise.all(request.map(dispatch))
    : await dispatch(request);
  process.stdout.write(`${JSON.stringify(result, encode)}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
}
