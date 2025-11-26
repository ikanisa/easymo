// Next.js configuration for Tauri desktop build
// This config enables static export for embedding in Tauri

import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  
  // Static export for Tauri
  output: 'export',
  distDir: 'out',
  trailingSlash: true,
  
  // Disable features not compatible with static export
  images: {
    unoptimized: true,
  },
  
  experimental: {
    typedRoutes: false, // Not compatible with static export
  },
  
  typescript: {
    ignoreBuildErrors: true,
  },
  
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  webpack: (config, { isServer }) => {
    // Force video-agent-schema to resolve from dist, not src
    config.resolve.alias = {
      ...config.resolve.alias,
      '@easymo/video-agent-schema': path.resolve(__dirname, '../packages/video-agent-schema/dist/index.js'),
    };
    
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        'async_hooks': false,
        'cls-hooked': false,
        'crypto': false,
      };
    } else {
      // Server-side: exclude pino worker threads from bundling
      config.externals = config.externals || [];
      config.externals.push('pino', 'thread-stream', 'pino-pretty', 'pino-abstract-transport');
    }

    return config;
  },
  
  // Environment variables for desktop build
  env: {
    NEXT_PUBLIC_IS_DESKTOP: 'true',
  },
};

export default nextConfig;
