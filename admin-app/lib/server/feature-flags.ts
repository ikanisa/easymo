const FLAG_DEFAULTS: Record<string, boolean> = {
  'dualConstraintMatching.enabled': true,
  'basket.confirmation.enabled': true,
};

const FLAG_ENV_MAP: Record<string, string | undefined> = {
  'dualConstraintMatching.enabled':
    process.env.DUAL_CONSTRAINT_MATCHING_ENABLED ??
    process.env.NEXT_PUBLIC_DUAL_CONSTRAINT_MATCHING_ENABLED ??
    process.env.FEATURE_FLAG_DUALCONSTRAINTMATCHING_ENABLED,
  'basket.confirmation.enabled':
    process.env.BASKET_CONFIRMATION_ENABLED ??
    process.env.NEXT_PUBLIC_BASKET_CONFIRMATION_ENABLED ??
    process.env.FEATURE_FLAG_BASKET_CONFIRMATION_ENABLED,
};

function parseBoolean(value: string | undefined): boolean | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) {
    return false;
  }
  return null;
}

export function isFeatureEnabled(key: keyof typeof FLAG_DEFAULTS | string, defaultValue?: boolean): boolean {
  const explicitDefault = defaultValue ?? FLAG_DEFAULTS[key] ?? false;
  const fallbackKey = key.toUpperCase().replace(/\./g, '_');
  const envValue = FLAG_ENV_MAP[key] ?? process.env[fallbackKey];
  const parsed = parseBoolean(envValue);
  if (parsed === null) {
    return explicitDefault;
  }
  return parsed;
}
