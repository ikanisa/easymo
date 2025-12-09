const config = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT ?? "admin",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  telemetry: false,
};

export default config;
