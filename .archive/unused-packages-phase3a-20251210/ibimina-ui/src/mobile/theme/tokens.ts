export const mobileTheme = {
  colors: {
    surface: "rgba(255, 255, 255, 0.88)",
    surfaceAlt: "rgba(255, 255, 255, 0.74)",
    border: "rgba(255, 255, 255, 0.24)",
    overlay: "rgba(12, 22, 46, 0.18)",
    textPrimary: "#0B1020",
    textSecondary: "rgba(11, 16, 32, 0.68)",
    textMuted: "rgba(11, 16, 32, 0.48)",
    accentBlue: "#0066FF",
    accentYellow: "#FAD201",
    accentGreen: "#20603D",
    accentNeutral: "rgba(255, 255, 255, 0.6)",
    success: "#2DD4BF",
    chipSurface: "rgba(255, 255, 255, 0.16)",
    chipSurfaceActive: "rgba(0, 102, 255, 0.14)",
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  radii: {
    md: 12,
    lg: 18,
    xl: 24,
  },
  blur: {
    tint: "light" as const,
    intensity: 85,
  },
  shadow: {
    glass: {
      shadowColor: "#0B1020",
      shadowOpacity: 0.12,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 12 },
      elevation: 12,
    },
  },
  border: {
    width: 1,
    color: "rgba(255, 255, 255, 0.28)",
  },
  typography: {
    headingLg: {
      fontFamily: "System",
      fontSize: 24,
      lineHeight: 30,
      fontWeight: "700" as const,
    },
    headingSm: {
      fontFamily: "System",
      fontSize: 18,
      lineHeight: 24,
      fontWeight: "600" as const,
    },
    body: {
      fontFamily: "System",
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "500" as const,
    },
    caption: {
      fontFamily: "System",
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "500" as const,
    },
  },
} as const;

export type MobileTheme = typeof mobileTheme;

export const rwandaFlagGradient = [
  mobileTheme.colors.accentBlue,
  mobileTheme.colors.accentYellow,
  mobileTheme.colors.accentGreen,
] as const;
