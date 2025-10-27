/**
 * Example Ground Rules Middleware for Express/NestJS
 * 
 * Demonstrates proper implementation of:
 * - Request/response logging with correlation IDs
 * - Metrics recording
 * - Feature flag enforcement
 * - Security headers
 * 
 * @see docs/GROUND_RULES.md
 */

import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { logger, childLogger } from '@easymo/commons';

/**
 * Request logging middleware that captures all HTTP requests
 * with structured logging and correlation IDs
 */
@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    
    // Generate or extract correlation ID
    const correlationId = req.headers['x-correlation-id'] as string ||
                         req.headers['x-request-id'] as string ||
                         crypto.randomUUID();
    
    // Attach correlation ID to request for use in downstream handlers
    (req as any).correlationId = correlationId;
    
    // Add correlation ID to response headers
    res.setHeader('x-correlation-id', correlationId);
    
    // Log request start
    this.logger.log({
      event: 'REQUEST_START',
      method: req.method,
      path: req.path,
      correlationId,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });

    // Listen for response finish to log completion
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const logLevel = res.statusCode >= 500 ? 'error' 
                     : res.statusCode >= 400 ? 'warn' 
                     : 'log';
      
      this.logger[logLevel]({
        event: 'REQUEST_COMPLETE',
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        correlationId,
      });
    });

    next();
  }
}

/**
 * Security headers middleware
 * Adds security-related headers to all responses
 */
@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Enable XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    
    // Enforce HTTPS
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    
    next();
  }
}

/**
 * Metrics middleware that records request metrics
 */
@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  private readonly logger = childLogger({ component: 'metrics' });

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      
      // Record metrics as structured logs
      this.logger.info({
        event: 'METRIC',
        metric: 'http.request',
        value: 1,
        dimensions: {
          method: req.method,
          path: req.route?.path || req.path,
          statusCode: res.statusCode,
          status: res.statusCode >= 200 && res.statusCode < 300 ? 'success' : 'error',
        },
      });
      
      this.logger.info({
        event: 'METRIC',
        metric: 'http.duration',
        value: duration,
        dimensions: {
          method: req.method,
          path: req.route?.path || req.path,
          unit: 'ms',
        },
      });
    });

    next();
  }
}

/**
 * Example of how to use these middlewares in a NestJS application
 * 
 * In your main.ts or app.module.ts:
 * 
 * ```typescript
 * import { RequestLoggingMiddleware, SecurityHeadersMiddleware, MetricsMiddleware } from './middleware/ground-rules.middleware';
 * 
 * export class AppModule implements NestModule {
 *   configure(consumer: MiddlewareConsumer) {
 *     consumer
 *       .apply(SecurityHeadersMiddleware, RequestLoggingMiddleware, MetricsMiddleware)
 *       .forRoutes('*');
 *   }
 * }
 * ```
 */

/**
 * Utility function to mask PII in logs
 */
export function maskPII(value: string | null | undefined, visibleStart = 4, visibleEnd = 3): string | null {
  if (!value || typeof value !== 'string') return null;
  if (value.length <= visibleStart + visibleEnd) return '***';
  
  const start = value.slice(0, visibleStart);
  const end = value.slice(-visibleEnd);
  return `${start}***${end}`;
}

/**
 * Decorator for adding structured logging to service methods
 * 
 * Usage:
 * ```typescript
 * @Injectable()
 * export class MyService {
 *   @LogServiceMethod('my_service')
 *   async doSomething(param: string): Promise<Result> {
 *     // method implementation
 *   }
 * }
 * ```
 */
export function LogServiceMethod(scope: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const serviceLogger = childLogger({ scope, method: propertyKey });

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      
      serviceLogger.info({
        event: 'METHOD_START',
        args: args.map(arg => typeof arg === 'object' ? '[Object]' : arg),
      });

      try {
        const result = await originalMethod.apply(this, args);
        const duration = Date.now() - startTime;
        
        serviceLogger.info({
          event: 'METHOD_SUCCESS',
          duration,
        });
        
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        
        serviceLogger.error({
          event: 'METHOD_ERROR',
          error: error instanceof Error ? error.message : String(error),
          duration,
        });
        
        throw error;
      }
    };

    return descriptor;
  };
}
