export const COLOR_TOKENS = {
  background: 'var(--color-background)',
  foreground: 'var(--color-foreground)',
  surface: 'var(--color-surface)',
  surfaceMuted: 'var(--color-surface-muted)',
  border: 'var(--color-border)',
  accent: 'var(--color-accent)',
  accentForeground: 'var(--color-accent-foreground)',
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-danger)',
  muted: 'var(--color-muted)',
  outline: 'var(--color-outline)'
} as const;

export const GRADIENT_TOKENS = {
  primary: 'linear-gradient(135deg, var(--gradient-primary-start), var(--gradient-primary-end))',
  secondary: 'linear-gradient(135deg, var(--gradient-secondary-start), var(--gradient-secondary-end))',
  surface: 'linear-gradient(160deg, var(--gradient-surface-start), var(--gradient-surface-end))'
} as const;

export const RADIUS_TOKENS = {
  sm: '0.625rem',
  md: '0.875rem',
  lg: '1.25rem',
  xl: '1.75rem',
  pill: '999px'
} as const;

export const ELEVATION_TOKENS = {
  low: 'var(--elevation-low)',
  medium: 'var(--elevation-medium)',
  high: 'var(--elevation-high)'
} as const;

export const SPACING_TOKENS = {
  xs: '0.5rem',
  sm: '0.75rem',
  md: '1rem',
  lg: '1.5rem',
  xl: '2rem',
  '2xl': '2.5rem',
  '3xl': '3rem'
} as const;

export const Z_INDEX_TOKENS = {
  base: 1,
  overlay: 10,
  popover: 20,
  toast: 30,
  modal: 40,
  max: 50
} as const;

export const TRANSITION_TOKENS = {
  durationFast: 150,
  durationMedium: 220,
  durationSlow: 340,
  easingStandard: 'cubic-bezier(0.16, 1, 0.3, 1)',
  easingEntrance: 'cubic-bezier(0.24, 0.82, 0.25, 1)',
  easingExit: 'cubic-bezier(0.4, 0, 1, 1)'
} as const;

export type ColorTokenKey = keyof typeof COLOR_TOKENS;
export type GradientTokenKey = keyof typeof GRADIENT_TOKENS;

export function cssVar(token: string) {
  return `var(--${token})`;
}
