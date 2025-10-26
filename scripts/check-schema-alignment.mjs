#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");
const migrationsDir = join(repoRoot, "supabase", "migrations");
const schemaPath = join(repoRoot, "latest_schema.sql");

const listSqlFiles = () => readdirSync(migrationsDir)
  .filter((entry) => entry.endsWith(".sql"))
  .sort((a, b) => a.localeCompare(b));

const computeChecksum = (files) => {
  const hash = createHash("sha256");
  for (const file of files) {
    const contents = readFileSync(join(migrationsDir, file));
    hash.update(contents);
  }
  return hash.digest("hex");
};

const main = () => {
  const migrations = listSqlFiles();
  if (migrations.length === 0) {
    console.error("No migrations found under supabase/migrations.");
    process.exit(1);
  }

  const expected = computeChecksum(migrations);
  const schema = readFileSync(schemaPath, "utf8");
  const marker = schema.match(/--\s*MIGRATIONS_CHECKSUM:\s*([a-f0-9]+)/i);

  if (!marker) {
    console.error(
      "latest_schema.sql is missing the MIGRATIONS_CHECKSUM marker. " +
        "Re-export the schema and include the checksum comment.",
    );
    process.exit(1);
  }

  const recorded = marker[1].trim();
  if (recorded !== expected) {
    console.error(
      [
        "Schema dump is out of sync with migrations.",
        `  expected checksum: ${expected}`,
        `  recorded checksum: ${recorded}`,
        "",
        "Run `supabase db dump --schema public > latest_schema.sql` (or your existing schema export process),",
        "then update the MIGRATIONS_CHECKSUM line to match the new dump.",
      ].join("\n"),
    );
    process.exit(1);
  }

  console.log("latest_schema.sql matches current migrations ✅");
};

main();
