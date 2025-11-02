/**
 * Placeholder bootstrap for the future Admin PWA application.
 * The strangler fig migration keeps the runtime delegating to `admin-app/`
 * until feature flags enable native routes here.
 */
export const bootstrapAdminPwa = () => {
  throw new Error(
    "Admin PWA is not wired up yet – enable via packages/config feature flags once implemented."
  );
};
