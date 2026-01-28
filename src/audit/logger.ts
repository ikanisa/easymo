/**
 * Simple logger for audit/metrics modules
 *
 * Uses a minimal interface compatible with @easymo/commons childLogger
 * but doesn't require workspace package resolution.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogPayload {
    msg: string;
    [key: string]: unknown;
}

interface Logger {
    debug: (payload: LogPayload) => void;
    info: (payload: LogPayload) => void;
    warn: (payload: LogPayload) => void;
    error: (payload: LogPayload) => void;
}

/**
 * Creates a child logger with the given service name
 */
export function createLogger(options: { service: string }): Logger {
    const { service } = options;

    const log = (level: LogLevel, payload: LogPayload): void => {
        const timestamp = new Date().toISOString();
        const output = {
            timestamp,
            level,
            service,
            ...payload,
        };

        // In production, this would use pino or similar
        // For now, output structured JSON to console
        if (process.env.NODE_ENV === "test") {
            // Silent in tests unless DEBUG is set
            if (process.env.DEBUG) {
                console[level === "debug" ? "log" : level](JSON.stringify(output));
            }
        } else {
            console[level === "debug" ? "log" : level](JSON.stringify(output));
        }
    };

    return {
        debug: (payload) => log("debug", payload),
        info: (payload) => log("info", payload),
        warn: (payload) => log("warn", payload),
        error: (payload) => log("error", payload),
    };
}
