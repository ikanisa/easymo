import { FeatureFlag, isFeatureEnabled } from "@easymo/commons";
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { FEATURE_FLAG_KEY } from "../decorators/feature-flag.decorator.js";

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const metadata = this.reflector.getAllAndOverride<FeatureFlag[] | FeatureFlag | undefined>(
      FEATURE_FLAG_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!metadata) return true;
    const flags = Array.isArray(metadata) ? metadata : [metadata];

    for (const flag of flags) {
      if (!isFeatureEnabled(flag)) {
        throw new ForbiddenException(`Feature flag ${flag} is disabled`);
      }
    }

    return true;
  }
}
