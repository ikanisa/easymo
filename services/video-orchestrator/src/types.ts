import type {
  RenderJobDefinition,
  ScenePlan,
  ShotPlan,
} from "@easymo/video-agent-schema";

export interface RenderResult {
  jobId: string;
  sceneId: string;
  outputPath: string;
  duration: number;
}

export interface RenderContext {
  workingDirectory: string;
  ffmpegBinary?: string;
}

export interface OrchestratorOptions {
  concurrency?: number;
  workingDirectory?: string;
  ffmpegBinary?: string;
}

export interface RenderInputs {
  plan: ShotPlan;
  scenes?: ScenePlan[];
}

export type JobFactory = (plan: ShotPlan) => RenderJobDefinition[];
