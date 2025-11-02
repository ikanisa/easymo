import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

import {
  attachRequestToLogger,
  attachSpanToLogger,
  attachTraceToLogger,
  logger,
  withTelemetryContext,
} from '@easymo/commons';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const startedAt = Date.now();
    const requestIdHeader = req.headers['x-request-id'];
    const traceIdHeader = req.headers['x-trace-id'];

    const requestId = typeof requestIdHeader === 'string' && requestIdHeader.length > 0 ? requestIdHeader : randomUUID();
    const traceId = typeof traceIdHeader === 'string' && traceIdHeader.length > 0 ? traceIdHeader : requestId;
    const spanId = randomUUID();

    req.headers['x-request-id'] = requestId;
    req.headers['x-trace-id'] = traceId;
    res.setHeader('x-request-id', requestId);
    res.setHeader('x-trace-id', traceId);

    void withTelemetryContext(
      async () => {
        attachRequestToLogger(requestId);
        attachTraceToLogger(traceId);
        attachSpanToLogger(spanId);

        res.on('finish', () => {
          const duration = Date.now() - startedAt;
          logger.info({
            event: 'http.request.completed',
            method: req.method,
            path: req.originalUrl,
            status_code: res.statusCode,
            duration_ms: duration,
            target: 'api-router',
          });
        });

        next();
      },
      {
        requestId,
        traceId,
        spanId,
        metadata: {
          method: req.method,
          path: req.originalUrl,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        },
      },
    );
  }
}
