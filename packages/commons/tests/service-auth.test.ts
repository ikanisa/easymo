import { describe, expect, beforeEach, it, vi } from "vitest";
import type { RequestHandler } from "express";
import {
  buildAuthHeaders,
  expressRequestContext,
  expressServiceAuth,
  ServiceAuthError,
  signServiceJwt,
  verifyServiceJwt,
} from "../src/service-auth";

const mockRedisStore = new Map<string, { count: number; expiresAt: number }>();

vi.mock("ioredis", () => {
  return {
    default: class MockRedis {
      private connected = false;

      constructor(public readonly _url: string, public readonly _opts: unknown) {}

      async connect() {
        this.connected = true;
      }

      async incr(key: string) {
        if (!this.connected) throw new Error("redis not connected");
        const entry = mockRedisStore.get(key);
        const now = Date.now();
        if (!entry || entry.expiresAt <= now) {
          mockRedisStore.set(key, { count: 1, expiresAt: now });
          return 1;
        }
        entry.count += 1;
        return entry.count;
      }

      async expire(key: string, seconds: number) {
        const entry = mockRedisStore.get(key);
        const expiresAt = Date.now() + seconds * 1000;
        if (entry) {
          entry.expiresAt = expiresAt;
        } else {
          mockRedisStore.set(key, { count: 0, expiresAt });
        }
        return true;
      }

      async ttl(key: string) {
        const entry = mockRedisStore.get(key);
        if (!entry) return -1;
        const remaining = Math.ceil((entry.expiresAt - Date.now()) / 1000);
        return remaining > 0 ? remaining : -1;
      }

      async quit() {
        this.connected = false;
      }
    },
  };
});

describe("service-auth", () => {
  beforeEach(() => {
    mockRedisStore.clear();
    process.env.SERVICE_JWT_KEYS = "unit-secret";
    process.env.SERVICE_JWT_ISSUER = "unit-test-suite";
    process.env.SERVICE_NAME = "unit-service";
  });

  it("signs and verifies tokens with scopes", async () => {
    const token = await signServiceJwt({
      audience: "example-audience",
      scope: ["alpha", "beta"],
      subject: "svc:demo",
      expiresInSeconds: 120,
    });

    const verified = await verifyServiceJwt(token, {
      audience: "example-audience",
      requiredScopes: ["alpha"],
    });

    expect(verified.payload.sub).toBe("svc:demo");
    expect(verified.scopes).toEqual(expect.arrayContaining(["alpha", "beta"]));
  });

  it("rejects tokens missing scopes", async () => {
    const token = await signServiceJwt({
      audience: "example-audience",
      scope: ["alpha"],
    });

    await expect(
      verifyServiceJwt(token, { audience: "example-audience", requiredScopes: ["beta"] }),
    ).rejects.toBeInstanceOf(ServiceAuthError);
  });

  it("buildAuthHeaders issues Authorization bearer token", async () => {
    const headers = await buildAuthHeaders({
      audience: "svc-upstream",
      scope: ["alpha"],
      requestId: "req-123",
    });

    expect(headers.Authorization).toMatch(/^Bearer /);
    expect(headers["X-Service-Name"]).toBe("unit-service");
    expect(headers["X-Request-ID"]).toBe("req-123");
    expect(headers.Authorization.split(" ")[1]).toBeTruthy();
  });

  it("express middleware authenticates valid requests", async () => {
    const token = await signServiceJwt({
      audience: "svc-downstream",
      scope: ["svc:read"],
    });
    const req: any = {
      headers: {
        authorization: `Bearer ${token}`,
        "x-request-id": "req-abc",
        "x-service-name": "unit-client",
      },
      ip: "127.0.0.1",
    };
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const res: any = { status, locals: {} };
    const next = vi.fn();

    const middleware = expressServiceAuth({
      audience: "svc-downstream",
      requiredScopes: ["svc:read"],
    });

    await middleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.serviceAuth?.serviceName).toBe("unit-client");
    expect(res.locals.serviceAuth?.payload).toBeDefined();
  });

  it("express middleware rejects missing request id", async () => {
    const token = await signServiceJwt({
      audience: "svc-downstream",
    });
    const req: any = {
      headers: {
        authorization: `Bearer ${token}`,
      },
    };
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const res: any = { status, locals: {} };
    const next = vi.fn();

    const middleware = expressServiceAuth({
      audience: "svc-downstream",
    });

    await middleware(req, res, next);
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "invalid_request" }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("expressRequestContext generates request id when allowed", async () => {
    const req: any = { headers: {} };
    const res: any = { setHeader: vi.fn(), locals: {} };
    const next = vi.fn();
    const middleware = expressRequestContext({ generateIfMissing: true });
    await (middleware as RequestHandler)(req, res, next);
    expect(req.requestId).toBeDefined();
    expect(next).toHaveBeenCalledTimes(1);
  });
});
