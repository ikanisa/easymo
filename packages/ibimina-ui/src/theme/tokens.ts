/**
 * Border radius tokens following 4pt grid.
 */
export const radii = {
  sm: 6, // Small elements
  base: 8, // Default
  md: 12, // Cards
  lg: 16, // Large cards
  xl: 24, // Hero sections
  "2xl": 32, // Feature cards
  pill: 999, // Fully rounded
} as const;

export type RadiusToken = keyof typeof radii;

/**
 * Systematic 8pt spacing scale with gentle progression.
 *
 * Usage:
 * - 0-2: Internal component padding
 * - 3-6: Component gaps
 * - 7-10: Section spacing
 * - 12-16: Page-level spacing
 */
const spacingUnit = 8;

export type SpacingStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 10 | 12 | 14 | 16;

export const spacingScale: Record<SpacingStep, number> = {
  0: 0, // 0px
  1: 8, // 8px
  2: 16, // 16px
  3: 24, // 24px
  4: 32, // 32px
  5: 40, // 40px
  6: 48, // 48px
  7: 56, // 56px
  8: 64, // 64px
  10: 80, // 80px
  12: 96, // 96px
  14: 112, // 112px
  16: 128, // 128px
};

/**
 * Returns spacing based on the 8px baseline grid.
 * Accepts predefined steps or arbitrary multipliers for finer control.
 */
export function spacing(step: SpacingStep | number): number {
  if (step in spacingScale) {
    return spacingScale[step as SpacingStep];
  }

  return step * spacingUnit;
}

/**
 * Typography scale - neutral and balanced for dashboards and forms.
 */
export const typography = {
  fontFamily: {
    sans: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    mono: "JetBrains Mono, Menlo, Monaco, 'Courier New', monospace",
  },
  fontSize: {
    xs: 13, // Labels and helper text
    sm: 15, // Secondary text
    base: 16, // Body copy
    lg: 18, // Emphasis text
    xl: 22, // Section titles
    "2xl": 28, // Page titles
    "3xl": 34, // Hero headings
    "4xl": 42, // Prominent numbers
    "5xl": 54, // Display
  },
  lineHeight: {
    none: 1,
    tight: 1.2, // Headlines
    snug: 1.35, // Captions
    normal: 1.55, // Body text
    relaxed: 1.8, // Loose paragraphs
  },
  fontWeight: {
    normal: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },
  letterSpacing: {
    dense: "-0.01em",
    tight: "-0.005em",
    normal: "0",
    wide: "0.01em",
  },
} as const;

export type TypographyToken = typeof typography;

/**
 * Minimal shadow system for Atlas UI.
 *
 * Replaces heavy glassmorphism with subtle depth.
 */
export interface ShadowPreset {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

export const shadowPresets: Record<"sm" | "base" | "md" | "lg" | "xl", ShadowPreset> = {
  sm: {
    shadowColor: "rgb(0, 0, 0)",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  base: {
    shadowColor: "rgb(0, 0, 0)",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: "rgb(0, 0, 0)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: "rgb(0, 0, 0)",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 8,
  },
  xl: {
    shadowColor: "rgb(0, 0, 0)",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.1,
    shadowRadius: 25,
    elevation: 16,
  },
};

export type ShadowPresetName = keyof typeof shadowPresets;

/**
 * Subdued gradient tokens for softly lit surfaces.
 */
export const gradients = {
  skyGlass: [
    "linear-gradient(135deg, rgba(14,165,233,0.14) 0%",
    "rgba(59,130,246,0.12) 40%",
    "rgba(226,232,240,0.4) 100%)",
  ].join(", "),
  sandMist: [
    "linear-gradient(135deg, rgba(250,212,1,0.12) 0%",
    "rgba(253,244,191,0.35) 55%",
    "rgba(232,234,237,0.4) 100%)",
  ].join(", "),
  forestHaze: [
    "linear-gradient(135deg, rgba(34,197,94,0.12) 0%",
    "rgba(16,185,129,0.12) 50%",
    "rgba(232,234,237,0.3) 100%)",
  ].join(", "),
  slateSheen: [
    "linear-gradient(135deg, rgba(148,163,184,0.24) 0%",
    "rgba(226,232,240,0.35) 100%)",
  ].join(", "),
} as const;

export type GradientToken = keyof typeof gradients;

/**
 * Animation tokens for consistent motion.
 *
 * All durations support prefers-reduced-motion.
 */
export const animation = {
  duration: {
    fast: 100, // Quick feedback
    normal: 150, // Standard transitions
    slow: 200, // Deliberate animations
  },
  easing: {
    standard: [0.4, 0, 0.2, 1] as const,
    accelerate: [0.4, 0, 1, 1] as const,
    decelerate: [0, 0, 0.2, 1] as const,
  },
} as const;

export type AnimationToken = typeof animation;
