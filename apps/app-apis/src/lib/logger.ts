export type LogLevel = "debug" | "info" | "error";

export interface LogEntry {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
}

type LogSink = (entry: LogEntry) => void;

const defaultSink: LogSink = ({ level, message, context }) => {
  const serializedContext = context ? ` ${JSON.stringify(context)}` : "";
  if (level === "error") {
    console.error(`[${level}] ${message}${serializedContext}`);
  } else {
    console.log(`[${level}] ${message}${serializedContext}`);
  }
};

let sink: LogSink = defaultSink;

export const setLogSink = (nextSink: LogSink | null) => {
  sink = nextSink ?? defaultSink;
};

export const logger = {
  debug(message: string, context?: Record<string, unknown>) {
    sink({ level: "debug", message, context });
  },
  info(message: string, context?: Record<string, unknown>) {
    sink({ level: "info", message, context });
  },
  error(message: string, context?: Record<string, unknown>) {
    sink({ level: "error", message, context });
  },
};
