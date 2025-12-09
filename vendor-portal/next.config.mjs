import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import PWA configuration conditionally
let withPWA = (config) => config;
try {
  const pwaModule = await import("./next.config.pwa.mjs");
  withPWA = pwaModule.default;
} catch {
  // PWA config not available, continue without it
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  // Ensure output tracing resolves from the monorepo root
  outputFileTracingRoot: path.join(__dirname, "../../.."),
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
  // TypeScript configuration - conditionally ignore based on CI environment
  // When CI="true" is set in Netlify, type checking will be enforced
  // TODO: Fix database schema type errors before enabling CI="true" in netlify.toml
  typescript: {
    ignoreBuildErrors: process.env.CI !== "true",
  },
  // ESLint configuration - conditionally ignore based on CI environment
  eslint: {
    ignoreDuringBuilds: process.env.CI !== "true",
  },
  // Experimental optimizations for package imports
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@headlessui/react",
      "framer-motion",
    ],
  },
  // Webpack fallbacks for node: protocol and edge runtime
  webpack: (config, { isServer, webpack }) => {
    // Handle node: protocol imports
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
        resource.request = resource.request.replace(/^node:/, "");
      })
    );

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: false,
        fs: false,
        net: false,
        tls: false,
        async_hooks: false,
      };
    }

    const suppressedWarnings = [
      /Critical dependency: the request of a dependency is an expression/,
      /Critical dependency: require function is used in a way in which dependencies cannot be statically extracted/,
    ];
    config.ignoreWarnings = [...(config.ignoreWarnings ?? []), ...suppressedWarnings];

    return config;
  },
};

export default withPWA(nextConfig);
