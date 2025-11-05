import type { Config } from "tailwindcss";
import { colors, spacing, radii, typography } from "./index";

const colorVariables = Object.fromEntries(
  Object.keys(colors).map((key) => [key, `var(--ui-color-${key.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)})`]),
);

const spacingVariables = Object.fromEntries(
  Object.keys(spacing).map((key) => [key, `var(--ui-space-${key.replace('.', '-')})`]),
);

const radiusVariables = Object.fromEntries(
  Object.keys(radii).map((key) => [key, `var(--ui-radius-${key.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)})`]),
);

const fontSizeVariables: Record<string, [string, Record<string, string>]> = {
  xs: [
    "var(--ui-typography-sizes-xs)",
    {
      lineHeight: "var(--ui-typography-line-heights-tight)",
      letterSpacing: "var(--ui-typography-tracking-wide)",
      fontWeight: "var(--ui-typography-weights-medium)",
    },
  ],
  sm: [
    "var(--ui-typography-sizes-sm)",
    {
      lineHeight: "var(--ui-typography-line-heights-snug)",
      letterSpacing: "var(--ui-typography-tracking-normal)",
      fontWeight: "var(--ui-typography-weights-medium)",
    },
  ],
  base: [
    "var(--ui-typography-sizes-md)",
    {
      lineHeight: "var(--ui-typography-line-heights-normal)",
      letterSpacing: "var(--ui-typography-tracking-normal)",
      fontWeight: "var(--ui-typography-weights-regular)",
    },
  ],
  lg: [
    "var(--ui-typography-sizes-lg)",
    {
      lineHeight: "var(--ui-typography-line-heights-relaxed)",
      letterSpacing: "var(--ui-typography-tracking-tight)",
      fontWeight: "var(--ui-typography-weights-semibold)",
    },
  ],
  xl: [
    "var(--ui-typography-sizes-xl)",
    {
      lineHeight: "var(--ui-typography-line-heights-relaxed)",
      letterSpacing: "var(--ui-typography-tracking-tight)",
      fontWeight: "var(--ui-typography-weights-semibold)",
    },
  ],
  "2xl": [
    "var(--ui-typography-sizes-2xl)",
    {
      lineHeight: "var(--ui-typography-line-heights-relaxed)",
      letterSpacing: "var(--ui-typography-tracking-tight)",
      fontWeight: "var(--ui-typography-weights-bold)",
    },
  ],
  "3xl": [
    "var(--ui-typography-sizes-3xl)",
    {
      lineHeight: "var(--ui-typography-line-heights-relaxed)",
      letterSpacing: "var(--ui-typography-tracking-tight)",
      fontWeight: "var(--ui-typography-weights-bold)",
    },
  ],
};

export const tailwindPreset: Config = {
  content: [],
  darkMode: ["class", "[data-ui-theme='dark']"],
  theme: {
    extend: {
      colors: colorVariables,
      spacing: spacingVariables,
      borderRadius: radiusVariables,
      fontSize: fontSizeVariables,
      fontFamily: {
        sans: `var(--ui-typography-families-sans)`,
        mono: `var(--ui-typography-families-mono)`,
      },
      boxShadow: {
        glass: "var(--ui-glass-shadow)",
        outline: "0 0 0 2px var(--ui-color-outline)",
      },
      backdropBlur: {
        glass: "var(--ui-glass-blur)",
        frost: "var(--ui-glass-frost-blur)",
      },
      backgroundImage: {
        "glass-tint": "var(--ui-glass-tint)",
      },
      borderColor: {
        glass: "var(--ui-glass-border)",
      },
      ringColor: {
        focus: "var(--ui-color-focus)",
      },
    },
  },
};

export type TailwindPreset = typeof tailwindPreset;
