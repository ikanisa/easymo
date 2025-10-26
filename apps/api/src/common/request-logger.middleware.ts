import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const startedAt = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - startedAt;
      this.logger.log(
        `${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`,
        req.headers['x-request-id'] || undefined,
      );
    });

    next();
  }
}
