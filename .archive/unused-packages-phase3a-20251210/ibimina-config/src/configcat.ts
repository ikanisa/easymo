import { env } from "./env.js";

type EnvironmentKey = string;

type OffersOverrideMap = {
  default?: boolean;
  saccoOverrides?: Record<string, boolean>;
  memberOverrides?: Record<string, boolean>;
};

interface OverridesShape {
  [environment: EnvironmentKey]: OffersOverrideMap;
}

let overridesCache: OverridesShape | null = null;
let lastLoaded = 0;

function parseOverrides(raw: string | undefined): OverridesShape | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as OverridesShape;
    return parsed;
  } catch (error) {
    console.warn("Invalid CONFIGCAT_OFFERS_OVERRIDES payload", error);
    return null;
  }
}

function getOverrides(): OverridesShape | null {
  if (overridesCache && Date.now() - lastLoaded < 5 * 60 * 1000) {
    return overridesCache;
  }
  overridesCache = parseOverrides(env.CONFIGCAT_OFFERS_OVERRIDES);
  lastLoaded = Date.now();
  return overridesCache;
}

function normalizeEnvironment(envName: string | undefined): EnvironmentKey {
  return (envName ?? env.CONFIGCAT_ENVIRONMENT ?? env.APP_ENV ?? "development").toLowerCase();
}

export interface OffersDecisionInput {
  subjectKey: string;
  saccoId: string;
  environment?: string;
  fallback?: boolean;
}

function resolveOverride(
  subjectKey: string,
  saccoId: string,
  overrides: OffersOverrideMap | undefined,
  fallback: boolean
): boolean {
  if (!overrides) {
    return fallback;
  }
  const memberOverride = overrides.memberOverrides?.[subjectKey];
  if (typeof memberOverride === "boolean") {
    return memberOverride;
  }
  const saccoOverride = overrides.saccoOverrides?.[saccoId];
  if (typeof saccoOverride === "boolean") {
    return saccoOverride;
  }
  if (typeof overrides.default === "boolean") {
    return overrides.default;
  }
  return fallback;
}

export async function getOffersFeatureDecision(input: OffersDecisionInput): Promise<boolean> {
  const fallbackDefault = input.fallback ?? env.CONFIGCAT_OFFERS_FALLBACK === "enabled";
  const overrides = getOverrides();
  const environment = normalizeEnvironment(input.environment);
  const environmentOverrides = overrides?.[environment];

  if (env.CONFIGCAT_OFFERS_SDK_KEY && env.CONFIGCAT_SETTINGS_URL) {
    try {
      const response = await fetch(env.CONFIGCAT_SETTINGS_URL, {
        headers: {
          "X-ConfigCat-SDKKey": env.CONFIGCAT_OFFERS_SDK_KEY,
          "Content-Type": "application/json",
        },
      });
      if (response.ok) {
        const json = (await response.json()) as OverridesShape;
        overridesCache = json;
        lastLoaded = Date.now();
        return resolveOverride(input.subjectKey, input.saccoId, json[environment], fallbackDefault);
      }
      console.warn("ConfigCat settings fetch failed", response.status, await response.text());
    } catch (error) {
      console.warn("ConfigCat fetch error", error);
    }
  }

  return resolveOverride(input.subjectKey, input.saccoId, environmentOverrides, fallbackDefault);
}

export function setOffersOverrides(overrides: OverridesShape): void {
  overridesCache = overrides;
  lastLoaded = Date.now();
}
