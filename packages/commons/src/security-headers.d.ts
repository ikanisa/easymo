import { HelmetOptions } from 'helmet';
/**
 * Security header presets for different environments
 */
export declare const securityHeaderPresets: {
    /**
     * Development: Relaxed for easier debugging
     */
    development: HelmetOptions;
    /**
     * Production: Strict security headers
     */
    production: HelmetOptions;
    /**
     * API: Security headers optimized for API services
     */
    api: HelmetOptions;
    /**
     * Internal: Minimal headers for service-to-service
     */
    internal: HelmetOptions;
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
export declare function createSecurityHeaders(options?: {
    /** Security preset to use */
    preset?: 'development' | 'production' | 'api' | 'internal';
    /** Custom helmet options */
    custom?: HelmetOptions;
    /** Additional CSP directives */
    additionalCspDirectives?: Record<string, string[]>;
}): (req: import("http").IncomingMessage, res: import("http").ServerResponse, next: (err?: unknown) => void) => void;
/**
 * Create custom CSP directives for specific services
 */
export declare const cspDirectives: {
    /**
     * Allow connections to Supabase
     */
    supabase: (supabaseUrl: string) => {
        connectSrc: string[];
        imgSrc: string[];
    };
    /**
     * Allow Sentry error reporting
     */
    sentry: (sentryDsn: string) => {
        connectSrc: string[];
    };
    /**
     * Allow Google Analytics
     */
    googleAnalytics: {
        scriptSrc: string[];
        connectSrc: string[];
        imgSrc: string[];
    };
    /**
     * Allow Stripe
     */
    stripe: {
        scriptSrc: string[];
        connectSrc: string[];
        frameSrc: string[];
    };
};
//# sourceMappingURL=security-headers.d.ts.map