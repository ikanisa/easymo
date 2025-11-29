import helmet, { HelmetOptions } from 'helmet';
import { childLogger } from './logger';

const log = childLogger({ service: 'security-headers' });

/**
 * Security header presets for different environments
 */
export const securityHeaderPresets = {
  /**
   * Development: Relaxed for easier debugging
   */
  development: {
    contentSecurityPolicy: false, // Disable CSP in dev for hot reload
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  } as HelmetOptions,

  /**
   * Production: Strict security headers
   */
  production: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // Many frameworks need unsafe-inline
        imgSrc: ["'self'", 'data:', 'https:'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true,
  } as HelmetOptions,

  /**
   * API: Security headers optimized for API services
   */
  api: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"], // APIs don't serve HTML
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
    },
    ieNoOpen: true,
    noSniff: true,
    referrerPolicy: { policy: 'no-referrer' },
    xssFilter: true,
  } as HelmetOptions,

  /**
   * Internal: Minimal headers for service-to-service
   */
  internal: {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    hidePoweredBy: true,
    noSniff: true,
  } as HelmetOptions,
};

/**
 * Create security headers middleware (Helmet)
 * 
 * @example
 * ```typescript
 * import { createSecurityHeaders } from '@easymo/commons';
 * 
 * // Auto-detect from NODE_ENV
 * app.use(createSecurityHeaders());
 * 
 * // Explicit preset
 * app.use(createSecurityHeaders({ preset: 'api' }));
 * 
 * // Custom configuration
 * app.use(createSecurityHeaders({
 *   custom: {
 *     contentSecurityPolicy: {
 *       directives: {
 *         defaultSrc: ["'self'"],
 *         scriptSrc: ["'self'", "'unsafe-inline'"],
 *       },
 *     },
 *   },
 * }));
 * ```
 */
export function createSecurityHeaders(options?: {
  /** Security preset to use */
  preset?: 'development' | 'production' | 'api' | 'internal';
  /** Custom helmet options */
  custom?: HelmetOptions;
  /** Additional CSP directives */
  additionalCspDirectives?: Record<string, string[]>;
}) {
  const env = process.env.NODE_ENV || 'development';

  // If custom options provided, use them
  if (options?.custom) {
    log.info('Security headers: Using custom configuration');
    return helmet(options.custom);
  }

  // Determine preset
  let preset = options?.preset;
  if (!preset) {
    preset = env === 'production' ? 'production' : 'development';
  }

  let config = { ...securityHeaderPresets[preset] };

  // Merge additional CSP directives if provided
  if (options?.additionalCspDirectives && config.contentSecurityPolicy) {
    const existingDirectives = 
      typeof config.contentSecurityPolicy === 'object' 
        ? config.contentSecurityPolicy.directives || {}
        : {};

    config.contentSecurityPolicy = {
      directives: {
        ...existingDirectives,
        ...options.additionalCspDirectives,
      },
    };
  }

  log.info({ preset, env }, 'Security headers: Initialized');
  return helmet(config);
}

/**
 * Create custom CSP directives for specific services
 */
export const cspDirectives = {
  /**
   * Allow connections to Supabase
   */
  supabase: (supabaseUrl: string) => ({
    connectSrc: ["'self'", supabaseUrl],
    imgSrc: ["'self'", 'data:', supabaseUrl],
  }),

  /**
   * Allow Sentry error reporting
   */
  sentry: (sentryDsn: string) => {
    const sentryUrl = new URL(sentryDsn).origin;
    return {
      connectSrc: ["'self'", sentryUrl],
    };
  },

  /**
   * Allow Google Analytics
   */
  googleAnalytics: {
    scriptSrc: ["'self'", 'https://www.googletagmanager.com'],
    connectSrc: ["'self'", 'https://www.google-analytics.com'],
    imgSrc: ["'self'", 'https://www.google-analytics.com'],
  },

  /**
   * Allow Stripe
   */
  stripe: {
    scriptSrc: ["'self'", 'https://js.stripe.com'],
    connectSrc: ["'self'", 'https://api.stripe.com'],
    frameSrc: ["'self'", 'https://js.stripe.com'],
  },
};
