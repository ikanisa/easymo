/**
 * PWA Configuration for Next.js
 * This file configures next-pwa with Workbox for advanced caching strategies
 */

import nextPWA from "next-pwa";

const withPWA = nextPWA({
  dest: "public",
  // Ensure our custom TS worker is compiled and emitted at this path
  sw: "service-worker.js",
  swSrc: "workers/service-worker.ts",
  register: true,
  skipWaiting: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  buildExcludes: [/middleware-manifest\.json$/, /build-manifest\.json$/],
  publicExcludes: ["!robots.txt", "!sitemap.xml", "!screenshots/*"],
  fallbacks: {
    document: "/offline",
  },
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [
      // Supabase storage cache
      {
        urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
        handler: "CacheFirst",
        options: {
          cacheName: "supabase-storage-cache",
          expiration: {
            maxEntries: 64,
            maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      // Supabase auth and API
      {
        urlPattern: /^https:\/\/.*\.supabase\.co\/auth\/.*/i,
        handler: "NetworkFirst",
        options: {
          cacheName: "supabase-auth-cache",
          networkTimeoutSeconds: 10,
          expiration: {
            maxEntries: 16,
            maxAgeSeconds: 60 * 60, // 1 hour
          },
        },
      },
      // Google Fonts
      {
        urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
        handler: "CacheFirst",
        options: {
          cacheName: "google-fonts-cache",
          expiration: {
            maxEntries: 10,
            maxAgeSeconds: 60 * 60 * 24 * 365, // 365 days
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      // Font files
      {
        urlPattern: /\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "static-font-assets",
          expiration: {
            maxEntries: 8,
            maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      // Image assets
      {
        urlPattern: /\.(?:jpg|jpeg|gif|png|svg|ico|webp|avif)$/i,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "static-image-assets",
          expiration: {
            maxEntries: 128,
            maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      // Next.js data files
      {
        urlPattern: /\/_next\/data\/.+\/.+\.json$/i,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "next-data",
          expiration: {
            maxEntries: 64,
            maxAgeSeconds: 60 * 60, // 1 hour
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      // Static data files
      {
        urlPattern: /\.(?:json|xml|csv)$/i,
        handler: "NetworkFirst",
        options: {
          cacheName: "static-data-assets",
          networkTimeoutSeconds: 10,
          expiration: {
            maxEntries: 32,
            maxAgeSeconds: 60 * 60, // 1 hour
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      // Static resources
      {
        urlPattern: /\.(?:js|css)$/i,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "static-resources",
          expiration: {
            maxEntries: 64,
            maxAgeSeconds: 60 * 60 * 24, // 24 hours
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      // API routes - NetworkFirst for freshness
      {
        urlPattern: /^\/api\/.*/i,
        handler: "NetworkFirst",
        options: {
          cacheName: "api-cache",
          networkTimeoutSeconds: 10,
          expiration: {
            maxEntries: 32,
            maxAgeSeconds: 60 * 5, // 5 minutes
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
    ],
  },
});

export default withPWA;
