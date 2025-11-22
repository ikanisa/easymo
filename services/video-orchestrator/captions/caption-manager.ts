import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { dirname, join, resolve } from "node:path";

import type { RenderJobDefinition } from "@easymo/video-agent-schema";

import type { RenderResult } from "../src/types.js";
import { TtsSynthesizer } from "./tts.js";
import { type CaptionSegment,WhisperService } from "./whisper.js";

function segmentsToSrt(segments: CaptionSegment[]): string {
  return segments
    .map((segment, index) => {
      const id = index + 1;
      const formatTime = (value: number) => {
        const hours = Math.floor(value / 3600)
          .toString()
          .padStart(2, "0");
        const minutes = Math.floor((value % 3600) / 60)
          .toString()
          .padStart(2, "0");
        const seconds = Math.floor(value % 60)
          .toString()
          .padStart(2, "0");
        const millis = Math.floor((value % 1) * 1000)
          .toString()
          .padStart(3, "0");
        return `${hours}:${minutes}:${seconds},${millis}`;
      };
      return `${id}\n${formatTime(segment.start)} --> ${formatTime(segment.end)}\n${segment.text}\n`;
    })
    .join("\n");
}

function segmentsToVtt(segments: CaptionSegment[]): string {
  const header = "WEBVTT";
  const body = segments
    .map((segment) => {
      const formatTime = (value: number) => {
        const hours = Math.floor(value / 3600)
          .toString()
          .padStart(2, "0");
        const minutes = Math.floor((value % 3600) / 60)
          .toString()
          .padStart(2, "0");
        const seconds = (value % 60).toFixed(3).padStart(6, "0");
        return `${hours}:${minutes}:${seconds}`;
      };
      return `${formatTime(segment.start)} --> ${formatTime(segment.end)}\n${segment.text}\n`;
    })
    .join("\n");
  return `${header}\n\n${body}`;
}

async function runFfmpeg(
  args: string[],
  ffmpegBinary?: string,
): Promise<void> {
  const command = ffmpegBinary ?? "ffmpeg";
  await new Promise<void>((resolvePromise, reject) => {
    const task = spawn(command, args, { stdio: "inherit" });
    task.on("error", reject);
    task.on("exit", (code) => {
      if (code === 0) {
        resolvePromise();
      } else {
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });
  });
}

export interface CaptionManagerOptions {
  baseDirectory: string;
  ffmpegBinary?: string;
}

export interface CaptionBundle {
  language: string;
  srtPath: string;
  vttPath: string;
  ttsMetadataPath?: string;
  burnedInPath: string;
}

export interface CaptionOrchestrationRequest {
  planId: string;
  finalVideoPath: string;
  languages: string[];
  prompt?: string;
  sceneJobs: RenderJobDefinition[];
  renderResults: RenderResult[];
}

export interface CaptionOrchestrationResult {
  bundles: CaptionBundle[];
}

export class CaptionManager {
  private readonly whisper = new WhisperService();
  private readonly synthesizer: TtsSynthesizer;

  constructor(private readonly options: CaptionManagerOptions) {
    this.synthesizer = new TtsSynthesizer(options.baseDirectory);
  }

  private ensureDirectory(planId: string): string {
    const dir = resolve(this.options.baseDirectory, planId);
    return dir;
  }

  private async writeCaptions(
    planId: string,
    language: string,
    segments: CaptionSegment[],
  ): Promise<{ srt: string; vtt: string }> {
    const dir = this.ensureDirectory(planId);
    await fs.mkdir(dir, { recursive: true });
    const srtPath = join(dir, `${language}.srt`);
    const vttPath = join(dir, `${language}.vtt`);
    await fs.writeFile(srtPath, segmentsToSrt(segments), "utf-8");
    await fs.writeFile(vttPath, segmentsToVtt(segments), "utf-8");
    return { srt: srtPath, vtt: vttPath };
  }

  private async burnIn(
    videoPath: string,
    captionPath: string,
    language: string,
  ): Promise<string> {
    const output = videoPath.replace(/\.mp4$/i, `.${language}.mp4`);
    await fs.mkdir(dirname(output), { recursive: true });
    const args = [
      "-y",
      "-i",
      videoPath,
      "-vf",
      `subtitles='${captionPath.replace(/'/g, "\\'")}':force_style='FontName=Inter,Fontsize=28,PrimaryColour=&Hffffff&'`,
      "-c:a",
      "copy",
      output,
    ];
    await runFfmpeg(args, this.options.ffmpegBinary);
    return output;
  }

  async orchestrate(
    request: CaptionOrchestrationRequest,
  ): Promise<CaptionOrchestrationResult> {
    const uniqueLanguages = new Set(request.languages);
    request.sceneJobs.forEach((job) => {
      if (job.captionHint?.defaultLanguage) {
        uniqueLanguages.add(job.captionHint.defaultLanguage);
      }
      job.captionHint?.additionalLanguages?.forEach((lang) =>
        uniqueLanguages.add(lang),
      );
    });

    const languages = Array.from(uniqueLanguages);
    const bundles: CaptionBundle[] = [];

    for (const language of languages) {
      const segments = await this.whisper.transcribe(
        request.finalVideoPath,
        language,
        { prompt: request.prompt },
      );
      const { srt, vtt } = await this.writeCaptions(
        request.planId,
        language,
        segments,
      );
      const ttsPath = await this.synthesizer.synthesise(
        request.planId,
        language,
        segments.map((segment) => segment.text),
      );
      const burnedInPath = await this.burnIn(
        request.finalVideoPath,
        srt,
        language,
      );
      bundles.push({
        language,
        srtPath: srt,
        vttPath: vtt,
        ttsMetadataPath: ttsPath,
        burnedInPath,
      });
    }

    return { bundles };
  }
}
