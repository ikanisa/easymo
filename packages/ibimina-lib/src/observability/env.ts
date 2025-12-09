const clampSampleRate = (value: number): number => {
  if (!Number.isFinite(value)) return 1;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
};

export const parseSampleRate = (raw: string | undefined, fallback: number): number => {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return clampSampleRate(fallback);
  }

  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) {
    return clampSampleRate(fallback);
  }

  return clampSampleRate(parsed);
};

export const resolveEnvironment = () =>
  process.env.APP_ENV ?? process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV ?? "development";

export const resolveRelease = () =>
  process.env.SENTRY_RELEASE ??
  process.env.NEXT_PUBLIC_BUILD_ID ??
  process.env.COMMIT_REF ??
  process.env.GIT_COMMIT_SHA ??
  undefined;

export const resolveDsn = (options: { browser?: boolean } = {}) => {
  if (options.browser) {
    return process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN ?? "";
  }
  return process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN ?? "";
};
