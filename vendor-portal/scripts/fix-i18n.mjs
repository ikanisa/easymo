#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const localesDir = path.resolve("locales");

function loadJson(file) {
  const p = path.join(localesDir, file);
  const raw = fs.readFileSync(p, "utf8");
  return JSON.parse(raw);
}

function saveJson(file, obj) {
  const p = path.join(localesDir, file);
  const json = JSON.stringify(obj, null, 2) + "\n";
  fs.writeFileSync(p, json, "utf8");
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

const en = flatten(loadJson("en/common.json"));
const rw = flatten(loadJson("rw/common.json"));
const fr = flatten(loadJson("fr/common.json"));

const allKeys = new Set(Object.keys(en));

let addedRw = 0;
let addedFr = 0;

for (const key of allKeys) {
  if (!(key in rw)) {
    rw[key] = en[key];
    addedRw++;
  }
  if (!(key in fr)) {
    fr[key] = en[key];
    addedFr++;
  }
}

// Save flat, sorted maps (keys with dots) expected by the app
const rwOutFlat = Object.fromEntries(
  Object.keys(rw)
    .sort()
    .map((k) => [k, rw[k]])
);
const frOutFlat = Object.fromEntries(
  Object.keys(fr)
    .sort()
    .map((k) => [k, fr[k]])
);

saveJson("rw/common.json", rwOutFlat);
saveJson("fr/common.json", frOutFlat);

console.log(`Filled missing keys → rw:+${addedRw}, fr:+${addedFr}`);
