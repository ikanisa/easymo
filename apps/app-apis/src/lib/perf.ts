import { performance } from "node:perf_hooks";
import { logger } from "@app-apis/lib/logger";

export const measure = async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
  const markStart = `${name}-start-${performance.now()}`;
  const markEnd = `${name}-end-${performance.now()}`;
  performance.mark(markStart);
  try {
    const result = await fn();
    performance.mark(markEnd);
    performance.measure(name, markStart, markEnd);
    const [entry] = performance.getEntriesByName(name).slice(-1);
    if (entry) {
      logger.debug("perf", { name, durationMs: entry.duration });
    }
    return result;
  } finally {
    performance.clearMarks(markStart);
    performance.clearMarks(markEnd);
  }
};
