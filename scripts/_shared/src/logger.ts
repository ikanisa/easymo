import chalk from "chalk";

type LogLevel = "debug" | "info" | "warn" | "error" | "success" | "step";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: unknown;
}

interface LoggerOptions {
  verbose?: boolean;
}

const logs: LogEntry[] = [];
let options: LoggerOptions = { verbose: false };

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
      if (options.verbose) {
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
    case "step":
      console.log(timestamp, chalk.cyan("[STEP]"), chalk.bold(message), data ?? "");
      break;
  }
}

export const logger = {
  configure: (opts: LoggerOptions) => {
    options = { ...options, ...opts };
  },

  debug: (message: string, data?: unknown) => log("debug", message, data),
  info: (message: string, data?: unknown) => log("info", message, data),
  warn: (message: string, data?: unknown) => log("warn", message, data),
  error: (message: string, data?: unknown) => log("error", message, data),
  success: (message: string, data?: unknown) => log("success", message, data),
  step: (message: string, data?: unknown) => log("step", message, data),

  getLogs: () => [...logs],

  table: (data: Record<string, unknown>[]) => {
    console.table(data);
  },

  separator: (char = "─", length = 70) => {
    console.log(chalk.gray(char.repeat(length)));
  },

  header: (title: string) => {
    const line = "═".repeat(70);
    console.log(chalk.cyan(`\n${line}`));
    console.log(chalk.cyan.bold(`  ${title}`));
    console.log(chalk.cyan(`${line}\n`));
  },

  subheader: (title: string) => {
    console.log(chalk.yellow(`\n▸ ${title}`));
    console.log(chalk.gray("─".repeat(50)));
  },

  checklist: (items: Array<{ name: string; status: "pass" | "fail" | "warn" | "skip" }>) => {
    for (const item of items) {
      const icon =
        item.status === "pass" ? chalk.green("✓") :
        item.status === "fail" ? chalk.red("✗") :
        item.status === "warn" ? chalk.yellow("⚠") :
        chalk.gray("○");
      console.log(`  ${icon} ${item.name}`);
    }
  },

  progress: (current: number, total: number, label: string) => {
    const percentage = Math.round((current / total) * 100);
    const filled = Math.round(percentage / 2);
    const empty = 50 - filled;
    const bar = chalk.cyan("█".repeat(filled)) + chalk.gray("░".repeat(empty));
    process.stdout.write(`\r  ${bar} ${percentage}% - ${label}`);
    if (current === total) console.log();
  },

  countdown: async (seconds: number, message: string) => {
    for (let i = seconds; i > 0; i--) {
      process.stdout.write(`\r${chalk.yellow(`⏳ ${message} in ${i}s... `)}`);
      await new Promise((r) => setTimeout(r, 1000));
    }
    console.log(`\r${chalk.green(`✓ ${message}`)}`);
  },
};
