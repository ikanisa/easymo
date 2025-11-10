export interface ShotPlan {
  id: string;
  brandId: string;
  safeZonePresetId: string;
  outputPath: string;
  scenes: ScenePlan[];
  metadata?: Record<string, unknown>;
}

export interface ScenePlan {
  id: string;
  order: number;
  shots: ShotReference[];
  audio?: AudioTrackPlan;
  overlays?: OverlayPlan[];
  captionHints?: CaptionHint;
}

export interface ShotReference {
  id: string;
  src: string;
  duration: number;
  startOffset?: number;
  trimTo?: number;
}

export interface AudioTrackPlan {
  src: string;
  type: "voiceover" | "music" | "dialog";
  gain?: number;
}

export interface OverlayPlan {
  id: string;
  type: "logo" | "lowerThird" | "cta" | "slug";
  src: string;
  safeZonePresetId?: string;
  startTime?: number;
  duration?: number;
}

export interface CaptionHint {
  defaultLanguage: string;
  additionalLanguages?: string[];
  prompt?: string;
}

export interface SafeZonePreset {
  id: string;
  name: string;
  paddingPct: number;
  anchor: "top" | "bottom";
  heightPct: number;
}

export interface BrandLookupTable {
  brandId: string;
  lutPath: string;
  description?: string;
}

export interface RenderSegment {
  clipId: string;
  source: string;
  trimStart?: number;
  trimEnd?: number;
}

export interface RenderJobDefinition {
  jobId: string;
  sceneId: string;
  order: number;
  safeZonePreset: SafeZonePreset;
  brandLut: BrandLookupTable;
  segments: RenderSegment[];
  overlays: OverlayPlan[];
  audio?: AudioTrackPlan;
  captionHint?: CaptionHint;
  outputPath: string;
  estimatedDuration: number;
}

export const SAFE_ZONE_PRESETS: Record<string, SafeZonePreset> = {
  "safe-top": {
    id: "safe-top",
    name: "Top Safe",
    anchor: "top",
    paddingPct: 5,
    heightPct: 25,
  },
  "safe-bottom": {
    id: "safe-bottom",
    name: "Bottom Safe",
    anchor: "bottom",
    paddingPct: 6,
    heightPct: 28,
  },
  "safe-lower-third": {
    id: "safe-lower-third",
    name: "Lower Third",
    anchor: "bottom",
    paddingPct: 8,
    heightPct: 22,
  },
};

export const BRAND_LUTS: Record<string, BrandLookupTable> = {
  default: {
    brandId: "default",
    lutPath: "luts/default.cube",
    description: "Baseline look",
  },
  premium: {
    brandId: "premium",
    lutPath: "luts/premium.cube",
    description: "Premium cinematic toning",
  },
};

export function resolveSafeZonePreset(id: string): SafeZonePreset {
  const preset = SAFE_ZONE_PRESETS[id];
  if (!preset) {
    throw new Error(`Unknown safe zone preset: ${id}`);
  }
  return preset;
}

export function resolveBrandLookupTable(brandId: string): BrandLookupTable {
  const table = BRAND_LUTS[brandId] ?? BRAND_LUTS.default;
  return table;
}

export function buildSceneJobId(plan: ShotPlan, scene: ScenePlan): string {
  return `${plan.id}:${scene.id}`;
}

export * from "./mutations.js";
