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

// Detect environment for output mode
const isNetlify = process.env.NETLIFY === 'true';
const isTauri = !!process.env.TAURI_ENV_PLATFORM;

// Determine output mode based on environment
// - Tauri desktop app: undefined (uses default Next.js output)
// - Netlify deployment: undefined (works best with @netlify/plugin-nextjs)
// - Other deployments: standalone (for container/server deployments)
const getOutputMode = () => {
  if (isTauri || isNetlify) return undefined;
  return 'standalone';
};

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  
  // Output configuration for Netlify and Desktop
  output: getOutputMode(),
  
  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [360, 640, 768, 1024, 1280, 1536],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
  
  experimental: {
    typedRoutes: true,
    optimizePackageImports: enableOptimizedImports
      ? [
          '@headlessui/react',
          '@heroicons/react',
          'framer-motion',
          'lucide-react',
          '@radix-ui/react-slot',
        ]
      : undefined,
  },
  
  serverExternalPackages: ['@easymo/commons'],
  
  typescript: {
    ignoreBuildErrors: false,
  },
  
  eslint: {
    ignoreDuringBuilds: false,
  },
  
  // Security and performance headers
  headers: async () => [
    {
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-XSS-Protection', value: '1; mode=block' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
        { key: 'X-DNS-Prefetch-Control', value: 'on' },
      ],
    },
    // Service Worker headers
    {
      source: '/sw.js',
      headers: [
        { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
        { key: 'Service-Worker-Allowed', value: '/' },
      ],
    },
    {
      source: '/sw.v4.js',
      headers: [
        { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
        { key: 'Service-Worker-Allowed', value: '/' },
      ],
    },
    // Manifest headers
    {
      source: '/manifest.webmanifest',
      headers: [
        { key: 'Content-Type', value: 'application/manifest+json' },
        { key: 'Cache-Control', value: 'public, max-age=86400' },
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
      
      // Optimize chunk splitting for PWA
      config.optimization = {
        ...config.optimization,
        moduleIds: 'deterministic',
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
            },
            common: {
              minChunks: 2,
              priority: -10,
              reuseExistingChunk: true,
            },
          },
        },
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

    return config;
  },
};

export default withBundleAnalyzer(nextConfig);
