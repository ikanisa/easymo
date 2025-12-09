import dynamic from "next/dynamic";

// Import the real component only on the client to avoid SSR/hydration mismatch.
export const OfflineQueueIndicator = dynamic(
  () => import("./offline-queue-indicator").then((m) => m.OfflineQueueIndicator),
  { ssr: false, loading: () => null }
);

export default OfflineQueueIndicator;
