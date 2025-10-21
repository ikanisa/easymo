import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import type { Request } from "express";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { verifyServiceJwt, ServiceAuthError } from "@easymo/commons";
import { SERVICE_SCOPES_KEY } from "../decorators/service-scopes.decorator.js";

@Injectable()
export class ServiceTokenGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly config: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const scopes = this.reflector.getAllAndOverride<string[] | undefined>(SERVICE_SCOPES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!scopes || scopes.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;
    if (!header || Array.isArray(header)) {
      throw new UnauthorizedException("Missing Authorization header");
    }
    const [scheme, token] = header.split(" ");
    if (scheme?.toLowerCase() !== "bearer" || !token) {
      throw new UnauthorizedException("Authorization header must be Bearer token");
    }

    const audience = this.config.get<string>("serviceAuth.audience") ?? "agent-core";

    try {
      const verified = await verifyServiceJwt(token, {
        audience,
        requiredScopes: scopes,
      });
      request.serviceAuth = verified;
      return true;
    } catch (error) {
      if (error instanceof ServiceAuthError) {
        if (error.code === "invalid_scope") {
          throw new ForbiddenException(error.message);
        }
        throw new UnauthorizedException(error.message);
      }
      if (error instanceof ForbiddenException || error instanceof UnauthorizedException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : "Invalid service token";
      throw new UnauthorizedException(message);
    }
  }
}
