// Build-time safety: disallow mocks in production builds.
if (
  process.env.NODE_ENV === 'production' &&
  String(process.env.NEXT_PUBLIC_USE_MOCKS || '').trim().toLowerCase() === 'true'
) {
  throw new Error('NEXT_PUBLIC_USE_MOCKS=true is not allowed in production builds.');
}

import path from 'path';
import { fileURLToPath } from 'url';
import bundleAnalyzer from '@next/bundle-analyzer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const withBundleAnalyzer = bundleAnalyzer({
  enabled: String(process.env.ANALYZE || '').toLowerCase() === 'true',
});
const preferEdgeBundles = String(process.env.NEXT_EDGE_BUNDLE || '').toLowerCase() === 'true';
const enableOptimizedImports =
  String(process.env.NEXT_DISABLE_OPTIMIZED_IMPORTS || '').toLowerCase() !== 'true';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compress: true, // Enable gzip compression
  poweredByHeader: false, // Remove unnecessary headers
  experimental: {
    typedRoutes: true,
    optimizePackageImports: enableOptimizedImports
      ? ['@headlessui/react', '@heroicons/react', 'framer-motion']
      : undefined,
  },
  serverExternalPackages: ['@easymo/commons'],
  typescript: {
    // Keep enabled later after TS cleanup passes land
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Optimize for Chrome memory usage
  headers: async () => [
    {
      source: '/:path*',
      headers: [
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
        {
          key: 'X-Frame-Options',
          value: 'DENY',
        },
      ],
    },
  ],
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
      // Optimize chunk splitting for better caching
      config.optimization = {
        ...config.optimization,
        moduleIds: 'deterministic',
      };
    } else {
      // Server-side: exclude pino worker threads from bundling
      config.externals = config.externals || [];
      config.externals.push('pino', 'thread-stream', 'pino-pretty', 'pino-abstract-transport');
    }

    if (preferEdgeBundles) {
      config.resolve.conditionNames = Array.from(
        new Set([...(config.resolve.conditionNames ?? []), 'worker', 'browser'])
      );
      config.optimization = {
        ...config.optimization,
        usedExports: true,
        sideEffects: true,
      };
    }

    if (enableOptimizedImports) {
      config.module.generator = {
        ...config.module.generator,
        'asset/resource': { emit: true },
      };
    }
    return config;
  },
};

export default withBundleAnalyzer(nextConfig);
