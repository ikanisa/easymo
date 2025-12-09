import cliProgress from "cli-progress";
import chalk from "chalk";

export function createProgressBar(total: number, table: string): cliProgress.SingleBar {
  const bar = new cliProgress.SingleBar({
    format: `${chalk.cyan(table.padEnd(15))} |${chalk.cyan("{bar}")}| {percentage}% | {value}/{total} | ETA: {eta}s`,
    barCompleteChar: "█",
    barIncompleteChar: "░",
    hideCursor: true,
  });

  bar.start(total, 0);
  return bar;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
}

export function formatNumber(num: number): string {
  return num.toLocaleString();
}
