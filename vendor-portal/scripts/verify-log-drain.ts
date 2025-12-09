import http from "node:http";
import { once } from "node:events";
import { logInfo } from "@/lib/observability/logger";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const requests: Array<{ path: string; body: string; headers: http.IncomingHttpHeaders }> = [];
  let ingestCalls = 0;

  const server = http.createServer((req, res) => {
    const path = req.url ?? "/";
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      requests.push({ path, body, headers: req.headers });
      if (path.startsWith("/ingest")) {
        ingestCalls += 1;
        res.statusCode = ingestCalls === 1 ? 500 : 204;
      } else {
        res.statusCode = 202;
      }
      res.end();
    });
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to determine log drain test port");
  }
  const { port } = address;

  const baseUrl = `http://127.0.0.1:${port}`;
  process.env.LOG_DRAIN_URL = `${baseUrl}/ingest`;
  process.env.LOG_DRAIN_TOKEN = "ci-token";
  process.env.LOG_DRAIN_SOURCE = "ci";
  process.env.LOG_DRAIN_ALERT_WEBHOOK = `${baseUrl}/alert`;
  process.env.LOG_DRAIN_ALERT_TOKEN = "alert-token";
  process.env.LOG_DRAIN_ALERT_COOLDOWN_MS = "10";
  process.env.LOG_DRAIN_SILENT = "1";

  logInfo("ci_drain_check", { stage: "start" });
  await sleep(200);

  server.close();
  await once(server, "close");

  const alert = requests.find((request) => request.path.startsWith("/alert"));
  if (!alert) {
    throw new Error("Log drain alert webhook was not invoked when the drain failed");
  }

  if (!requests.some((request) => request.path.startsWith("/ingest"))) {
    throw new Error("Logger did not attempt to forward to the drain endpoint");
  }

  const payload = JSON.parse(alert.body || "{}") as { event?: string; reason?: string };
  if (payload.event !== "log_drain_failure") {
    throw new Error(`Unexpected alert payload: ${alert.body}`);
  }

  if (!payload.reason) {
    throw new Error("Alert payload missing failure reason");
  }
}

main().catch((error) => {
  console.error("log drain verification failed", error);
  process.exit(1);
});
