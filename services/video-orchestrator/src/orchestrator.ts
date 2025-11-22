import type { RenderJobDefinition, ShotPlan } from "@easymo/video-agent-schema";
import pLimit from "p-limit";

import {
  CaptionManager,
  type CaptionOrchestrationResult,
} from "../captions/index.js";
import { buildSceneJobs } from "./job-scheduler.js";
import { FfmpegRenderer } from "./renderer/ffmpeg-renderer.js";
import type {
  JobFactory,
  OrchestratorOptions,
  RenderInputs,
  RenderResult,
} from "./types.js";

export interface RenderPlanOptions {
  languages?: string[];
  captionPrompt?: string;
}

export interface RenderPlanOutcome {
  stitchedPath: string;
  scenes: RenderResult[];
  captioning: CaptionOrchestrationResult;
  jobs: RenderJobDefinition[];
}

export interface CaptioningConfig {
  captionDirectory: string;
}

export type VideoOrchestratorConfig = OrchestratorOptions & CaptioningConfig;

export class VideoOrchestrator {
  private readonly renderer: FfmpegRenderer;
  private readonly captionManager: CaptionManager;
  private readonly jobFactory: JobFactory;
  private readonly concurrency: number;

  constructor(config: VideoOrchestratorConfig, jobFactory: JobFactory = buildSceneJobs) {
    const workingDirectory = config.workingDirectory ?? process.cwd();
    this.renderer = new FfmpegRenderer({
      workingDirectory,
      ffmpegBinary: config.ffmpegBinary,
    });
    this.captionManager = new CaptionManager({
      baseDirectory: config.captionDirectory,
      ffmpegBinary: config.ffmpegBinary,
    });
    this.jobFactory = jobFactory;
    this.concurrency = config.concurrency ?? 3;
  }

  private createJobs(plan: ShotPlan): RenderJobDefinition[] {
    return this.jobFactory(plan);
  }

  async render(
    inputs: RenderInputs,
    options: RenderPlanOptions = {},
  ): Promise<RenderPlanOutcome> {
    const jobs = this.createJobs(inputs.plan);
    const limit = pLimit(this.concurrency);

    const scenes = await Promise.all(
      jobs.map((job) => limit(() => this.renderer.render(job))),
    );

    const stitchedPath = await this.renderer.stitch(
      scenes,
      inputs.plan.outputPath,
    );

    const captioning = await this.captionManager.orchestrate({
      planId: inputs.plan.id,
      finalVideoPath: stitchedPath,
      languages: options.languages ?? [],
      prompt: options.captionPrompt,
      sceneJobs: jobs,
      renderResults: scenes,
    });

    return {
      stitchedPath,
      scenes,
      captioning,
      jobs,
    };
  }
}
