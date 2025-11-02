/**
 * Placeholder bootstrap for the modular API surface.
 * Requests should still be fulfilled by `apps/api/` until the strangler
 * migration replaces each endpoint.
 */
export const startAppApis = async () => {
  throw new Error(
    "App APIs are not active yet – flip the packages/config feature flags once implemented."
  );
};
