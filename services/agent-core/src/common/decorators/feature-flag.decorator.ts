import type { FeatureFlag } from "@easymo/commons";
import { SetMetadata } from "@nestjs/common";

export const FEATURE_FLAG_KEY = "agent.featureFlags";

export const RequireFeatureFlag = (...flags: FeatureFlag[]) =>
  SetMetadata(FEATURE_FLAG_KEY, flags);
