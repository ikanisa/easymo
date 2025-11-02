import type { Config } from "tailwindcss";

type Primitive = string | number;

type TokenValue = Primitive | TokenGroup;

interface TokenGroup {
  [key: string]: TokenValue;
}

type TokenRecord = TokenGroup;

type TokenAccumulator = Record<string, Primitive>;

type TailwindColors = Record<string, unknown>;

export const colors = {
  primary: {
    50: "240 249 255",
    100: "224 242 254",
    200: "186 230 253",
    300: "125 211 252",
    400: "56 189 248",
    500: "14 165 233",
    600: "2 132 199",
    700: "3 105 161",
    800: "7 89 133",
    900: "12 74 110",
  },
  accent: {
    50: "240 248 255",
    100: "224 232 255",
    200: "192 210 255",
    300: "165 180 252",
    400: "129 140 248",
    500: "99 102 241",
    600: "79 70 229",
    700: "67 56 202",
    800: "55 48 163",
    900: "49 46 129",
  },
  success: {
    100: "240 253 244",
    300: "134 239 172",
    500: "34 197 94",
    700: "21 128 61",
  },
  warning: {
    100: "255 247 237",
    300: "253 186 116",
    500: "249 115 22",
    700: "194 65 12",
  },
  danger: {
    100: "254 242 242",
    300: "252 165 165",
    500: "239 68 68",
    700: "185 28 28",
  },
  neutral: {
    50: "248 250 252",
    100: "241 245 249",
    200: "226 232 240",
    300: "203 213 225",
    400: "148 163 184",
    500: "100 116 139",
    600: "71 85 105",
    700: "51 65 85",
    800: "30 41 59",
    900: "15 23 42",
  },
} as const;

export const typography = {
  fonts: {
    sans: "'Inter', 'system-ui', 'Segoe UI', sans-serif",
    display: "'Sora', 'Inter', 'system-ui', sans-serif",
    mono: "'JetBrains Mono', 'SFMono-Regular', Menlo, monospace",
  },
  sizes: {
    xs: { fontSize: "0.75rem", lineHeight: "1.15" },
    sm: { fontSize: "0.875rem", lineHeight: "1.3" },
    base: { fontSize: "1rem", lineHeight: "1.5" },
    lg: { fontSize: "1.125rem", lineHeight: "1.55" },
    xl: { fontSize: "1.25rem", lineHeight: "1.6" },
    "2xl": { fontSize: "1.5rem", lineHeight: "1.6" },
    "3xl": { fontSize: "1.875rem", lineHeight: "1.4" },
  },
  weights: {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },
} as const;

export const spacing = {
  none: "0px",
  1: "0.25rem",
  2: "0.5rem",
  3: "0.75rem",
  4: "1rem",
  5: "1.25rem",
  6: "1.5rem",
  8: "2rem",
  10: "2.5rem",
  12: "3rem",
  16: "4rem",
  20: "5rem",
  24: "6rem",
  32: "8rem",
  40: "10rem",
} as const;

export const radii = {
  none: "0px",
  xs: "0.25rem",
  sm: "0.375rem",
  md: "0.5rem",
  lg: "0.75rem",
  xl: "1rem",
  "2xl": "1.5rem",
  pill: "999px",
} as const;

export const glass = {
  frosted: {
    background: "rgba(255, 255, 255, 0.75)",
    border: "1px solid rgba(148, 163, 184, 0.25)",
    shadow: "0 24px 60px rgba(15, 23, 42, 0.18)",
    backdropFilter: "blur(20px)",
  },
  subtle: {
    background: "rgba(15, 23, 42, 0.65)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    shadow: "0 20px 50px rgba(15, 23, 42, 0.22)",
    backdropFilter: "blur(24px)",
  },
} as const;

export const tokens = {
  colors,
  typography,
  spacing,
  radii,
  glass,
} as const;

export type EasymoTokens = typeof tokens;

export type EasymoColorScale = keyof typeof colors;

const TOKEN_PREFIX = "--easymo";

function flattenTokens(prefix: string, record: TokenRecord): TokenAccumulator {
  return Object.entries(record).reduce<TokenAccumulator>((acc, [key, value]) => {
    const tokenKey = `${prefix}-${key}`;
    if (typeof value === "string" || typeof value === "number") {
      acc[tokenKey] = value;
      return acc;
    }
    Object.assign(acc, flattenTokens(tokenKey, value));
    return acc;
  }, {});
}

function formatCssVariables(vars: TokenAccumulator) {
  const body = Object.entries(vars)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join("\n");
  return `:root {\n${body}\n}`;
}

export const cssVariableMap = flattenTokens(`${TOKEN_PREFIX}`, tokens satisfies TokenRecord);

export const cssVariableSheet = formatCssVariables(cssVariableMap);

function withColorVariables(record: typeof colors): TailwindColors {
  return Object.fromEntries(
    Object.entries(record).map(([token, entries]) => [
      token,
      Object.fromEntries(
        Object.entries(entries).map(([scale, value]) => [
          scale,
          `hsl(var(${TOKEN_PREFIX}-colors-${token}-${scale}) / <alpha-value>)`,
        ]),
      ),
    ]),
  );
}

export const tailwindPreset: Config = {
  content: [],
  theme: {
    extend: {
      colors: {
        ...withColorVariables(colors),
        surface: `rgba(var(${TOKEN_PREFIX}-colors-neutral-50) / 0.82)`,
        "surface-muted": `rgba(var(${TOKEN_PREFIX}-colors-neutral-50) / 0.65)`,
        outline: `rgba(var(${TOKEN_PREFIX}-colors-primary-400) / 0.4)`,
      },
      fontFamily: {
        sans: [`var(${TOKEN_PREFIX}-typography-fonts-sans)`],
        display: [`var(${TOKEN_PREFIX}-typography-fonts-display)`],
        mono: [`var(${TOKEN_PREFIX}-typography-fonts-mono)`],
      },
      fontSize: Object.fromEntries(
        Object.entries(typography.sizes).map(([key, value]) => [
          key,
          [
            `var(${TOKEN_PREFIX}-typography-sizes-${key}-fontSize)`,
            { lineHeight: `var(${TOKEN_PREFIX}-typography-sizes-${key}-lineHeight)` },
          ],
        ]),
      ),
      spacing: Object.fromEntries(
        Object.keys(spacing).map((key) => [
          key,
          `var(${TOKEN_PREFIX}-spacing-${key})`,
        ]),
      ),
      borderRadius: Object.fromEntries(
        Object.keys(radii).map((key) => [
          key,
          `var(${TOKEN_PREFIX}-radii-${key})`,
        ]),
      ),
      boxShadow: {
        glass: `var(${TOKEN_PREFIX}-glass-frosted-shadow)`,
        "glass-subtle": `var(${TOKEN_PREFIX}-glass-subtle-shadow)`,
      },
      backdropFilter: {
        frosted: `var(${TOKEN_PREFIX}-glass-frosted-backdropFilter)`,
        subtle: `var(${TOKEN_PREFIX}-glass-subtle-backdropFilter)`,
      },
    },
  },
};

export function injectGlobalTokenStyles(target: Document | ShadowRoot = document) {
  if (typeof window === "undefined") {
    return;
  }

  const styleId = "easymo-token-sheet";
  const existing = target.getElementById?.(styleId);
  if (existing) return;

  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = cssVariableSheet;

  const parent = "head" in target ? target.head : target;
  parent.appendChild(style);
}

export default tokens;
