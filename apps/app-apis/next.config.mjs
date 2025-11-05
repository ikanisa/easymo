import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { version: appVersion } = require("./package.json");

const config = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  experimental: {
    instrumentationHook: true,
  },
  env: {
    APP_VERSION: appVersion,
  },
};

export default config;
