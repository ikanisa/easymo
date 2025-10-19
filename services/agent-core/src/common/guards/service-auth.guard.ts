import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { jwtVerify } from "jose";
import { createPublicKey } from "crypto";
import { z } from "zod";
import { AGENT_PERMISSIONS, AgentContext, AgentPermission } from "@easymo/commons";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator.js";
import type { AgentRequest } from "../types.js";

const AGENT_KIND_VALUES = ["broker", "support", "sales", "marketing"] as const;

const PERMISSION_VALUES = AGENT_PERMISSIONS as readonly [AgentPermission, ...AgentPermission[]];

const claimsSchema = z.object({
  sub: z.string().min(1),
  tenantId: z.string().uuid(),
  agentConfigId: z.string().uuid(),
  agentKind: z.enum(AGENT_KIND_VALUES),
  permissions: z.array(z.enum(PERMISSION_VALUES)).default([]),
  sessionId: z.string().uuid().optional(),
});

let cachedPublicKey: ReturnType<typeof createPublicKey> | null = null;

const getPublicKey = () => {
  if (cachedPublicKey) return cachedPublicKey;
  const raw = process.env.JWT_PUBLIC_KEY;
  if (!raw || !raw.trim()) {
    throw new UnauthorizedException("Agent JWT public key not configured");
  }
  const normalised = raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw;
  cachedPublicKey = createPublicKey(normalised);
  return cachedPublicKey;
};

@Injectable()
export class ServiceAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AgentRequest>();
    const token = request.headers["x-agent-jwt"];
    if (!token || typeof token !== "string") {
      throw new UnauthorizedException("Missing agent JWT");
    }

    const internalToken = process.env.AGENT_INTERNAL_TOKEN;
    if (internalToken && token === internalToken) {
      request.agent = {
        agentId: "internal-admin",
        tenantId: process.env.AGENT_INTERNAL_TENANT_ID ?? "00000000-0000-0000-0000-000000000000",
        agentConfigId: "internal-config",
        agentKind: "support",
        permissions: new Set(AGENT_PERMISSIONS as AgentPermission[]),
        token,
      };
      return true;
    }

    const agent = await this.verifyToken(token);
    request.agent = agent;

    const requiredPermissions = this.reflector.getAllAndOverride<AgentPermission[] | undefined>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    ) ?? [];

    for (const permission of requiredPermissions) {
      if (!agent.permissions.has(permission)) {
        throw new ForbiddenException(`Missing permission: ${permission}`);
      }
    }

    return true;
  }

  private async verifyToken(token: string): Promise<AgentContext> {
    try {
      const { payload } = await jwtVerify(token, getPublicKey(), {
        algorithms: ["RS256"],
      });

      const claims = claimsSchema.parse(payload);

      return {
        agentId: claims.sub,
        tenantId: claims.tenantId,
        agentConfigId: claims.agentConfigId,
        agentKind: claims.agentKind,
        permissions: new Set(claims.permissions),
        token,
        sessionId: claims.sessionId,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new UnauthorizedException("Invalid agent token");
    }
  }
}
