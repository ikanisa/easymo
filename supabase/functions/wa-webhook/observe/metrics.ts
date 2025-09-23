export function recordMetric(name: string, value = 1, dimensions: Record<string, string> = {}): void {
  console.log("metric", { name, value, dimensions });
}
