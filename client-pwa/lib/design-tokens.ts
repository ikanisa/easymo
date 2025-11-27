/**
 * EasyMO Client PWA Design Tokens
 * Dark-mode optimized for bar/restaurant environment
 */

export const colors = {
  primary: {
    50: '#fef3e2',
    100: '#fde4b9',
    200: '#fcd38c',
    300: '#fbc25f',
    400: '#fab53d',
    500: '#f9a825',
    600: '#f59100',
    700: '#ef6c00',
    800: '#e65100',
    900: '#d84315',
  },
  dark: {
    bg: {
      primary: '#0a0a0a',
      secondary: '#141414',
      tertiary: '#1f1f1f',
      elevated: '#262626',
    },
    text: {
      primary: '#ffffff',
      secondary: '#a1a1a1',
      muted: '#737373',
      inverse: '#0a0a0a',
    },
    border: {
      default: '#262626',
      subtle: '#1f1f1f',
      focus: '#f9a825',
    },
  },
  semantic: {
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
  },
} as const;

export const spacing = {
  safeAreaTop: 'env(safe-area-inset-top)',
  safeAreaBottom: 'env(safe-area-inset-bottom)',
  touchTarget: '44px',
  cardPadding: '16px',
  sectionGap: '24px',
} as const;

export const animation = {
  duration: {
    fast: '150ms',
    normal: '300ms',
    slow: '500ms',
  },
  easing: {
    default: 'cubic-bezier(0.4, 0, 0.2, 1)',
    spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  },
} as const;
