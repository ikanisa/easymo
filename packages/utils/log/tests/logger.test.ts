import { describe, expect, it, vi } from "vitest";
import { createLogger, type LogEntry } from "../src/index.js";

describe("createLogger", () => {
  it("includes request identifiers and merges metadata", () => {
    const entries: LogEntry[] = [];
    const emitter = (entry: LogEntry): void => {
      entries.push(entry);
    };

    const logger = createLogger({
      requestId: "req-123",
      defaultMetadata: { service: "test-suite" },
      emitter,
    });

    logger.info("fetch complete", { durationMs: 42, requestId: "override" });

    expect(entries).toHaveLength(1);
    const [entry] = entries;
    expect(entry.requestId).toBe("override");
    expect(entry.metadata).toEqual({ service: "test-suite", durationMs: 42 });
    expect(entry.level).toBe("info");
  });

  it("supports child loggers that inherit context", () => {
    const entries: LogEntry[] = [];
    const logger = createLogger({
      requestId: "parent",
      defaultMetadata: { service: "parent" },
      emitter: (entry) => entries.push(entry),
    });

    const child = logger.child({
      requestId: "child",
      defaultMetadata: { component: "child" },
    });

    child.debug("child-run", { durationMs: 10 });

    expect(entries).toHaveLength(1);
    const [entry] = entries;
    expect(entry.requestId).toBe("child");
    expect(entry.metadata).toEqual({ service: "parent", component: "child", durationMs: 10 });
    expect(entry.level).toBe("debug");
  });

  it("invokes error tracking hook with serialized errors", () => {
    const trackError = vi.fn();
    const entries: LogEntry[] = [];
    const logger = createLogger({
      emitter: (entry) => entries.push(entry),
      errorTrackingHook: trackError,
    });

    const error = new Error("kaboom");
    error.name = "TestError";
    logger.error("failed to process", error, { jobId: "job-1" });

    expect(entries).toHaveLength(1);
    const [entry] = entries;
    expect(entry.error).toMatchObject({ name: "TestError", message: "kaboom" });
    expect(entry.metadata).toEqual({ jobId: "job-1" });
    expect(trackError).toHaveBeenCalledTimes(1);
    expect(trackError).toHaveBeenCalledWith(entry.error, entry);
  });

  it("accepts errors via metadata", () => {
    const entries: LogEntry[] = [];
    const logger = createLogger({ emitter: (entry) => entries.push(entry) });

    logger.error("pipeline failed", {
      error: new Error("broken"),
      step: "ingest",
    });

    expect(entries).toHaveLength(1);
    const [entry] = entries;
    expect(entry.error).toMatchObject({ message: "broken" });
    expect(entry.metadata).toEqual({ step: "ingest" });
  });
});
