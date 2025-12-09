#!/usr/bin/env node
import { spawn } from "node:child_process";
import { cp, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const reportsDir = path.join(process.cwd(), ".reports", "bundle");
await mkdir(reportsDir, { recursive: true });

const build = spawn("pnpm", ["run", "build"], {
  stdio: "inherit",
  env: { ...process.env, ANALYZE_BUNDLE: "1" },
});

build.on("exit", async (code) => {
  if (code === 0) {
    const analyzeDir = path.join(process.cwd(), ".next", "analyze");
    if (existsSync(analyzeDir)) {
      await cp(analyzeDir, reportsDir, { recursive: true });
      console.log(`Bundle analyzer output copied to ${reportsDir}`);
    } else {
      console.warn("Bundle analyzer output not found; ensure @next/bundle-analyzer is installed.");
    }
  }
  process.exit(code ?? 1);
});
