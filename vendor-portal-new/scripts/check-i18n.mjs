#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const localesDir = path.resolve("locales");
const files = ["en/common.json", "rw/common.json", "fr/common.json"];

function loadJson(file) {
  const p = path.join(localesDir, file);
  const raw = fs.readFileSync(p, "utf8");
  return JSON.parse(raw);
}

function flatten(obj, prefix = "") {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      Object.assign(out, flatten(v, key));
    } else {
      out[key] = v;
    }
  }
  return out;
}

const dicts = Object.fromEntries(files.map((f) => [f.slice(0, 2), flatten(loadJson(f))]));
const allKeys = new Set([
  ...Object.keys(dicts.en),
  ...Object.keys(dicts.rw),
  ...Object.keys(dicts.fr),
]);

const report = { en: [], rw: [], fr: [] };
for (const key of allKeys) {
  if (!(key in dicts.en)) report.en.push(key);
  if (!(key in dicts.rw)) report.rw.push(key);
  if (!(key in dicts.fr)) report.fr.push(key);
}

let exit = 0;
for (const [locale, missing] of Object.entries(report)) {
  if (missing.length) {
    exit = 1;
    console.log(`Missing keys in ${locale}:`);
    for (const k of missing) console.log(`  - ${k}`);
  }
}

if (!exit) console.log("All locale files have matching keys.");
// Exit non-zero when keys are missing so CI can fail fast
process.exit(exit);
