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
  experimental: {
    typedRoutes: true,
    instrumentationHook: true,
    serverComponentsExternalPackages: ['@easymo/commons'],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        'async_hooks': false,
        'cls-hooked': false,
        'crypto': false,
      };
    }
    return config;
  },
};

export default nextConfig;
