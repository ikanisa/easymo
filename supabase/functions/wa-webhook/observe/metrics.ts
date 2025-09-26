import { logMetric } from "./logging.ts";
export async function recordMetric(
  name: string,
  value = 1,
  dimensions: Record<string, string> = {},
): Promise<void> {
  await logMetric(name, value, dimensions);
}
