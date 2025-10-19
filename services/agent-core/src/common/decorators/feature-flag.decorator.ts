import { SetMetadata } from "@nestjs/common";
import type { FeatureFlag } from "@easymo/commons";

export const FEATURE_FLAG_KEY = "agent.featureFlags";

export const RequireFeatureFlag = (...flags: FeatureFlag[]) =>
  SetMetadata(FEATURE_FLAG_KEY, flags);
