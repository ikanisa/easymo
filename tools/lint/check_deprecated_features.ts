#!/usr/bin/env -S deno run --allow-read
/**
 * Guards against reintroducing deprecated product domains.
 * Scans selected runtime directories for banned keywords
 * and exits non-zero if any matches are found.
 */

const ROOT = new URL("../../", import.meta.url).pathname;
const SEARCH_TARGETS = ["."];

const IGNORE_DIR_PATTERNS = [
  /(^|\/)\.git(\/|$)/,
  /node_modules/,
  /\.next/,
  /dist\//,
  /build\//,
  /\.turbo/,
  /\.cache/,
  /supabase\/migrations/,
  /supabase\/seed/,
  /supabase\/seeders/,
  /supabase\/lib/,
  /supabase\/\.branches/,
  /supabase\/\.temp/,
];

const ALLOWED_FILES = new Set([
  "tools/lint/check_deprecated_features.ts",
  "README.md",
]);

const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".yml",
  ".yaml",
  ".sql",
  ".sh",
  ".txt",
  ".tsconfig",
]);

const BANNED_PATTERNS: Array<{ label: string; regex: RegExp }> = [
  { label: "BASKETS", regex: /\bBASKETS?\b/ },
  { label: "VOUCHERS", regex: /\bVOUCHERS?\b/ },
  { label: "CAMPAIGNS", regex: /\bCAMPAIGNS?\b/ },
  { label: "TEMPLATES", regex: /\bTEMPLATES?\b/ },
];

function shouldSkip(path: string): boolean {
  return IGNORE_DIR_PATTERNS.some((pattern) => pattern.test(path));
}

function hasTextExtension(path: string): boolean {
  const idx = path.lastIndexOf(".");
  if (idx === -1) return false;
  return TEXT_EXTENSIONS.has(path.slice(idx));
}

async function* walk(path: string): AsyncGenerator<string> {
  try {
    for await (const entry of Deno.readDir(path)) {
      const fullPath = `${path}/${entry.name}`;
      if (shouldSkip(fullPath)) continue;
      if (entry.isDirectory) {
        yield* walk(fullPath);
      } else if (entry.isFile) {
        if (hasTextExtension(fullPath) || SEARCH_TARGETS.includes(entry.name)) {
          yield fullPath;
        }
      }
    }
  } catch (err) {
    if ((err as Deno.errors.NotFound)?.name === "NotFound") {
      return;
    }
    throw err;
  }
}

type Violation = { label: string; relPath: string; line: number; snippet: string };

function normalizeRelative(path: string): string {
  return path.replace(`${ROOT}`, "").replace(/^\/+/, "");
}

async function scanFile(path: string): Promise<Violation[]> {
  if (path.endsWith("tools/lint/check_deprecated_features.ts")) {
    return [];
  }
  const rel = normalizeRelative(path);
  if (ALLOWED_FILES.has(rel) || ALLOWED_FILES.has(`./${rel}`)) {
    return [];
  }
  const relPath = normalizeRelative(path);
  const content = await Deno.readTextFile(path);
  const lines = content.split(/\r?\n/);
  const matches: Violation[] = [];

  for (const { label, regex } of BANNED_PATTERNS) {
    if (!regex.test(content)) continue;
    for (let i = 0; i < lines.length; i += 1) {
      if (regex.test(lines[i])) {
        matches.push({
          label,
          relPath,
          line: i + 1,
          snippet: lines[i].trim(),
        });
        break;
      }
    }
  }

  return matches;
}

async function main() {
  const violations: Violation[] = [];

  for (const target of SEARCH_TARGETS) {
    const absolute = `${ROOT}${target}`;
    try {
      const stat = await Deno.lstat(absolute);
      if (stat.isFile) {
        const hits = await scanFile(absolute);
        hits.forEach((hit) => violations.push(hit));
        continue;
      }
      if (stat.isDirectory) {
        for await (const file of walk(absolute)) {
          const hits = await scanFile(file);
          hits.forEach((hit) => violations.push(hit));
        }
      }
    } catch (err) {
      if ((err as Deno.errors.NotFound)?.name === "NotFound") {
        continue;
      }
      throw err;
    }
  }

  if (violations.length) {
    console.error("Deprecated domain references detected. Remove or rename these usages:\n");
    violations.forEach((violation) => {
      console.error(
        `- [${violation.label}] ${violation.relPath}:${violation.line} ${violation.snippet}`,
      );
    });
    Deno.exit(1);
  }
}

await main();
