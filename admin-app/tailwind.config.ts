import type { Config } from "tailwindcss";
// TODO: Fix @easymo/ui exports - temporarily disabled
// import { tailwindPreset } from "@easymo/ui/tokens/tailwind";

const config: Config = {
  // presets: [tailwindPreset],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./styles/**/*.css",
    "./docs/**/*.{md,mdx}",
  ],
  darkMode: "class",
  theme: {
    screens: {
      xs: "360px",
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
    },
    extend: {
      colors: {
        background: "var(--color-background)",
        foreground: "var(--color-foreground)",
        surface: "var(--color-surface)",
        "surface-muted": "var(--color-surface-muted)",
        border: "var(--color-border)",
        accent: "var(--color-accent)",
        "accent-foreground": "var(--color-accent-foreground)",
        success: "var(--color-success)",
        warning: "var(--color-warning)",
        danger: "var(--color-danger)",
        muted: "var(--color-muted)",
        outline: "var(--color-outline)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "monospace"],
      },
      spacing: {
        13: "3.25rem",
        15: "3.75rem",
        18: "4.5rem",
      },
      borderRadius: {
        xl: "1.25rem",
        "2xl": "1.75rem",
        pill: "999px",
      },
      boxShadow: {
        ambient: "var(--shadow-ambient)",
        floating: "var(--shadow-floating)",
        pressed: "var(--shadow-pressed)",
        ring: "var(--shadow-ring)",
        glow: "0 0 60px rgba(14, 165, 233, 0.35)",
      },
      backdropBlur: {
        xs: "6px",
        md: "12px",
        xl: "24px",
        soft: "var(--glass-blur-soft)",
        strong: "var(--glass-blur-strong)",
      },
      animation: {
        "fade-in": "fadeIn var(--motion-duration-fast) var(--motion-ease-decelerate) both",
        "slide-up": "slideUp var(--motion-duration-medium) var(--motion-ease-emphasized) both",
        "glass-pop": "glassPop var(--motion-duration-fast) var(--motion-ease-emphasized) both",
        "shimmer-slow": "shimmer 3s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0", transform: "translateY(6px) scale(0.995)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(18px) scale(0.98)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        glassPop: {
          "0%": { opacity: "0", transform: "translateY(12px) scale(0.96)" },
          "60%": { opacity: "1", transform: "translateY(-2px) scale(1.02)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      transitionTimingFunction: {
        standard: "var(--motion-ease-standard)",
        emphasized: "var(--motion-ease-emphasized)",
        accelerate: "var(--motion-ease-accelerate)",
        decelerate: "var(--motion-ease-decelerate)",
      },
      transitionDuration: {
        instant: "var(--motion-duration-instant)",
        fast: "var(--motion-duration-fast)",
        medium: "var(--motion-duration-medium)",
        slow: "var(--motion-duration-slow)",
      },
      gradientColorStops: {
        "primary-start": "var(--gradient-primary-start)",
        "primary-end": "var(--gradient-primary-end)",
        "secondary-start": "var(--gradient-secondary-start)",
        "secondary-end": "var(--gradient-secondary-end)",
      },
    },
  },
  plugins: [],
};

export default config;
