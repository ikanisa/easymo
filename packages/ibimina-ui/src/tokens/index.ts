/**
 * Design Tokens for SACCO+ Atlas UI
 * Based on comprehensive UI/UX audit
 * WCAG 2.2 AA compliant
 */

export const tokens = {
  colors: {
    // Neutral scale (primary) - WCAG AAcompliant
    neutral: {
      50: "#FAFAFA",
      100: "#F5F5F5",
      200: "#E5E5E5",
      300: "#D4D4D4",
      400: "#A3A3A3",
      500: "#737373",
      600: "#525252",
      700: "#404040", // Main text color - 7.0:1 contrast
      800: "#262626",
      900: "#171717",
      950: "#0A0A0A",
    },
    // Brand colors (strategic use only)
    brand: {
      blue: "#0EA5E9",
      "blue-dark": "#0284C7",
      "blue-darker": "#0369A1",
      yellow: "#FAD201",
      green: "#20603D",
    },
    // Semantic colors
    success: {
      50: "#F0FDF4",
      100: "#DCFCE7",
      500: "#10B981",
      600: "#059669",
      700: "#047857",
    },
    warning: {
      50: "#FFFBEB",
      100: "#FEF3C7",
      500: "#F59E0B",
      600: "#D97706",
      700: "#B45309",
    },
    error: {
      50: "#FEF2F2",
      100: "#FEE2E2",
      500: "#EF4444",
      600: "#DC2626",
      700: "#B91C1C",
    },
    info: {
      50: "#EFF6FF",
      100: "#DBEAFE",
      500: "#3B82F6",
      600: "#2563EB",
      700: "#1D4ED8",
    },
  },

  typography: {
    fontFamily: {
      sans: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      display: "Inter, system-ui, sans-serif",
      mono: '"JetBrains Mono", Menlo, Monaco, "Courier New", monospace',
    },
    fontSize: {
      xs: "0.75rem", // 12px
      sm: "0.875rem", // 14px
      base: "1rem", // 16px
      lg: "1.125rem", // 18px
      xl: "1.25rem", // 20px
      "2xl": "1.5rem", // 24px
      "3xl": "1.875rem", // 30px
      "4xl": "2.25rem", // 36px
      "5xl": "3rem", // 48px
      "6xl": "3.75rem", // 60px
      "7xl": "4.5rem", // 72px
    },
    lineHeight: {
      tight: "1.16",
      normal: "1.5",
      relaxed: "1.75",
    },
    fontWeight: {
      normal: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
    },
  },

  spacing: {
    0: "0",
    1: "0.25rem", // 4px
    2: "0.5rem", // 8px
    3: "0.75rem", // 12px
    4: "1rem", // 16px
    5: "1.25rem", // 20px
    6: "1.5rem", // 24px
    8: "2rem", // 32px
    10: "2.5rem", // 40px
    12: "3rem", // 48px
    16: "4rem", // 64px
    20: "5rem", // 80px
    24: "6rem", // 96px
    32: "8rem", // 128px
  },

  borderRadius: {
    none: "0",
    sm: "0.375rem", // 6px
    base: "0.5rem", // 8px
    md: "0.75rem", // 12px
    lg: "1rem", // 16px
    xl: "1.5rem", // 24px
    "2xl": "2rem", // 32px
    full: "9999px",
  },

  shadows: {
    sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    base: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
    md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
    xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
    "2xl": "0 25px 50px -12px rgb(0 0 0 / 0.25)",
    inner: "inset 0 2px 4px 0 rgb(0 0 0 / 0.05)",
    none: "none",
  },

  transitions: {
    duration: {
      fast: "150ms",
      base: "200ms",
      slow: "300ms",
      slower: "500ms",
    },
    timing: {
      ease: "ease",
      "ease-in": "ease-in",
      "ease-out": "ease-out",
      "ease-in-out": "ease-in-out",
      linear: "linear",
    },
  },

  zIndex: {
    dropdown: 1000,
    sticky: 1020,
    fixed: 1030,
    "modal-backdrop": 1040,
    modal: 1050,
    popover: 1060,
    tooltip: 1070,
  },
} as const;

export type Tokens = typeof tokens;
