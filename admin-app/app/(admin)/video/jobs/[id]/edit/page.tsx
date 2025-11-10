import type { ShotPlan } from "@easymo/video-agent-schema";
import EditJobClient from "./edit-client";

async function loadJobPlan(jobId: string): Promise<ShotPlan> {
  const fallbackPlan: ShotPlan = {
    id: jobId,
    brandId: "default",
    safeZonePresetId: "safe-lower-third",
    outputPath: `deliverables/${jobId}.mp4`,
    metadata: {
      title: `Video job ${jobId}`,
    },
    scenes: [
      {
        id: "scene-intro",
        order: 1,
        shots: [
          {
            id: "shot-001",
            src: `${jobId}/intro.mp4`,
            duration: 6,
          },
        ],
        captionHints: {
          defaultLanguage: "en",
          additionalLanguages: ["es"],
          prompt: "Introduce the product benefits",
        },
        overlays: [
          {
            id: "hook",
            type: "lowerThird",
            src: `overlays/${jobId}/hook.png`,
            duration: 4,
            startTime: 1,
          },
          {
            id: "cta",
            type: "cta",
            src: `overlays/${jobId}/cta.png`,
            startTime: 4,
            duration: 2.5,
          },
        ],
        audio: {
          src: `audio/${jobId}-vo.mp3`,
          type: "voiceover",
          gain: -1,
        },
      },
      {
        id: "scene-outro",
        order: 2,
        shots: [
          {
            id: "shot-002",
            src: `${jobId}/outro.mp4`,
            duration: 8,
            startOffset: 0.5,
          },
        ],
        captionHints: {
          defaultLanguage: "en",
          prompt: "Close with a CTA",
        },
        overlays: [
          {
            id: "logo",
            type: "logo",
            src: `overlays/${jobId}/logo.png`,
            duration: 8,
          },
          {
            id: "cta",
            type: "cta",
            src: `overlays/${jobId}/cta.png`,
            startTime: 2,
            duration: 5,
          },
        ],
        audio: {
          src: `audio/${jobId}-music.mp3`,
          type: "music",
          gain: -8,
        },
      },
    ],
  };

  return fallbackPlan;
}

export default async function EditJobPage({
  params,
}: {
  params: { id: string };
}) {
  const plan = await loadJobPlan(params.id);
  return <EditJobClient jobId={params.id} initialPlan={plan} />;
}
