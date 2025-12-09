import cors, { CorsOptions } from 'cors';
/**
 * CORS configuration presets for different environments
 */
export declare const corsPresets: {
    /**
     * Development: Allow all origins
     */
    development: CorsOptions;
    /**
     * Production: Strict origin checking
     */
    production: (allowedOrigins: string[]) => CorsOptions;
    /**
     * Internal services: Very strict (only other services)
     */
    internal: CorsOptions;
    /**
     * Public API: Lenient but controlled
     */
    publicApi: (allowedOrigins: string[]) => CorsOptions;
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
export declare function createCorsMiddleware(options?: {
    /** Allowed origins (for production) */
    allowedOrigins?: string[];
    /** CORS preset to use */
    preset?: 'development' | 'production' | 'internal' | 'publicApi';
    /** Custom CORS options */
    custom?: CorsOptions;
}): (req: cors.CorsRequest, res: {
    statusCode?: number | undefined;
    setHeader(key: string, value: string): any;
    end(): any;
}, next: (err?: any) => any) => void;
/**
 * CORS error handler middleware
 */
export declare function corsErrorHandler(): (err: any, req: any, res: any, next: any) => any;
//# sourceMappingURL=cors-config.d.ts.map