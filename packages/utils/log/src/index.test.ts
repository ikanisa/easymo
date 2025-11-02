import { describe, expect, it, vi } from "vitest";

import { createLogger } from "./index";
import type { LogRecord } from "./index";

const getRecord = (calls: ReadonlyArray<[LogRecord]>): LogRecord => calls[0][0];

describe("createLogger", () => {
  it("includes requestId and context on log records", () => {
    const emit = vi.fn<(record: LogRecord) => void>();
    const logger = createLogger({ service: "orders", requestId: "req-123", onLog: emit });

    logger.info("fetch complete", { userId: "42", durationMs: 38 });

    expect(emit).toHaveBeenCalledTimes(1);
    const record = getRecord(emit.mock.calls as ReadonlyArray<[LogRecord]>);
    expect(record.service).toBe("orders");
    expect(record.level).toBe("info");
    expect(record.requestId).toBe("req-123");
    expect(record.context).toEqual({ userId: "42", durationMs: 38 });
    expect(new Date(record.timestamp).toString()).not.toBe("Invalid Date");
  });

  it("creates child loggers with merged context", () => {
    const emit = vi.fn<(record: LogRecord) => void>();
    const logger = createLogger({
      service: "orders",
      onLog: emit,
      defaultContext: { component: "root" },
    });

    const child = logger.child({ requestId: "child-7", component: "worker", feature: "sync" });
    child.debug("starting", { jobId: "job-55" });

    expect(emit).toHaveBeenCalledTimes(1);
    const record = getRecord(emit.mock.calls as ReadonlyArray<[LogRecord]>);
    expect(record.level).toBe("debug");
    expect(record.requestId).toBe("child-7");
    expect(record.context).toEqual({ component: "worker", feature: "sync", jobId: "job-55" });
  });

  it("invokes the error tracker hook for error logs", () => {
    const emit = vi.fn<(record: LogRecord) => void>();
    const trackError = vi.fn<(error: unknown, record: LogRecord) => void>();
    const logger = createLogger({ service: "orders", onLog: emit, trackError });

    const failure = new Error("failed to queue job");
    logger.error("job enqueue failed", { error: failure, requestId: "req-999" });

    expect(emit).toHaveBeenCalledTimes(1);
    expect(trackError).toHaveBeenCalledTimes(1);
    const [errorArg, recordArg] = trackError.mock.calls[0] as [unknown, LogRecord];
    expect(errorArg).toBe(failure);
    expect(recordArg.requestId).toBe("req-999");
    expect(recordArg.error?.message).toBe("failed to queue job");
    expect(recordArg.level).toBe("error");
  });

  it("supports withRequest helper", () => {
    const emit = vi.fn<(record: LogRecord) => void>();
    const logger = createLogger({ service: "orders", onLog: emit });

    const requestLogger = logger.withRequest("req-222");
    requestLogger.warn("slow response", { durationMs: 1200 });

    const record = getRecord(emit.mock.calls as ReadonlyArray<[LogRecord]>);
    expect(record.requestId).toBe("req-222");
    expect(record.context).toEqual({ durationMs: 1200 });
  });
});
