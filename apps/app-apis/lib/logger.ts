export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  requestId: string
  context?: Record<string, unknown>
}

type LogFn = (entry: LogEntry) => void

const defaultLogger: LogFn = (entry) => {
  const payload = {
    level: entry.level,
    message: entry.message,
    requestId: entry.requestId,
    ...entry.context
  }
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(payload))
}

let logger: LogFn = defaultLogger

export function setLogger(fn: LogFn) {
  logger = fn
}

export function resetLogger() {
  logger = defaultLogger
}

export function log(entry: LogEntry) {
  logger(entry)
}
