// Build-time safety: disallow mocks in production builds.
if (
  process.env.NODE_ENV === 'production' &&
  String(process.env.NEXT_PUBLIC_USE_MOCKS || '').trim().toLowerCase() === 'true'
) {
  throw new Error('NEXT_PUBLIC_USE_MOCKS=true is not allowed in production builds.');
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compress: true, // Enable gzip compression
  poweredByHeader: false, // Remove unnecessary headers
  experimental: {
    typedRoutes: true,
    // instrumentationHook: true, // Disabled - causing edge runtime eval error
    serverComponentsExternalPackages: ['@easymo/commons'],
  },
  typescript: {
    ignoreBuildErrors: true,
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
    }
    return config;
  },
};

export default nextConfig;
