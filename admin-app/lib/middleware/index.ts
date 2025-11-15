import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/monitoring/logger';

export interface RequestContext {
  requestId: string;
  startTime: number;
  path: string;
  method: string;
  userAgent?: string;
}

export function createRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function withRequestLogging(
  handler: (req: NextRequest, context: RequestContext) => Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const context: RequestContext = {
      requestId: createRequestId(),
      startTime: Date.now(),
      path: req.nextUrl.pathname,
      method: req.method,
      userAgent: req.headers.get('user-agent') || undefined,
    };

    // Log request
    logger.info('Incoming request', {
      requestId: context.requestId,
      method: context.method,
      path: context.path,
      userAgent: context.userAgent,
    });

    try {
      const response = await handler(req, context);
      
      // Log response
      const duration = Date.now() - context.startTime;
      logger.info('Request completed', {
        requestId: context.requestId,
        status: response.status,
        duration: `${duration}ms`,
      });

      // Add request ID to response headers
      response.headers.set('X-Request-Id', context.requestId);
      response.headers.set('X-Response-Time', `${duration}ms`);

      return response;
    } catch (error) {
      const duration = Date.now() - context.startTime;
      logger.error('Request failed', error as Error, {
        requestId: context.requestId,
        duration: `${duration}ms`,
      });
      throw error;
    }
  };
}

export function withCORS(
  handler: (req: NextRequest) => Promise<NextResponse>,
  options: {
    origin?: string | string[];
    methods?: string[];
    credentials?: boolean;
  } = {}
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const origin = req.headers.get('origin') || '';
    const allowedOrigins = Array.isArray(options.origin)
      ? options.origin
      : [options.origin || '*'];
    
    const response = await handler(req);

    // Add CORS headers
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin || '*');
    }

    if (options.methods) {
      response.headers.set('Access-Control-Allow-Methods', options.methods.join(', '));
    }

    if (options.credentials) {
      response.headers.set('Access-Control-Allow-Credentials', 'true');
    }

    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    return response;
  };
}
