export const RouteLoadingFallback = () => (
  <div
    role="status"
    aria-live="polite"
    aria-busy="true"
    className="flex min-h-screen items-center justify-center bg-background"
  >
    <span className="animate-pulse text-sm text-muted-foreground">Loading view…</span>
  </div>
);

export default RouteLoadingFallback;
