import type { OverlayPlan, ScenePlan, ShotPlan } from "./index.js";

export type TrimMutation = {
  type: "trim";
  sceneId: string;
  shotId: string;
  trimStart?: number;
  trimEnd: number;
};

export type HookRewriteMutation = {
  type: "hook_rewrite";
  sceneId: string;
  text: string;
};

export type CtaSwapMutation = {
  type: "cta_swap";
  sceneId: string;
  asset: string;
};

export type Mutation = TrimMutation | HookRewriteMutation | CtaSwapMutation;

export interface LineageEntry {
  id: string;
  parentId: string;
  mutation: Mutation;
  timestamp: string;
}

function applyTrim(scene: ScenePlan, mutation: TrimMutation): ScenePlan {
  const shots = scene.shots.map((shot) => {
    if (shot.id !== mutation.shotId) {
      return shot;
    }
    return {
      ...shot,
      startOffset: mutation.trimStart ?? shot.startOffset,
      trimTo: mutation.trimEnd,
    };
  });
  return { ...scene, shots };
}

function applyHookRewrite(scene: ScenePlan, mutation: HookRewriteMutation): ScenePlan {
  return {
    ...scene,
    captionHints: {
      defaultLanguage: scene.captionHints?.defaultLanguage ?? "en",
      additionalLanguages: scene.captionHints?.additionalLanguages,
      prompt: mutation.text,
    },
  };
}

function applyCtaSwap(scene: ScenePlan, mutation: CtaSwapMutation): ScenePlan {
  const overlays: OverlayPlan[] = (scene.overlays ?? []).map((overlay) => {
    if (overlay.type !== "cta") {
      return overlay;
    }
    return {
      ...overlay,
      src: mutation.asset,
    };
  });
  return { ...scene, overlays };
}

export function applyMutation(parent: ShotPlan, mutation: Mutation): ShotPlan {
  const scenes = parent.scenes.map((scene) => {
    if (scene.id !== mutation.sceneId) {
      return scene;
    }
    switch (mutation.type) {
      case "trim":
        return applyTrim(scene, mutation);
      case "hook_rewrite":
        return applyHookRewrite(scene, mutation);
      case "cta_swap":
        return applyCtaSwap(scene, mutation);
      default:
        return scene;
    }
  });

  return { ...parent, scenes };
}

export function appendLineage(
  parent: ShotPlan,
  lineageEntry: LineageEntry,
): ShotPlan {
  const existingLineage = Array.isArray(
    (parent.metadata as { lineage?: LineageEntry[] } | undefined)?.lineage,
  )
    ? [...(parent.metadata as { lineage?: LineageEntry[] }).lineage!]
    : [];

  return {
    ...parent,
    metadata: {
      ...(parent.metadata ?? {}),
      parentId: parent.id,
      lineage: [...existingLineage, lineageEntry],
    },
  };
}
