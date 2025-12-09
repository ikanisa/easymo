import { NextFunction, Request, Response } from "express";
/**
 * Configuration for rate limiting
 */
export interface RateLimitOptions {
    /** Time window in milliseconds */
    windowMs: number;
    /** Maximum number of requests per window */
    max: number;
    /** Custom message to send when rate limit is exceeded */
    message?: string;
    /** Function to generate a key for rate limiting (default: IP address) */
    keyGenerator?: (req: Request) => string;
    /** Skip rate limiting for certain requests */
    skip?: (req: Request) => boolean;
    /** Handler called when rate limit is exceeded */
    handler?: (req: Request, res: Response) => void;
}
/**
 * Create a rate limiting middleware
 *
 * @example
 * ```typescript
 * import { rateLimit } from "@easymo/commons";
 *
 * // Apply to all routes
 * app.use(rateLimit({
 *   windowMs: 15 * 60 * 1000, // 15 minutes
 *   max: 100 // limit each IP to 100 requests per windowMs
 * }));
 *
 * // Apply to specific route
 * app.post("/api/transfer",
 *   rateLimit({ windowMs: 60000, max: 10 }),
 *   transferHandler
 * );
 *
 * // Custom key generator (by user ID)
 * app.use(rateLimit({
 *   windowMs: 60000,
 *   max: 20,
 *   keyGenerator: (req) => req.user?.id || req.ip
 * }));
 * ```
 */
export declare function rateLimit(options: RateLimitOptions): (req: Request, res: Response, next: NextFunction) => void;
/**
 * Create a rate limiter that tracks by user ID
 * Requires authentication middleware to be applied first
 */
export declare function rateLimitByUser(options: Omit<RateLimitOptions, "keyGenerator">): (req: Request, res: Response, next: NextFunction) => void;
/**
 * Create a strict rate limiter for sensitive operations
 * Very low limits for operations like password reset, OTP generation, etc.
 */
export declare function strictRateLimit(options?: Partial<RateLimitOptions>): (req: Request, res: Response, next: NextFunction) => void;
/**
 * Reset rate limit for a specific key
 * Useful for testing or manual intervention
 */
export declare function resetRateLimit(key: string): void;
//# sourceMappingURL=rate-limit.d.ts.map