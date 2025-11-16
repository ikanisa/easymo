#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const requiredEnv = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_JWT_SECRET",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_ENVIRONMENT_LABEL",
  "SLA_ALERT_WEBHOOK_URL",
  "SUPABASE_CHANNEL_MONITOR_WEBHOOK",
  "AGENT_AUDIT_WEBHOOK_URL",
];

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");
const publicDir = join(repoRoot, "admin-app", "public");
const manifestPath = join(publicDir, "manifest.webmanifest");
const swPath = join(publicDir, "sw.js");
const migrationsDir = join(repoRoot, "supabase", "migrations");
const schemaPath = join(repoRoot, "latest_schema.sql");
const envPath = join(repoRoot, ".env");

function loadLocalEnv() {
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const [rawKey, ...rest] = line.split("=");
    const key = rawKey.trim();
    const value = rest.join("=").trim();
    if (!process.env[key] && value) {
      process.env[key] = value;
    }
  }
}

function verifyEnv() {
  const missing = requiredEnv.filter((key) => {
    const value = process.env[key];
    return !value || value.trim().length === 0;
  });

  if (missing.length) {
    return {
      ok: false,
      message: [
        "Environment verification failed:",
        ...missing.map((key) => `  - ${key}`),
        "Populate these variables locally or in Netlify before deploying.",
      ].join("\n"),
    };
  }

  return { ok: true, message: "All critical environment variables are present." };
}

function computeChecksum(files) {
  const hash = createHash("sha256");
  for (const file of files) {
    const contents = readFileSync(join(migrationsDir, file));
    hash.update(contents);
  }
  return hash.digest("hex");
}

function verifySchemaChecksum() {
  if (!existsSync(migrationsDir)) {
    return { ok: false, message: "Missing supabase/migrations directory." };
  }

  const migrations = readdirSync(migrationsDir);
  const files = migrations
    .filter((entry) => entry.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));

  if (files.length === 0) {
    return { ok: false, message: "No migrations found under supabase/migrations." };
  }

  if (!existsSync(schemaPath)) {
    return { ok: false, message: "latest_schema.sql is missing from the repository root." };
  }

  const expected = computeChecksum(files);
  const schema = readFileSync(schemaPath, "utf8");
  const marker = schema.match(/--\s*MIGRATIONS_CHECKSUM:\s*([a-f0-9]+)/);

  if (!marker) {
    return {
      ok: false,
      message: "latest_schema.sql is missing the MIGRATIONS_CHECKSUM marker. Regenerate the dump before deploying.",
    };
  }

  const recorded = marker[1].trim();
  if (recorded !== expected) {
    return {
      ok: false,
      message: [
        "Schema dump is out of sync with migrations.",
        `  expected checksum: ${expected}`,
        `  recorded checksum: ${recorded}`,
        "Re-export latest_schema.sql and update the MIGRATIONS_CHECKSUM comment before deploying.",
      ].join("\n"),
    };
  }

  return { ok: true, message: "latest_schema.sql matches current migrations." };
}

function extractPrecacheList(swContents) {
  const match = swContents.match(/const\s+PRECACHE_URLS\s*=\s*\[(?<items>[\s\S]*?)\];/);
  if (!match || !match.groups?.items) return null;
  return match.groups.items
    .split(",")
    .map((line) => line.replace(/["'`]/g, "").trim())
    .filter(Boolean);
}

function verifyServiceWorkerManifest() {
  if (!existsSync(manifestPath)) {
    return { ok: false, message: "public/manifest.webmanifest is missing." };
  }
  if (!existsSync(swPath)) {
    return { ok: false, message: "public/sw.js is missing." };
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (err) {
    return { ok: false, message: "public/manifest.webmanifest is not valid JSON." };
  }
  const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
  const iconPaths = icons.map((icon) => icon.src).filter(Boolean);

  const missingIconFiles = iconPaths.filter((iconPath) => {
    const relative = iconPath.replace(/^\//, "");
    return !existsSync(join(publicDir, relative));
  });

  const swContents = readFileSync(swPath, "utf8");
  const precacheList = extractPrecacheList(swContents);

  if (!precacheList) {
    return { ok: false, message: "Could not find PRECACHE_URLS in public/sw.js." };
  }

  const expectedEntries = ["/manifest.webmanifest", ...iconPaths];
  const missingInCache = expectedEntries.filter((entry) => !precacheList.includes(entry));

  if (missingIconFiles.length || missingInCache.length) {
    return {
      ok: false,
      message: [
        missingIconFiles.length ? `Missing icon files referenced in manifest: ${missingIconFiles.join(", ")}` : null,
        missingInCache.length ? `Service worker PRECACHE_URLS is missing: ${missingInCache.join(", ")}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }

  return { ok: true, message: "Service worker cache list matches manifest icons." };
}

async function main() {
  loadLocalEnv();

  const steps = [
    ["Environment completeness", verifyEnv],
    ["Schema checksum", verifySchemaChecksum],
    ["Service worker manifest integrity", verifyServiceWorkerManifest],
  ];

  const failures = [];

  for (const [label, fn] of steps) {
    const result = await fn();
    if (result.ok) {
      console.log(`✅ ${label}: ${result.message}`);
    } else {
      failures.push(`${label}: ${result.message}`);
    }
  }

  if (failures.length) {
    console.error("\nPre-deploy check failed:\n" + failures.join("\n"));
    process.exit(1);
  }

  console.log("\nAll deployment gate checks passed. Safe to deploy ✅");
}

main().catch((error) => {
  console.error("Unexpected failure during deploy:check", error);
  process.exit(1);
});
