import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(projectRoot, "../../..");
const nextBin = path.resolve(
  __dirname,
  "..",
  "node_modules",
  ".bin",
  process.platform === "win32" ? "next.cmd" : "next"
);

const mode = process.argv[2] ?? "dev";
const host = process.env.HOST ?? "0.0.0.0";
const explicitPort = process.env.PORT;
const defaultPort = Number.parseInt(explicitPort ?? "3100", 10);

if (!["dev", "start"].includes(mode)) {
  console.error(`Unsupported Next.js mode "${mode}". Use "dev" or "start".`);
  process.exit(1);
}

const port =
  mode === "dev" && explicitPort === undefined
    ? await findAvailablePort(defaultPort, host)
    : defaultPort;

if (mode === "dev" && explicitPort === undefined && port !== defaultPort) {
  console.log(`Port ${defaultPort} is in use. Falling back to ${port}.`);
}

const loadedEnv = loadEnvFiles([
  path.join(repoRoot, ".env"),
  path.join(repoRoot, ".env.local"),
  path.join(projectRoot, ".env"),
  path.join(projectRoot, ".env.local"),
]);

const env = {
  ...loadedEnv,
  ...process.env,
  PORT: String(port),
  // Explicitly set NODE_ENV based on mode
  NODE_ENV: mode === "dev" ? "development" : "production",
};
const stubAllowed = env.ALLOW_STUB_ENV !== "0";
if (stubAllowed && !env.ALLOW_STUB_ENV) {
  env.ALLOW_STUB_ENV = "1";
}
if (stubAllowed && !env.AUTH_E2E_STUB) {
  env.AUTH_E2E_STUB = "1";
}

const args = [mode, "--port", String(port), "--hostname", host];
const child = spawn(nextBin, args, {
  stdio: "inherit",
  env,
});

child.on("close", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

child.on("error", (error) => {
  console.error(`Failed to launch "next ${mode}":`, error);
  process.exit(1);
});

function loadEnvFiles(files) {
  const result = {};
  for (const filePath of files) {
    if (!filePath) continue;
    try {
      const stats = fs.statSync(filePath);
      if (!stats.isFile()) continue;
      Object.assign(result, parseEnvFile(filePath));
    } catch {
      // ignore missing files
    }
  }
  return result;
}

function parseEnvFile(filePath) {
  const contents = fs.readFileSync(filePath, "utf8");
  const entries = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^(?:export\s+)?([^=]+)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    if (!key) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    entries[key] = value;
  }
  return entries;
}

async function findAvailablePort(startPort, host) {
  let port = startPort;
  while (port < startPort + 1000) {
    const available = await isPortAvailable(port, host);
    if (available) {
      return port;
    }
    port += 1;
  }
  throw new Error(`Could not find an open port starting from ${startPort}.`);
}

function isPortAvailable(port, host) {
  return new Promise((resolve, reject) => {
    const tester = net
      .createServer()
      .once("error", (error) => {
        if (error.code === "EADDRINUSE" || error.code === "EACCES") {
          resolve(false);
        } else {
          reject(error);
        }
      })
      .once("listening", () => {
        tester.once("close", () => resolve(true)).close();
      })
      .listen({ port, host });
  });
}
