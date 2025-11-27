import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#f9a825',
          foreground: '#0a0a0a',
        },
        background: '#0a0a0a',
        foreground: '#ffffff',
        card: '#141414',
        border: '#262626',
        muted: {
          DEFAULT: '#1f1f1f',
          foreground: '#a1a1a1',
        },
      },
      borderRadius: {
        lg: '1rem',
        md: '0.75rem',
        sm: '0.5rem',
      },
    },
  },
  plugins: [],
};

export default config;
