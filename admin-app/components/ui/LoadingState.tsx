export function LoadingState({ message = 'Loading…' }: { message?: string }) {
  return (
    <div className="loading-state" role="status" aria-live="polite">
      <div className="spinner" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
