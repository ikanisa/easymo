import { join } from "node:path";
import {
  buildSceneJobId,
  resolveBrandLookupTable,
  resolveSafeZonePreset,
  type RenderJobDefinition,
  type ScenePlan,
  type ShotPlan,
} from "@easymo/video-agent-schema";

function toSceneOutputPath(plan: ShotPlan, scene: ScenePlan): string {
  const base = plan.outputPath.replace(/\.[a-zA-Z0-9]+$/, "");
  return `${base}_${scene.order.toString().padStart(2, "0")}_${scene.id}.mp4`;
}

export function buildSceneJobs(plan: ShotPlan): RenderJobDefinition[] {
  const safeZone = resolveSafeZonePreset(plan.safeZonePresetId);
  const brandLut = resolveBrandLookupTable(plan.brandId);

  return [...plan.scenes]
    .sort((a, b) => a.order - b.order)
    .map((scene) => {
      const jobId = buildSceneJobId(plan, scene);
      const estimatedDuration = scene.shots.reduce((acc, shot) => {
        const available = shot.duration - (shot.startOffset ?? 0);
        const trimmed = shot.trimTo
          ? Math.min(shot.trimTo - (shot.startOffset ?? 0), available)
          : available;
        return acc + Math.max(trimmed, 0);
      }, 0);
      return {
        jobId,
        sceneId: scene.id,
        order: scene.order,
        safeZonePreset: scene.overlays?.length
          ? resolveSafeZonePreset(
              scene.overlays[0].safeZonePresetId ?? plan.safeZonePresetId,
            )
          : safeZone,
        brandLut,
        segments: scene.shots.map((shot) => ({
          clipId: shot.id,
          source: join("shots", shot.src),
          trimStart: shot.startOffset,
          trimEnd: shot.trimTo,
        })),
        overlays: (scene.overlays ?? []).map((overlay) => ({
          ...overlay,
          src: join("overlays", overlay.src),
        })),
        audio: scene.audio,
        captionHint: scene.captionHints,
        outputPath: join("renders", toSceneOutputPath(plan, scene)),
        estimatedDuration,
      } satisfies RenderJobDefinition;
    });
}
