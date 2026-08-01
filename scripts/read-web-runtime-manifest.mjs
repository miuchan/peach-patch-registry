#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const manifest=JSON.parse(fs.readFileSync(path.join(projectDir,"web-runtime","modules.json"),"utf8"));
const allowedStrategies=new Set(["ordered-translation","browser-dsp-adapter","rack-boundary"]);
if(manifest.schemaVersion!==1||manifest.abiVersion!=="0.3"||!Array.isArray(manifest.modules))throw new Error("Unsupported Rack Web module manifest");
const keys=new Set(),entries=new Set(),artifacts=new Set();
for(const item of manifest.modules){
  if(!item||typeof item.key!=="string"||!/^[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/.test(item.key))throw new Error("Invalid module key in manifest");
  if(typeof item.entry!=="string"||!/^[a-z0-9_]+$/.test(item.entry))throw new Error(`Invalid entry for ${item.key}`);
  if(typeof item.artifact!=="string"||!/^[a-z0-9-]+$/.test(item.artifact))throw new Error(`Invalid artifact for ${item.key}`);
  if(!Number.isSafeInteger(item.initialMemory)||item.initialMemory<1048576||item.initialMemory%65536!==0)throw new Error(`Invalid initialMemory for ${item.key}`);
  if(!allowedStrategies.has(item.strategy))throw new Error(`Invalid strategy for ${item.key}`);
  if(keys.has(item.key)||entries.has(item.entry)||artifacts.has(item.artifact))throw new Error(`Duplicate manifest identity for ${item.key}`);
  keys.add(item.key);entries.add(item.entry);artifacts.add(item.artifact);
  if(!fs.existsSync(path.join(projectDir,"web-runtime","plugins",`${item.entry}.cpp`)))throw new Error(`Missing C++ entry for ${item.key}`);
}
const requested=process.argv.slice(2),selected=requested.length?manifest.modules.filter(item=>requested.includes(item.key)):manifest.modules;
for(const key of requested)if(!keys.has(key))throw new Error(`Unknown Rack Web module: ${key}`);
for(const item of selected)process.stdout.write(`${item.entry}\t${item.artifact}\t${item.initialMemory}\t${item.key}\n`);
