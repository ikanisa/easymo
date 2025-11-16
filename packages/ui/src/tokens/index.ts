import type { CSSProperties } from "react";

type TokenDictionary<T extends Record<string, string>> = {
  readonly [K in keyof T]: T[K];
};

type NestedTokenDictionary<T extends Record<string, Record<string, string>>> = {
  readonly [K in keyof T]: TokenDictionary<T[K]>;
};

export const colors = {
  background: "#070B1A",
  foreground: "#F8FAFC",
  surface: "#0F172A",
  surfaceMuted: "#1E293B",
  surfaceElevated: "#111C34",
  border: "rgba(148, 163, 184, 0.28)",
  borderStrong: "rgba(148, 163, 184, 0.45)",
  accent: "#38BDF8",
  accentForeground: "#04111F",
  success: "#22C55E",
  warning: "#FACC15",
  danger: "#F87171",
  info: "#60A5FA",
  muted: "#CBD5F5",
  outline: "rgba(56, 189, 248, 0.55)",
  focus: "rgba(14, 165, 233, 0.45)",
  overlay: "rgba(7, 11, 26, 0.82)",
  scrim: "rgba(6, 11, 25, 0.68)",
} as const satisfies TokenDictionary<Record<string, string>>;

export const typography = {
  families: {
    sans: '"Manrope", "Inter", system-ui, -apple-system, "Segoe UI", sans-serif',
    mono: '"JetBrains Mono", "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },
  sizes: {
    xs: "0.75rem",
    sm: "0.875rem",
    md: "1rem",
    lg: "1.125rem",
    xl: "1.25rem",
    "2xl": "1.5rem",
    "3xl": "1.875rem",
  },
  lineHeights: {
    tight: "1.2",
    snug: "1.35",
    normal: "1.5",
    relaxed: "1.65",
  },
  tracking: {
    tight: "-0.01em",
    normal: "0",
    wide: "0.08em",
  },
  weights: {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },
} as const satisfies NestedTokenDictionary<Record<string, Record<string, string>>>;

export const spacing = {
  0: "0px",
  0.5: "0.125rem",
  1: "0.25rem",
  1.5: "0.375rem",
  2: "0.5rem",
  2.5: "0.625rem",
  3: "0.75rem",
  3.5: "0.875rem",
  4: "1rem",
  5: "1.25rem",
  6: "1.5rem",
  7: "1.75rem",
  8: "2rem",
  9: "2.25rem",
  10: "2.5rem",
  11: "2.75rem",
  12: "3rem",
  14: "3.5rem",
  16: "4rem",
  20: "5rem",
  24: "6rem",
  28: "7rem",
  32: "8rem",
  36: "9rem",
  40: "10rem",
  48: "12rem",
  56: "14rem",
  64: "16rem",
  72: "18rem",
  80: "20rem",
  96: "24rem",
} as const satisfies TokenDictionary<Record<string, string>>;

export const radii = {
  none: "0px",
  xs: "0.25rem",
  sm: "0.5rem",
  md: "0.75rem",
  lg: "1rem",
  xl: "1.5rem",
  xxl: "2rem",
  pill: "999px",
} as const satisfies TokenDictionary<Record<string, string>>;

export const glass = {
  blur: "20px",
  frostBlur: "32px",
  border: "1px solid rgba(148, 163, 184, 0.25)",
  tint: "linear-gradient(135deg, rgba(7, 11, 26, 0.62), rgba(7, 11, 26, 0.35))",
  highlight: "rgba(255, 255, 255, 0.08)",
  shadow: "0 24px 60px rgba(7, 11, 26, 0.32)",
} as const satisfies TokenDictionary<Record<string, string>>;

export const layout = {
  shellMaxWidth: "1200px",
  shellGutter: "1.5rem",
  shellSidebarWidth: "18rem",
  shellHeaderHeight: "3.5rem",
} as const satisfies TokenDictionary<Record<string, string>>;

export const effects = {
  focusRingWidth: "2px",
  focusRingOffset: "2px",
  focusRingColor: "rgba(56, 189, 248, 0.55)",
  elevationLow: "0 1px 2px rgba(7, 11, 26, 0.2)",
  elevationMedium: "0 20px 60px rgba(7, 11, 26, 0.28)",
} as const satisfies TokenDictionary<Record<string, string>>;

export const motion = {
  durations: {
    instant: "90ms",
    fast: "160ms",
    medium: "240ms",
    slow: "360ms",
  },
  easing: {
    standard: "cubic-bezier(0.2, 0, 0, 1)",
    emphasized: "cubic-bezier(0.34, 0.7, 0, 1)",
    decelerate: "cubic-bezier(0, 0, 0.2, 1)",
    accelerate: "cubic-bezier(0.5, 0, 0.7, 0.2)",
  },
} as const satisfies NestedTokenDictionary<Record<string, Record<string, string>>>;

export const tokens = {
  colors,
  typography,
  spacing,
  radii,
  glass,
  layout,
  effects,
  motion,
};

type TokenEntries = Array<[string, string]>;

function kebabCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[_\s]+/g, "-")
    .toLowerCase();
}

function flattenEntries(): TokenEntries {
  const entries: TokenEntries = [];

  const pushSimpleRecord = (prefix: string, record: Record<string, string>) => {
    Object.entries(record).forEach(([key, value]) => {
      entries.push([`--ui-${prefix}-${kebabCase(String(key))}`, value]);
    });
  };

  pushSimpleRecord("color", colors);

  Object.entries(typography).forEach(([groupKey, group]) => {
    Object.entries(group).forEach(([key, value]) => {
      entries.push([`--ui-typography-${kebabCase(groupKey)}-${kebabCase(String(key))}`, value]);
    });
  });

  Object.entries(spacing).forEach(([key, value]) => {
    const normalisedKey = kebabCase(String(key).replace(".", "-"));
    entries.push([`--ui-space-${normalisedKey}`, value]);
  });

  pushSimpleRecord("radius", radii);
  pushSimpleRecord("glass", glass);
  // Layout tokens: flatten as --ui-shell-max-width, --ui-shell-gutter, etc.
  Object.entries(layout).forEach(([groupKey, group]) => {
    Object.entries(group).forEach(([key, value]) => {
      entries.push([`--ui-${kebabCase(String(groupKey))}-${kebabCase(String(key))}`, value]);
    });
  });
  // Effects tokens: flatten as --ui-focus-ring-width, --ui-elevation-low, etc.
  Object.entries(effects).forEach(([key, value]) => {
    entries.push([`--ui-${kebabCase(String(key))}`, value]);
  });

  Object.entries(motion).forEach(([groupKey, group]) => {
    Object.entries(group).forEach(([key, value]) => {
      entries.push([`--ui-motion-${kebabCase(groupKey)}-${kebabCase(String(key))}`, value]);
    });
  });

  return entries;
}

const variableEntries = flattenEntries();

export const cssVariableMap: Record<string, string> = Object.fromEntries(variableEntries);

export function buildCssVariables(selector = ":root"): string {
  const lines = variableEntries.map(([name, value]) => `  ${name}: ${value};`);
  return `${selector} {\n${lines.join("\n")}\n}`;
}

export const cssVariables = buildCssVariables();

export function assignCssVariables(target: HTMLElement = document.documentElement, options?: {
  /** Additional inline style overrides to merge with the token variables. */
  overrides?: Partial<CSSProperties>;
}): void {
  variableEntries.forEach(([name, value]) => {
    target.style.setProperty(name, value);
  });

  if (options?.overrides) {
    Object.entries(options.overrides).forEach(([name, value]) => {
      if (value == null) return;
      target.style.setProperty(name, String(value));
    });
  }
}

export type ColorTokenName = keyof typeof colors;
export type FontFamilyName = keyof typeof typography.families;
export type FontSizeName = keyof typeof typography.sizes;
export type SpacingScale = keyof typeof spacing;
export type RadiusScale = keyof typeof radii;
export type GlassTokenName = keyof typeof glass;
