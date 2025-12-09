/**
 * Theme configuration for next-themes and Tailwind CSS
 * Defines the available themes and their value mappings
 */

export const nextThemeValueMap = {
  light: "light",
  dark: "dark",
  nyungwe: "nyungwe",
  "high-contrast": "high-contrast",
} as const;

export type ThemeName = keyof typeof nextThemeValueMap;

/**
 * Tailwind CSS design tokens
 * Provides theme configuration for Tailwind
 */
export const tailwindTokens = {
  screens: {
    sm: "640px",
    md: "768px",
    lg: "1024px",
    xl: "1280px",
    "2xl": "1536px",
  },
  colors: {
    // Primary colors
    primary: {
      50: "#eff6ff",
      100: "#dbeafe",
      200: "#bfdbfe",
      300: "#93c5fd",
      400: "#60a5fa",
      500: "#0ea5e9",
      600: "#0284c7",
      700: "#0369a1",
      800: "#075985",
      900: "#0c4a6e",
    },
    // Neutrals
    neutral: {
      0: "#FFFFFF",
      50: "#FAFAFA",
      100: "#F5F5F5",
      200: "#E5E5E5",
      300: "#D4D4D4",
      400: "#A3A3A3",
      500: "#737373",
      600: "#525252",
      700: "#404040",
      800: "#262626",
      900: "#171717",
      950: "#0A0A0A",
    },
    // Semantic colors
    success: {
      500: "#10b981",
      600: "#047857",
    },
    warning: {
      500: "#f59e0b",
      600: "#B45309",
    },
    danger: {
      500: "#ef4444",
      600: "#B91C1C",
    },
  },
  spacing: {
    0: "0px",
    1: "8px",
    2: "16px",
    3: "24px",
    4: "32px",
    5: "40px",
    6: "48px",
    7: "56px",
    8: "64px",
    10: "80px",
    12: "96px",
    14: "112px",
    16: "128px",
  },
  borderRadius: {
    sm: "6px",
    base: "8px",
    md: "12px",
    lg: "16px",
    xl: "24px",
    "2xl": "32px",
    pill: "999px",
  },
  boxShadow: {
    sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
    base: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
    md: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
    lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
    xl: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
  },
  fontFamily: {
    sans: [
      "Inter",
      "system-ui",
      "-apple-system",
      "BlinkMacSystemFont",
      "Segoe UI",
      "Roboto",
      "sans-serif",
    ],
    mono: ["JetBrains Mono", "Menlo", "Monaco", "Courier New", "monospace"],
  },
  fontSize: {
    xs: ["13px", { lineHeight: "1.5" }],
    sm: ["15px", { lineHeight: "1.5" }],
    base: ["16px", { lineHeight: "1.55" }],
    lg: ["18px", { lineHeight: "1.55" }],
    xl: ["22px", { lineHeight: "1.4" }],
    "2xl": ["28px", { lineHeight: "1.35" }],
    "3xl": ["34px", { lineHeight: "1.2" }],
    "4xl": ["42px", { lineHeight: "1.2" }],
  },
  transitionDuration: {
    fast: "100ms",
    normal: "150ms",
    slow: "200ms",
  },
  transitionTimingFunction: {
    standard: "cubic-bezier(0.4, 0, 0.2, 1)",
    accelerate: "cubic-bezier(0.4, 0, 1, 1)",
    decelerate: "cubic-bezier(0, 0, 0.2, 1)",
  },
} as const;
