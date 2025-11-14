import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

const cwd = process.cwd();
const projectRoot = cwd.endsWith("admin-app") ? cwd : join(cwd, "admin-app");

const entryPoints = [
  "src/v2/lib/supabase/hooks.ts",
  "app/v2/agents/page.tsx",
  "app/v2/drivers/page.tsx",
  "app/v2/stations/page.tsx",
  "app/v2/dashboard/page.tsx",
];

async function bundle(entry: string) {
  const script = `
import { build } from "esbuild";
import { join } from "node:path";

const projectRoot = ${JSON.stringify(projectRoot)};
const entryPoint = join(projectRoot, ${JSON.stringify(entry)});

const result = await build({
  absWorkingDir: projectRoot,
  entryPoints: [entryPoint],
  bundle: true,
  platform: "browser",
  format: "esm",
  write: false,
  logLevel: "error",
  tsconfig: join(projectRoot, "tsconfig.json"),
  loader: {
    ".css": "empty",
    ".module.css": "empty",
  },
});

const output = result.outputFiles?.find((file) => file.path.endsWith(".js"))?.text ?? "";
process.stdout.write(JSON.stringify({
  hasServiceRole: output.includes("SUPABASE_SERVICE_ROLE_KEY"),
  hasAdminClient: output.includes("createAdminClient"),
}));
`;

  const { stdout } = await execFileAsync(process.execPath, [
    "--input-type=module",
    "-e",
    script,
  ], {
    cwd: projectRoot,
    env: {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV ?? "test",
    },
    maxBuffer: 10 * 1024 * 1024,
  });

  return JSON.parse(stdout || "{}");
}

describe("client bundles", () => {
  for (const entry of entryPoints) {
    it(`omits service-role secrets from ${entry}`, async () => {
      const result = await bundle(entry);
      expect(result.hasServiceRole).toBe(false);
      expect(result.hasAdminClient).toBe(false);
    });
  }
});
