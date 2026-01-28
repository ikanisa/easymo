import {
  childLogger,
  createMetricsRegistry,
  metricsHandler,
  metricsMiddleware,
  runWithRequestContext,
} from "@easymo/commons";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";
import { Logger } from "nestjs-pino";

import "./env";
import { AppModule } from "./app.module.js";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor.js";
import { RequestIdInterceptor } from "./common/interceptors/request-id.interceptor.js";
import { initialiseTelemetry } from "./telemetry.js";

const log = childLogger({ service: 'agent-core' });

async function bootstrap() {
  initialiseTelemetry();

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const metricsRegistry = createMetricsRegistry("agent_core");
  app.use(metricsMiddleware(metricsRegistry));
  app.get("/metrics", metricsHandler(metricsRegistry));

  app.useLogger(app.get(Logger));
  app.use((req, _res, next) => {
    const headerId = typeof req.headers["x-request-id"] === "string"
      ? req.headers["x-request-id"]
      : undefined;
    runWithRequestContext(() => next(), headerId ? { requestId: headerId } : undefined);
  });

  app.use(helmet());
  const logger = app.get(Logger);
  app.useGlobalInterceptors(new RequestIdInterceptor(), new LoggingInterceptor(logger));
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  await app.listen(port);
}

bootstrap().catch((error) => {
  log.error("agent-core bootstrap failed", error);
  process.exit(1);
});
