type LoggerLike = {
  info: (...args: unknown[]) => void;
  warn?: (...args: unknown[]) => void;
  error?: (...args: unknown[]) => void;
};

const noop = () => {};

export const logger: LoggerLike = {
  info: noop,
  warn: noop,
  error: noop,
};

export const childLogger = () => logger;

export const withTelemetryContext = async (
  fn: () => Promise<unknown> | unknown,
) => await fn();

export const attachTraceToLogger = noop;
export const attachRequestToLogger = noop;
export const attachSpanToLogger = noop;
