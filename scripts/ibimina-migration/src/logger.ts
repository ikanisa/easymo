import chalk from "chalk";
import { config } from "./config.js";

type LogLevel = "debug" | "info" | "warn" | "error" | "success";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: unknown;
}

const logs: LogEntry[] = [];

function formatTimestamp(): string {
  return new Date().toISOString();
}

function log(level: LogLevel, message: string, data?: unknown): void {
  const entry: LogEntry = {
    timestamp: formatTimestamp(),
    level,
    message,
    data,
  };
  logs.push(entry);

  const timestamp = chalk.gray(`[${entry.timestamp}]`);
  
  switch (level) {
    case "debug":
      if (config.VERBOSE) {
        console.log(timestamp, chalk.gray("[DEBUG]"), message, data ?? "");
      }
      break;
    case "info":
      console.log(timestamp, chalk.blue("[INFO]"), message, data ?? "");
      break;
    case "warn":
      console.log(timestamp, chalk.yellow("[WARN]"), message, data ?? "");
      break;
    case "error":
      console.log(timestamp, chalk.red("[ERROR]"), message, data ?? "");
      break;
    case "success":
      console.log(timestamp, chalk.green("[SUCCESS]"), message, data ?? "");
      break;
  }
}

export const logger = {
  debug: (message: string, data?: unknown) => log("debug", message, data),
  info: (message: string, data?: unknown) => log("info", message, data),
  warn: (message: string, data?: unknown) => log("warn", message, data),
  error: (message: string, data?: unknown) => log("error", message, data),
  success: (message: string, data?: unknown) => log("success", message, data),
  
  getLogs: () => [...logs],
  
  table: (data: Record<string, unknown>[]) => {
    console.table(data);
  },
  
  separator: (char = "─", length = 60) => {
    console.log(chalk.gray(char.repeat(length)));
  },
  
  header: (title: string) => {
    const line = "═".repeat(60);
    console.log(chalk.cyan(`\n${line}`));
    console.log(chalk.cyan.bold(`  ${title}`));
    console.log(chalk.cyan(`${line}\n`));
  },
};
