/**
 * Bar Manager Design System
 * Professional, dark-mode optimized for low-light environments
 */

export const colors = {
  // Brand Colors
  brand: {
    primary: '#f9a825',      // Warm amber
    secondary: '#ff6b35',    // Energetic orange
    accent: '#00d9ff',       // Cyan accent
  },

  // Status Colors
  status: {
    success: '#10b981',      // Emerald
    warning: '#f59e0b',      // Amber
    error: '#ef4444',        // Red
    info: '#3b82f6',         // Blue
    pending: '#8b5cf6',      // Purple
  },

  // Order Status
  order: {
    new: '#3b82f6',          // Blue - New order
    preparing: '#f59e0b',    // Amber - In kitchen
    ready: '#10b981',        // Green - Ready to serve
    served: '#6b7280',       // Gray - Delivered
    cancelled: '#ef4444',    // Red - Cancelled
    paid: '#8b5cf6',         // Purple - Paid
  },

  // Table Status
  table: {
    available: '#10b981',    // Green
    occupied: '#f59e0b',     // Amber
    reserved: '#3b82f6',     // Blue
    dirty: '#ef4444',        // Red
    blocked: '#6b7280',      // Gray
  },

  // Dark Theme (Default)
  dark: {
    bg: {
      primary: '#09090b',    // zinc-950
      secondary: '#18181b',  // zinc-900
      tertiary: '#27272a',   // zinc-800
      elevated: '#3f3f46',   // zinc-700
      hover: '#52525b',      // zinc-600
    },
    text: {
      primary: '#fafafa',    // zinc-50
      secondary: '#a1a1aa',  // zinc-400
      muted: '#71717a',      // zinc-500
      disabled: '#52525b',   // zinc-600
    },
    border: {
      default: '#27272a',    // zinc-800
      subtle: '#3f3f46',     // zinc-700
      focus: '#f9a825',      // brand primary
    },
  },

  // Light Theme
  light: {
    bg: {
      primary: '#ffffff',
      secondary: '#fafafa',
      tertiary: '#f4f4f5',
      elevated: '#e4e4e7',
      hover: '#d4d4d8',
    },
    text: {
      primary: '#09090b',
      secondary: '#52525b',
      muted: '#71717a',
      disabled: '#a1a1aa',
    },
    border: {
      default: '#e4e4e7',
      subtle: '#f4f4f5',
      focus: '#f9a825',
    },
  },
} as const;

export const typography = {
  fontFamily: {
    sans: '"Inter Variable", "SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
    mono: '"JetBrains Mono", "SF Mono", "Fira Code", monospace',
    display: '"Cal Sans", "Inter Variable", sans-serif',
  },
  fontSize: {
    '2xs': '0.625rem',   // 10px
    xs: '0.75rem',       // 12px
    sm: '0.875rem',      // 14px
    base: '1rem',        // 16px
    lg: '1.125rem',      // 18px
    xl: '1.25rem',       // 20px
    '2xl': '1.5rem',     // 24px
    '3xl': '1.875rem',   // 30px
    '4xl': '2.25rem',    // 36px
    '5xl': '3rem',       // 48px
  },
} as const;

export const spacing = {
  sidebar: {
    collapsed: '64px',
    expanded: '280px',
  },
  header: '56px',
  panel: {
    sm: '320px',
    md: '400px',
    lg: '480px',
    xl: '640px',
  },
} as const;

export const animation = {
  duration: {
    instant: '50ms',
    fast: '150ms',
    normal: '250ms',
    slow: '400ms',
  },
  easing: {
    default: 'cubic-bezier(0.4, 0, 0.2, 1)',
    spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  },
} as const;

// Sound Effects
export const sounds = {
  newOrder: '/sounds/new-order.mp3',
  orderReady: '/sounds/order-ready.mp3',
  alert: '/sounds/alert.mp3',
  success: '/sounds/success.mp3',
  error: '/sounds/error.mp3',
  notification: '/sounds/notification.mp3',
  cashRegister: '/sounds/cash-register.mp3',
  timer: '/sounds/timer.mp3',
} as const;
