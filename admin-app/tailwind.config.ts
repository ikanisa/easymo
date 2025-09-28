import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    './styles/**/*.css',
    './docs/**/*.{md,mdx}'
  ],
  darkMode: 'class',
  theme: {
    screens: {
      xs: '360px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px'
    },
    extend: {
      colors: {
        background: 'var(--color-background)',
        foreground: 'var(--color-foreground)',
        surface: 'var(--color-surface)',
        'surface-muted': 'var(--color-surface-muted)',
        border: 'var(--color-border)',
        accent: 'var(--color-accent)',
        'accent-foreground': 'var(--color-accent-foreground)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        danger: 'var(--color-danger)',
        muted: 'var(--color-muted)',
        outline: 'var(--color-outline)'
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'monospace']
      },
      spacing: {
        13: '3.25rem',
        15: '3.75rem',
        18: '4.5rem'
      },
      borderRadius: {
        xl: '1.25rem',
        '2xl': '1.75rem',
        pill: '999px'
      },
      boxShadow: {
        glass: '0 24px 60px rgba(15, 23, 42, 0.18)',
        glow: '0 0 60px rgba(14, 165, 233, 0.35)'
      },
      backdropBlur: {
        xs: '6px',
        md: '12px',
        xl: '24px'
      },
      animation: {
        'fade-in': 'fadeIn 180ms ease-out',
        'slide-up': 'slideUp 220ms ease-out',
        'shimmer-slow': 'shimmer 3s ease-in-out infinite'
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' }
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        }
      },
      gradientColorStops: {
        'primary-start': 'var(--gradient-primary-start)',
        'primary-end': 'var(--gradient-primary-end)',
        'secondary-start': 'var(--gradient-secondary-start)',
        'secondary-end': 'var(--gradient-secondary-end)'
      }
    }
  },
  plugins: []
};

export default config;
