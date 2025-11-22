import { randomUUID } from "node:crypto";

import type { Request,RequestHandler } from "express";
import Redis from "ioredis";
import { type JWTPayload,jwtVerify, SignJWT } from "jose";
import type { Logger } from "pino";

const textEncoder = new TextEncoder();

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

export class ServiceAuthError extends Error {
  constructor(
    readonly code: "missing_token" | "invalid_token" | "invalid_scope" | "invalid_request",
    readonly status: number,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "ServiceAuthError";
  }
}

function parseKeysFromEnv(): string[] {
  const env = process.env.SERVICE_JWT_KEYS ?? process.env.SERVICE_JWT_SECRET ?? "";
  const keys = env
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (keys.length === 0) {
    throw new Error("SERVICE_JWT_KEYS (comma separated) must be configured for service authentication.");
  }
  return keys;
}

function normaliseAudience(input: string | string[] | undefined): string[] | undefined {
  if (!input) return undefined;
  return Array.isArray(input) ? input : [input];
}

function extractScopes(scope?: string | string[]): Scope[] {
  if (!scope) return [];
  if (Array.isArray(scope)) return scope.filter(Boolean);
  return scope
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function issuerFromEnv(): string {
  return (process.env.SERVICE_JWT_ISSUER ?? "easymo-services").trim();
}

function serviceName(): string {
  return process.env.SERVICE_NAME ?? "unknown-service";
}

export async function signServiceJwt(options: SignServiceJwtOptions): Promise<string> {
  const keys = parseKeysFromEnv();
  const signingKey = keys[0];
  if (!signingKey) {
    throw new Error("No signing key available for service JWTs.");
  }

  const issuer = options.issuer ?? issuerFromEnv();
  const expires = options.expiresInSeconds ?? 60;
  const scopeClaim = options.scope && options.scope.length > 0 ? options.scope.join(" ") : undefined;
  const payload: ServiceJwtClaims = {
    scope: scopeClaim,
    ...options.additionalClaims,
  };
  if (options.subject) payload.sub = options.subject;

  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(issuer)
    .setAudience(options.audience)
    .setIssuedAt()
    .setExpirationTime(`${expires}s`)
    .setJti(options.jwtId ?? randomUUID())
    .sign(textEncoder.encode(signingKey));
}

export async function verifyServiceJwt(token: string, options: VerifyServiceJwtOptions = {}): Promise<VerifiedServiceToken> {
  const keys = parseKeysFromEnv();
  const issuer = options.issuer ?? issuerFromEnv();
  const audiences = normaliseAudience(options.audience);
  const tolerance = options.leewaySeconds ?? 60;
  let lastError: unknown;

  for (const key of keys) {
    try {
      const { payload } = await jwtVerify<ServiceJwtClaims>(token, textEncoder.encode(key), {
        issuer,
        audience: audiences,
        clockTolerance: tolerance,
      });

      const scopes = extractScopes(payload.scope);
      if (options.requiredScopes && options.requiredScopes.length > 0) {
        const missing = options.requiredScopes.filter((scope) => !scopes.includes(scope));
        if (missing.length > 0) {
          throw new ServiceAuthError("invalid_scope", 403, `Missing required scopes: ${missing.join(", ")}`);
        }
      }

      return { token, payload, scopes };
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof ServiceAuthError) {
    throw lastError;
  }

  throw new ServiceAuthError("invalid_token", 401, lastError instanceof Error ? lastError.message : undefined);
}

export interface BuildAuthHeadersOptions extends SignServiceJwtOptions {
  requestId?: string;
  extraHeaders?: Record<string, string>;
  service?: string;
}

export async function buildAuthHeaders(options: BuildAuthHeadersOptions): Promise<Record<string, string>> {
  const token = await signServiceJwt(options);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "X-Service-Name": options.service ?? serviceName(),
  };
  if (options.requestId) {
    headers["X-Request-ID"] = options.requestId;
  }
  if (options.extraHeaders) {
    Object.assign(headers, options.extraHeaders);
  }
  return headers;
}

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

function extractBearerToken(header?: string | string[]): string {
  const value = Array.isArray(header) ? header[0] : header;
  if (!value) {
    throw new ServiceAuthError("missing_token", 401, "Authorization header missing.");
  }
  const [scheme, credentials] = value.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !credentials) {
    throw new ServiceAuthError("invalid_token", 401, "Authorization header must be Bearer token.");
  }
  return credentials;
}

export function expressRequestContext(options?: { requestIdHeader?: string; generateIfMissing?: boolean }): RequestHandler {
  const headerName = (options?.requestIdHeader ?? "x-request-id").toLowerCase();
  const generate = options?.generateIfMissing ?? false;
  return (req, res, next) => {
    const existing = req.headers[headerName] || req.headers[headerName as keyof typeof req.headers];
    let requestId = Array.isArray(existing) ? existing[0] : existing;
    if (!requestId) {
      if (!generate) {
        next(new ServiceAuthError("invalid_request", 400, `${headerName} header required`));
        return;
      }
      requestId = randomUUID();
      req.headers[headerName] = requestId;
      res.setHeader(headerName, requestId);
    }
    req.requestId = requestId.toString();
    res.locals.requestId = req.requestId;
    next();
  };
}

export function expressServiceAuth(options: ExpressServiceAuthOptions = {}): RequestHandler {
  const requestIdHeader = (options.requestIdHeader ?? "x-request-id").toLowerCase();

  return async (req, res, next) => {
    try {
      const requestIdHeaderValue = req.headers[requestIdHeader];
      if (!requestIdHeaderValue) {
        throw new ServiceAuthError("invalid_request", 400, `${requestIdHeader} header required`);
      }

      const token = extractBearerToken(req.headers.authorization);
      const verified = await verifyServiceJwt(token, options);
      const context: ServiceAuthContext = {
        ...verified,
        serviceName: Array.isArray(req.headers["x-service-name"])
          ? req.headers["x-service-name"]?.[0]
          : (req.headers["x-service-name"] as string | undefined),
      };

      if (options.attachProperty) {
        const target = req as unknown as Record<string, unknown>;
        target[options.attachProperty] = context;
      }
      req.serviceAuth = context;
      res.locals.serviceAuth = context;
      res.locals.requestId = Array.isArray(requestIdHeaderValue)
        ? requestIdHeaderValue[0]
        : requestIdHeaderValue;
      next();
    } catch (error) {
      const status =
        error instanceof ServiceAuthError
          ? error.status
          : 401;
      const code =
        error instanceof ServiceAuthError
          ? error.code
          : "invalid_token";
      const message = error instanceof Error ? error.message : undefined;
      res.status(status).json({ error: code, message });
    }
  };
}

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

export function createRateLimiter(options: RateLimiterOptions): RequestHandler {
  const redis = new Redis(options.redisUrl, { lazyConnect: true });
  let connected = false;

  async function ensureConnection() {
    if (!connected) {
      await redis.connect();
      connected = true;
    }
  }

  const headerName = (options.headerName ?? "x-forwarded-for").toLowerCase();
  const prefix = options.keyPrefix ?? "svc:rate";

  return async (req, res, next) => {
    try {
      await ensureConnection();
      const key =
        options.keyGenerator?.(req) ??
        (Array.isArray(req.headers[headerName]) ? req.headers[headerName]?.[0] : (req.headers[headerName] as string | undefined)) ??
        req.ip ??
        req.socket.remoteAddress ??
        "unknown";

      const redisKey = `${prefix}:${key}`;
      const count = await redis.incr(redisKey);
      if (count === 1) {
        await redis.expire(redisKey, options.durationSeconds);
      }

      const remaining = Math.max(options.points - count, 0);
      res.setHeader("X-RateLimit-Limit", options.points.toString());
      res.setHeader("X-RateLimit-Remaining", Math.max(remaining, 0).toString());

      if (count > options.points) {
        const ttl = await redis.ttl(redisKey);
        if (ttl > 0) {
          res.setHeader("Retry-After", ttl.toString());
        }
        throw new ServiceAuthError("invalid_request", 429, "Rate limit exceeded");
      }
      next();
    } catch (error) {
      if (error instanceof ServiceAuthError) {
        res.status(error.status).json({ error: error.code, message: error.message });
        return;
      }
      options.logger?.warn(
        { msg: "rateLimiter.redis_error", error: error instanceof Error ? error.message : error },
      );
      if (options.failOpen ?? true) {
        next();
        return;
      }
      res.status(503).json({ error: "invalid_request", message: "Rate limiting unavailable" });
    }
  };
}

export async function closeRateLimiter(redis: Redis) {
  try {
    await redis.quit();
  } catch {
    // no-op
  }
}
