/**
 * Placeholder entry-point for the strangler router functions.
 * Calls should continue to flow through the legacy routers in `apps/api/`
 * until feature flags in `packages/config` opt them into this implementation.
 */
export const handleRequest = async () => {
  throw new Error(
    "Router functions are not yet active – enable through packages/config once ready."
  );
};
