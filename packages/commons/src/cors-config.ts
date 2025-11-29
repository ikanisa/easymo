import cors, { CorsOptions } from 'cors';
import { childLogger } from './logger';

const log = childLogger({ service: 'cors' });

/**
 * CORS configuration presets for different environments
 */
export const corsPresets = {
  /**
   * Development: Allow all origins
   */
  development: {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    exposedHeaders: ['X-Request-ID', 'X-Rate-Limit-Remaining'],
    maxAge: 86400, // 24 hours
  } as CorsOptions,

  /**
   * Production: Strict origin checking
   */
  production: (allowedOrigins: string[]) => ({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, Postman, curl)
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        callback(null, true);
      } else {
        log.warn({ origin, allowedOrigins }, 'CORS: Origin not allowed');
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    exposedHeaders: ['X-Request-ID', 'X-Rate-Limit-Remaining'],
    maxAge: 86400,
  } as CorsOptions),

  /**
   * Internal services: Very strict (only other services)
   */
  internal: {
    origin: false, // No browser access
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Service-Auth'],
    maxAge: 3600,
  } as CorsOptions,

  /**
   * Public API: Lenient but controlled
   */
  publicApi: (allowedOrigins: string[]) => ({
    origin: allowedOrigins.includes('*') ? true : allowedOrigins,
    credentials: false, // Public APIs shouldn't use credentials
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'X-API-Key'],
    exposedHeaders: ['X-Rate-Limit-Remaining', 'X-Rate-Limit-Reset'],
    maxAge: 86400,
  } as CorsOptions),
};

/**
 * Create CORS middleware with automatic environment detection
 * 
 * @example
 * ```typescript
 * import { createCorsMiddleware } from '@easymo/commons';
 * 
 * // Auto-detect from NODE_ENV
 * app.use(createCorsMiddleware());
 * 
 * // Explicit origins
 * app.use(createCorsMiddleware({
 *   allowedOrigins: ['https://easymo.app', 'https://admin.easymo.app'],
 * }));
 * 
 * // Custom preset
 * app.use(createCorsMiddleware({ preset: 'internal' }));
 * ```
 */
export function createCorsMiddleware(options?: {
  /** Allowed origins (for production) */
  allowedOrigins?: string[];
  /** CORS preset to use */
  preset?: 'development' | 'production' | 'internal' | 'publicApi';
  /** Custom CORS options */
  custom?: CorsOptions;
}) {
  const env = process.env.NODE_ENV || 'development';
  
  // If custom options provided, use them
  if (options?.custom) {
    log.info({ options: options.custom }, 'CORS: Using custom configuration');
    return cors(options.custom);
  }

  // If preset specified, use it
  if (options?.preset) {
    const preset = options.preset;
    
    if (preset === 'production' || preset === 'publicApi') {
      const origins = options.allowedOrigins || 
                      (process.env.CORS_ORIGINS?.split(',').map(s => s.trim())) ||
                      [];
      
      if (origins.length === 0) {
        log.warn('CORS: No allowed origins specified for production/publicApi preset');
      }
      
      const config = corsPresets[preset](origins);
      log.info({ preset, origins }, 'CORS: Using preset configuration');
      return cors(config);
    } else {
      log.info({ preset }, 'CORS: Using preset configuration');
      return cors(corsPresets[preset]);
    }
  }

  // Auto-detect based on environment
  if (env === 'production') {
    const origins = options?.allowedOrigins || 
                    (process.env.CORS_ORIGINS?.split(',').map(s => s.trim())) ||
                    [];
    
    if (origins.length === 0) {
      log.error('CORS: No allowed origins for production! Set CORS_ORIGINS environment variable.');
      // Fallback to development for safety (will log warnings)
      return cors(corsPresets.development);
    }

    log.info({ origins }, 'CORS: Production mode with allowed origins');
    return cors(corsPresets.production(origins));
  } else {
    log.info({ env }, 'CORS: Development mode - all origins allowed');
    return cors(corsPresets.development);
  }
}

/**
 * CORS error handler middleware
 */
export function corsErrorHandler() {
  return (err: any, req: any, res: any, next: any) => {
    if (err.message === 'Not allowed by CORS') {
      log.warn(
        { 
          origin: req.headers.origin,
          method: req.method,
          path: req.path,
        },
        'CORS error: Origin not allowed'
      );
      
      return res.status(403).json({
        error: 'CORS policy violation',
        message: 'Origin not allowed',
      });
    }
    
    next(err);
  };
}
