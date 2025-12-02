/**
 * Security Middleware Layer
 * Provides comprehensive security controls for all microservices
 */

import { logStructuredEvent } from "../observability.ts";

// ============================================================================
// TYPES
// ============================================================================

export type SecurityConfig = {
  /** Maximum request body size in bytes (default: 1MB) */
  maxBodySize: number;
  /** Allowed content types */
  allowedContentTypes: string[];
  /** Enable request ID tracking */
  enableRequestTracking: boolean;
  /** Enable audit logging */
  enableAuditLogging: boolean;
  /** Rate limit configuration */
  rateLimit: {
    enabled: boolean;
    limit: number;
    windowSeconds: number;
  };
  /** Signature verification */
  signature: {
    required: boolean;
    allowBypass: boolean;
    allowInternalForward: boolean;
  };
};

export type SecurityContext = {
  requestId: string;
  correlationId: string;
  clientIp: string | null;
  userAgent: string | null;
  timestamp: Date;
  service: string;
};

export type SecurityCheckResult = {
  passed: boolean;
  response?: Response;
  context: SecurityContext;
  warnings: string[];
};

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  maxBodySize: 1024 * 1024, // 1MB
  allowedContentTypes: [
    "application/json",
    "application/x-www-form-urlencoded",
    "multipart/form-data",
  ],
  enableRequestTracking: true,
  enableAuditLogging: true,
  rateLimit: {
    enabled: true,
    limit: 100,
    windowSeconds: 60,
  },
  signature: {
    required: true,
    allowBypass: false,
    allowInternalForward: false,
  },
};

// ============================================================================
// SECURITY MIDDLEWARE CLASS
// ============================================================================

export class SecurityMiddleware {
  private config: SecurityConfig;
  private serviceName: string;

  constructor(serviceName: string, config: Partial<SecurityConfig> = {}) {
    this.serviceName = serviceName;
    this.config = { ...DEFAULT_SECURITY_CONFIG, ...config };
    
    // Override with environment variables
    this.config.signature.allowBypass = 
      (Deno.env.get("WA_ALLOW_UNSIGNED_WEBHOOKS") ?? "false").toLowerCase() === "true";
    this.config.signature.allowInternalForward = 
      (Deno.env.get("WA_ALLOW_INTERNAL_FORWARD") ?? "false").toLowerCase() === "true";
  }

  /**
   * Run all security checks on incoming request
   */
  async check(req: Request): Promise<SecurityCheckResult> {
    const warnings: string[] = [];
    const context = this.buildContext(req);

    // 1. Content-Type Validation
    const contentTypeCheck = this.validateContentType(req);
    if (!contentTypeCheck.passed) {
      return { ...contentTypeCheck, context, warnings };
    }

    // 2. Request Body Size Check
    const bodySizeCheck = await this.validateBodySize(req);
    if (!bodySizeCheck.passed) {
      return { ...bodySizeCheck, context, warnings };
    }

    // 3. Rate Limiting
    if (this.config.rateLimit.enabled) {
      const rateLimitCheck = await this.checkRateLimit(req, context);
      if (!rateLimitCheck.passed) {
        return { ...rateLimitCheck, context, warnings };
      }
    }

    // Log security check passed
    if (this.config.enableAuditLogging) {
      await this.auditLog("SECURITY_CHECK_PASSED", context, {});
    }

    return {
      passed: true,
      context,
      warnings,
    };
  }

  /**
   * Build security context from request
   */
  private buildContext(req: Request): SecurityContext {
    const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
    const correlationId = req.headers.get("x-correlation-id") ?? requestId;
    
    return {
      requestId,
      correlationId,
      clientIp: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? 
                req.headers.get("x-real-ip") ?? null,
      userAgent: req.headers.get("user-agent"),
      timestamp: new Date(),
      service: this.serviceName,
    };
  }

  /**
   * Validate Content-Type header
   */
  private validateContentType(req: Request): { passed: boolean; response?: Response } {
    // Skip for GET, HEAD, OPTIONS
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      return { passed: true };
    }

    const contentType = req.headers.get("content-type");
    if (!contentType) {
      // Allow requests without content-type for webhooks
      return { passed: true };
    }

    const isAllowed = this.config.allowedContentTypes.some(
      (allowed) => contentType.toLowerCase().startsWith(allowed.toLowerCase())
    );

    if (!isAllowed) {
      logStructuredEvent("SECURITY_INVALID_CONTENT_TYPE", {
        service: this.serviceName,
        contentType,
        allowed: this.config.allowedContentTypes,
      }, "warn");

      return {
        passed: false,
        response: new Response(
          JSON.stringify({ 
            error: "unsupported_media_type",
            message: "Content-Type not supported",
          }),
          { 
            status: 415,
            headers: { "Content-Type": "application/json" },
          }
        ),
      };
    }

    return { passed: true };
  }

  /**
   * Validate request body size
   */
  private async validateBodySize(req: Request): Promise<{ passed: boolean; response?: Response }> {
    // Skip for GET, HEAD, OPTIONS
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      return { passed: true };
    }

    const contentLength = req.headers.get("content-length");
    if (contentLength) {
      const size = parseInt(contentLength, 10);
      if (size > this.config.maxBodySize) {
        logStructuredEvent("SECURITY_BODY_TOO_LARGE", {
          service: this.serviceName,
          size,
          maxSize: this.config.maxBodySize,
        }, "warn");

        return {
          passed: false,
          response: new Response(
            JSON.stringify({
              error: "payload_too_large",
              message: `Request body exceeds maximum size of ${this.config.maxBodySize} bytes`,
              maxSize: this.config.maxBodySize,
            }),
            {
              status: 413,
              headers: { "Content-Type": "application/json" },
            }
          ),
        };
      }
    }

    return { passed: true };
  }

  /**
   * Check rate limiting
   */
  private async checkRateLimit(
    req: Request, 
    context: SecurityContext
  ): Promise<{ passed: boolean; response?: Response }> {
    // Import rate limit middleware
    const { rateLimitMiddleware } = await import("../rate-limit/index.ts");
    
    const result = await rateLimitMiddleware(req, {
      limit: this.config.rateLimit.limit,
      windowSeconds: this.config.rateLimit.windowSeconds,
    });

    if (!result.allowed) {
      logStructuredEvent("SECURITY_RATE_LIMITED", {
        service: this.serviceName,
        requestId: context.requestId,
        clientIp: context.clientIp,
      }, "warn");

      return {
        passed: false,
        response: result.response!,
      };
    }

    return { passed: true };
  }

  /**
   * Audit logging for security events
   */
  async auditLog(
    event: string,
    context: SecurityContext,
    details: Record<string, unknown>
  ): Promise<void> {
    if (!this.config.enableAuditLogging) return;

    logStructuredEvent(event, {
      service: this.serviceName,
      requestId: context.requestId,
      correlationId: context.correlationId,
      clientIp: context.clientIp,
      timestamp: context.timestamp.toISOString(),
      ...details,
    });
  }

  /**
   * Create response with security headers
   */
  createResponse(
    body: unknown,
    context: SecurityContext,
    init: ResponseInit = {}
  ): Response {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    headers.set("X-Request-ID", context.requestId);
    headers.set("X-Correlation-ID", context.correlationId);
    headers.set("X-Service", this.serviceName);
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("X-Frame-Options", "DENY");
    headers.set("Cache-Control", "no-store");

    return new Response(JSON.stringify(body), { ...init, headers });
  }
}

/**
 * Factory function to create security middleware
 */
export function createSecurityMiddleware(
  serviceName: string,
  config?: Partial<SecurityConfig>
): SecurityMiddleware {
  return new SecurityMiddleware(serviceName, config);
}
