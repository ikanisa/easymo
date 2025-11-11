import express from "express";
import pinoHttp from "pino-http";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { WebhookWorker } from "./worker.js";

async function main() {
  logger.info({ config: { ...config, SUPABASE_SERVICE_ROLE_KEY: "***" } }, "Starting service");

  // Initialize worker
  const worker = new WebhookWorker();

  // Create health check server
  const app = express();
  app.use(express.json());
  app.use(pinoHttp({ logger: logger as any }));

  app.get("/health", (_req, res) => {
    const metrics = worker.getMetrics();
    res.json({
      status: "ok",
      uptime: process.uptime(),
      metrics,
    });
  });

  app.get("/metrics", (_req, res) => {
    const metrics = worker.getMetrics();
    res.json(metrics);
  });

  const server = app.listen(Number(config.PORT), () => {
    logger.info({ port: config.PORT }, "Health check server listening");
  });

  // Start the worker
  await worker.start();

  // Graceful shutdown
  const shutdown = async () => {
    logger.info("Shutting down gracefully...");
    await worker.stop();
    server.close(() => {
      logger.info("Server closed");
      process.exit(0);
    });
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((error) => {
  logger.error({ error: error.message, stack: error.stack }, "Fatal error");
  process.exit(1);
});
