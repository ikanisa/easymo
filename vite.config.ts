import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    // Phase 1 environment defaults
    'import.meta.env.VITE_USE_MOCK': JSON.stringify(process.env.VITE_USE_MOCK ?? '0'),
    'import.meta.env.VITE_DEV_TOOLS': JSON.stringify(process.env.VITE_DEV_TOOLS ?? '0'),
  },
  // Add test configuration for Vitest
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['easymo/**', 'node_modules/**'],
  },
}));
