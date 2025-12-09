import type { Request, RequestHandler } from "express";
import Redis from "ioredis";
import { type JWTPayload } from "jose";
import type { Logger } from "pino";
export type Scope = string;
export interface ServiceJwtClaims extends JWTPayload {
    scope?: string | string[];
    [key: string]: unknown;
}
export interface SignServiceJwtOptions {
    audience: string | string[];
    scope?: Scope[];
    subject?: string;
    expiresInSeconds?: number;
    additionalClaims?: Record<string, unknown>;
    issuer?: string;
    jwtId?: string;
}
export interface VerifyServiceJwtOptions {
    audience?: string | string[];
    requiredScopes?: Scope[];
    leewaySeconds?: number;
    issuer?: string;
}
export interface VerifiedServiceToken {
    token: string;
    payload: ServiceJwtClaims;
    scopes: Scope[];
}
export declare class ServiceAuthError extends Error {
    readonly code: "missing_token" | "invalid_token" | "invalid_scope" | "invalid_request";
    readonly status: number;
    constructor(code: "missing_token" | "invalid_token" | "invalid_scope" | "invalid_request", status: number, message?: string);
}
export declare function signServiceJwt(options: SignServiceJwtOptions): Promise<string>;
export declare function verifyServiceJwt(token: string, options?: VerifyServiceJwtOptions): Promise<VerifiedServiceToken>;
export interface BuildAuthHeadersOptions extends SignServiceJwtOptions {
    requestId?: string;
    extraHeaders?: Record<string, string>;
    service?: string;
}
export declare function buildAuthHeaders(options: BuildAuthHeadersOptions): Promise<Record<string, string>>;
export interface ExpressServiceAuthOptions extends VerifyServiceJwtOptions {
    scopeHeaderName?: string;
    attachProperty?: string;
    requestIdHeader?: string;
}
export interface ServiceAuthContext extends VerifiedServiceToken {
    serviceName?: string;
}
declare module "express-serve-static-core" {
    interface Request {
        serviceAuth?: ServiceAuthContext;
        requestId?: string;
    }
}
export declare function expressRequestContext(options?: {
    requestIdHeader?: string;
    generateIfMissing?: boolean;
}): RequestHandler;
export declare function expressServiceAuth(options?: ExpressServiceAuthOptions): RequestHandler;
export interface RateLimiterOptions {
    redisUrl: string;
    points: number;
    durationSeconds: number;
    keyPrefix?: string;
    headerName?: string;
    keyGenerator?: (req: Request) => string | null | undefined;
    logger?: Logger;
    failOpen?: boolean;
}
export declare function createRateLimiter(options: RateLimiterOptions): RequestHandler;
export declare function closeRateLimiter(redis: Redis): Promise<void>;
//# sourceMappingURL=service-auth.d.ts.map