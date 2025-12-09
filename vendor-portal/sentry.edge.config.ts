import * as Sentry from "@sentry/nextjs";

// Use simple inline helpers to avoid PostHog/crypto dependency from @ibimina/lib
const resolveEnvironment = () => process.env.APP_ENV || process.env.NODE_ENV || "production";
const resolveDsn = () => process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN || "";
const resolveRelease = () =>
  process.env.NEXT_PUBLIC_BUILD_ID ||
  process.env.GIT_COMMIT_SHA ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  "unknown";

const environment = resolveEnvironment();
const dsn = resolveDsn();

if (dsn) {
  Sentry.init({
    dsn,
    environment,
    release: resolveRelease(),
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || "0.1"),
    profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || "0.1"),
  });
}
