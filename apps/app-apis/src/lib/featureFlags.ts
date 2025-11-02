import type { FeatureFlagKey } from "@app-apis/config/environment";
import { getEnvironment } from "@app-apis/config/environment";
import { ApiError } from "@app-apis/lib/errors";

export class FeatureFlagService {
  constructor(private readonly flags: Record<FeatureFlagKey, boolean>) {}

  ensureEnabled(flag: FeatureFlagKey, requestId: string) {
    if (!this.flags[flag]) {
      throw new ApiError({
        status: 403,
        code: "FEATURE_DISABLED",
        message: `${flag} feature is currently disabled`,
        requestId,
      });
    }
  }
}

let cachedService: FeatureFlagService | null = null;

export const getFeatureFlagService = (): FeatureFlagService => {
  if (!cachedService) {
    const env = getEnvironment();
    cachedService = new FeatureFlagService(env.featureFlags);
  }

  return cachedService;
};

export const setFeatureFlagServiceForTests = (service: FeatureFlagService | null) => {
  cachedService = service;
};
