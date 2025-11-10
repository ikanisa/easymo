import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { loadConfig } from "./config.js";
import { VideoOrchestrator } from "./orchestrator.js";
import type { RenderPlanOptions } from "./orchestrator.js";
import type { RenderInputs } from "./types.js";

async function readJson<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  const body = Buffer.concat(chunks).toString("utf-8");
  return JSON.parse(body) as T;
}

function sendJson(res: ServerResponse, status: number, payload: unknown) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
}

const config = loadConfig();
const orchestrator = new VideoOrchestrator({
  workingDirectory: config.workingDirectory,
  ffmpegBinary: config.ffmpegBinary,
  captionDirectory: config.captionDirectory,
  concurrency: config.concurrency,
});

createServer(async (req, res) => {
  if (!req.url) {
    sendJson(res, 400, { ok: false, error: "missing_url" });
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    sendJson(res, 200, { ok: true, status: "healthy" });
    return;
  }

  if (req.method === "POST" && req.url.startsWith("/render")) {
    try {
      const { plan, options } = await readJson<{
        plan: RenderInputs["plan"];
        options?: RenderPlanOptions;
      }>(req);
      if (!plan) {
        sendJson(res, 400, { ok: false, error: "missing_plan" });
        return;
      }
      const outcome = await orchestrator.render({ plan }, options);
      sendJson(res, 200, { ok: true, data: outcome });
    } catch (error) {
      console.error(error);
      sendJson(res, 500, {
        ok: false,
        error: error instanceof Error ? error.message : "render_failed",
      });
    }
    return;
  }

  sendJson(res, 404, { ok: false, error: "not_found" });
}).listen(config.port, () => {
  console.log(`video orchestrator listening on :${config.port}`);
});
