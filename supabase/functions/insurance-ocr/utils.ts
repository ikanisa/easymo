export function determineNextStatus(
  attempts: number,
  maxAttempts: number,
): "failed" | "retry" {
  return attempts >= maxAttempts ? "failed" : "retry";
}
