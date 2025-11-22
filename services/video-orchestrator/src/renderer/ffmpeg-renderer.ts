import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import {
  type OverlayPlan,
  type RenderJobDefinition,
  resolveSafeZonePreset,
} from "@easymo/video-agent-schema";

import type { RenderContext, RenderResult } from "../types.js";

function runFfmpeg(args: string[], ffmpegBinary?: string): Promise<void> {
  const command = ffmpegBinary ?? "ffmpeg";
  return new Promise((resolvePromise, reject) => {
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

function buildSafeZoneFilter(job: RenderJobDefinition): string {
  const { paddingPct, heightPct, anchor } = job.safeZonePreset;
  const padding = paddingPct / 100;
  const height = heightPct / 100;
  const yPosition =
    anchor === "bottom"
      ? `H*(1-${height} - ${padding})`
      : `H*${padding}`;
  const xPadding = `(W*${padding})`;
  const width = `W*(1-${padding * 2})`;
  const heightExpr = `H*${height}`;
  return `drawbox=x=${xPadding}:y=${yPosition}:w=${width}:h=${heightExpr}:color=black@0.02:t=fill`;
}

function buildOverlayInstructions(
  overlays: OverlayPlan[],
  initialLabel: string,
): { parts: string[]; finalLabel: string } {
  let currentLabel = initialLabel;
  const parts: string[] = [];

  overlays.forEach((overlay, index) => {
    const safeZone = overlay.safeZonePresetId
      ? resolveSafeZonePreset(overlay.safeZonePresetId)
      : undefined;
    const padding = (safeZone?.paddingPct ?? 6) / 100;
    const zoneHeight = (safeZone?.heightPct ?? 24) / 100;
    const anchor = safeZone?.anchor ?? "bottom";
    const start = overlay.startTime ?? 0;
    const end = overlay.duration ? start + overlay.duration : undefined;
    const enable = end
      ? `between(t,${start},${end})`
      : `gte(t,${start})`;

    const x = `(W - W*(1-${padding * 2}))/2`;
    const y =
      anchor === "bottom"
        ? `H*(1-${zoneHeight}) - H*${padding}`
        : `H*${padding}`;
    const overlayLabel = `ov${index}`;
    parts.push(
      `movie='${overlay.src.replace(/'/g, "\\'")}'[${overlayLabel}]`,
    );
    const nextLabel = index === overlays.length - 1 ? "vout" : `${overlayLabel}_out`;
    parts.push(
      `[${currentLabel}][${overlayLabel}]overlay=x=${x}:y=${y}:enable='${enable}'[${nextLabel}]`,
    );
    currentLabel = nextLabel;
  });

  return { parts, finalLabel: currentLabel };
}

function buildFilterComplex(job: RenderJobDefinition): {
  graph: string;
  videoLabel: string;
} {
  const lut = `lut3d='${job.brandLut.lutPath.replace(/'/g, "\\'")}'`;
  const safeZone = buildSafeZoneFilter(job);
  const baseLabel = job.overlays.length ? "base0" : "vout";
  const base = `[0:v]${lut},${safeZone}[${baseLabel}]`;

  if (!job.overlays.length) {
    return { graph: base, videoLabel: "vout" };
  }

  const { parts, finalLabel } = buildOverlayInstructions(job.overlays, baseLabel);
  const graph = [base, ...parts].join(";");
  const videoLabel = finalLabel === "vout" ? "vout" : `${finalLabel}`;
  return { graph, videoLabel };
}

function buildConcatList(job: RenderJobDefinition, context: RenderContext): string {
  const listPath = resolve(context.workingDirectory, `${job.jobId}.ffconcat`);
  const lines: string[] = ["ffconcat version 1.0"];
  job.segments.forEach((segment) => {
    lines.push(`file '${resolve(context.workingDirectory, segment.source)}'`);
    if (segment.trimStart != null) {
      lines.push(`inpoint ${segment.trimStart.toFixed(3)}`);
    }
    if (segment.trimEnd != null) {
      lines.push(`outpoint ${segment.trimEnd.toFixed(3)}`);
    }
  });
  writeFileSync(listPath, `${lines.join("\n")}\n`);
  return listPath;
}

export class FfmpegRenderer {
  constructor(private readonly context: RenderContext) {}

  async render(job: RenderJobDefinition): Promise<RenderResult> {
    const target = resolve(this.context.workingDirectory, job.outputPath);
    mkdirSync(dirname(target), { recursive: true });
    const concatList = buildConcatList(job, this.context);
    const { graph, videoLabel } = buildFilterComplex(job);

    const args: string[] = [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      concatList,
      "-filter_complex",
      graph,
      "-map",
      `[${videoLabel}]`,
    ];

    if (job.audio) {
      args.push(
        "-i",
        resolve(this.context.workingDirectory, job.audio.src),
        "-map",
        "1:a",
        "-c:a",
        "aac",
        "-shortest",
      );
    }

    args.push(
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-movflags",
      "+faststart",
      target,
    );

    await runFfmpeg(args, this.context.ffmpegBinary);

    return {
      jobId: job.jobId,
      sceneId: job.sceneId,
      outputPath: target,
      duration: job.estimatedDuration,
    };
  }

  async stitch(rendered: RenderResult[], finalOutput: string): Promise<string> {
    const concatListPath = resolve(
      this.context.workingDirectory,
      `stitch_${Date.now()}.txt`,
    );
    const listContent = rendered
      .sort((a, b) => a.sceneId.localeCompare(b.sceneId))
      .map((scene) => `file '${scene.outputPath.replace(/'/g, "\\'")}'`)
      .join("\n");
    writeFileSync(concatListPath, `${listContent}\n`);

    const target = resolve(this.context.workingDirectory, finalOutput);
    mkdirSync(dirname(target), { recursive: true });

    const args = [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      concatListPath,
      "-c",
      "copy",
      target,
    ];

    await runFfmpeg(args, this.context.ffmpegBinary);
    return target;
  }
}
