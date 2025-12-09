<<<<<<< HEAD
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
=======
import type { Config } from "tailwindcss";
import { tailwindTokens } from "./lib/theme";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./providers/**/*.{ts,tsx}"],
  theme: {
    screens: tailwindTokens.screens,
    extend: {
      colors: tailwindTokens.colors,
      spacing: tailwindTokens.spacing,
      borderRadius: tailwindTokens.borderRadius,
      boxShadow: tailwindTokens.boxShadow,
      fontFamily: tailwindTokens.fontFamily,
      fontSize: tailwindTokens.fontSize,
      transitionDuration: tailwindTokens.transitionDuration,
      transitionTimingFunction: tailwindTokens.transitionTimingFunction,
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200px 0" },
          "100%": { backgroundPosition: "200px 0" },
        },
        pulseFade: {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(0)" },
        },
        glow: {
          "0%, 100%": { boxShadow: "0 0 20px rgba(74, 112, 255, 0.3)" },
          "50%": { boxShadow: "0 0 30px rgba(74, 112, 255, 0.45)" },
        },
      },
      animation: {
        shimmer: "shimmer var(--motion-duration-400, 1.5s) infinite linear",
        pulseFade: "pulseFade 2.2s infinite ease-in-out",
        "fade-in": "fade-in var(--motion-duration-200, 0.3s) ease-out",
        "slide-in": "slide-in var(--motion-duration-200, 0.3s) ease-out",
        glow: "glow 2s ease-in-out infinite",
>>>>>>> feature/location-caching-and-mobility-deep-review
      },
    },
  },
  plugins: [],
};

export default config;
