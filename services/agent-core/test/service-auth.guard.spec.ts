import type { AgentPermission } from "@easymo/commons";
import type { ExecutionContext } from "@nestjs/common";
import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { generateKeyPairSync } from "crypto";
import { SignJWT } from "jose";
import { afterEach,beforeEach, describe, expect, it, vi } from 'vitest';

import { ServiceAuthGuard } from "../src/common/guards/service-auth.guard";

const TENANT_ID = "a4a8cf2d-0a4f-446c-8bf2-28509641158f";
const CONFIG_ID = "26db67d6-e0dd-49aa-bf19-31d3de42b5ca";

type ReflectorStubOptions = {
  permissions?: AgentPermission[];
};

class ReflectorStub {
  constructor(private readonly options: ReflectorStubOptions = {}) {}

  getAllAndOverride<T>() {
    return (this.options.permissions ?? []) as unknown as T;
  }
}

const createExecutionContext = (request: any): ExecutionContext => ({
  switchToHttp: () => ({
    getRequest: () => request,
  }),
  getHandler: () => ({}),
  getClass: () => ({}),
} as ExecutionContext);

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicKeyPem = publicKey.export({ format: "pem", type: "spki" }).toString();
process.env.JWT_PUBLIC_KEY = publicKeyPem;

const signToken = async (permissions: AgentPermission[]) => {
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({
    sub: "agent-test",
    tenantId: TENANT_ID,
    agentConfigId: CONFIG_ID,
    agentKind: "support",
    permissions,
  })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + 60)
    .sign(privateKey);
};

describe("ServiceAuthGuard", () => {
  it("attaches agent context when permissions allow access", async () => {
    const token = await signToken(["lead.read"]);
    const request: Record<string, any> = {
      headers: { "x-agent-jwt": token },
    };

    const guard = new ServiceAuthGuard(new ReflectorStub({ permissions: ["lead.read"] }) as any);
    const canActivate = await guard.canActivate(createExecutionContext(request));

    expect(canActivate).toBe(true);
    expect(request.agent.agentId).toBe("agent-test");
    expect(request.agent.tenantId).toBe(TENANT_ID);
    expect(Array.from(request.agent.permissions)).toEqual(["lead.read"]);
  });

  it("rejects when permission is missing", async () => {
    const token = await signToken(["lead.read"]);
    const request = { headers: { "x-agent-jwt": token } };
    const guard = new ServiceAuthGuard(new ReflectorStub({ permissions: ["call.write"] }) as any);

    await expect(guard.canActivate(createExecutionContext(request))).rejects.toThrow(ForbiddenException);
  });

  it("rejects when token header is absent", async () => {
    const request = { headers: {} };
    const guard = new ServiceAuthGuard(new ReflectorStub() as any);

    await expect(guard.canActivate(createExecutionContext(request))).rejects.toThrow(UnauthorizedException);
  });
});
