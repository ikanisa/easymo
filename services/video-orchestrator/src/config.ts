import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

export interface EnvironmentConfig {
  port: number;
  concurrency: number;
  workingDirectory: string;
  ffmpegBinary?: string;
  captionDirectory: string;
  orchestratorBaseUrl?: string;
}

function ensureDir(path: string): string {
  mkdirSync(path, { recursive: true });
  return path;
}

export function loadConfig(): EnvironmentConfig {
  const workingDirectory = resolve(
    process.cwd(),
    process.env.VIDEO_ORCHESTRATOR_WORKDIR ?? "./tmp/video-orchestrator",
  );
  const captionDirectory = resolve(
    process.cwd(),
    process.env.VIDEO_ORCHESTRATOR_CAPTIONS ?? "./captions",
  );

  return {
    port: Number(process.env.PORT ?? 4006),
    concurrency: Number(process.env.VIDEO_ORCHESTRATOR_CONCURRENCY ?? 3),
    workingDirectory: ensureDir(workingDirectory),
    ffmpegBinary: process.env.FFMPEG_BINARY,
    captionDirectory: ensureDir(captionDirectory),
    orchestratorBaseUrl: process.env.ORCHESTRATOR_BASE_URL,
  };
}
