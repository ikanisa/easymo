import { PerformanceObserver } from "node:perf_hooks";

export function register() {
  const observer = new PerformanceObserver((items) => {
    for (const entry of items.getEntries()) {
      if (entry.duration > 0) {
        console.debug(
          `[perf] ${entry.name} duration=${entry.duration.toFixed(2)}ms entryType=${entry.entryType}`
        );
      }
    }
  });

  observer.observe({ entryTypes: ["measure"], buffered: true });
}
