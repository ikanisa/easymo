import { defineConfig, mergeConfig, type UserConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const baseConfig: UserConfig = {
  test: {
    environment: "node",
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test",
      SUPABASE_SERVICE_ROLE_KEY: "test",
      BACKUP_PEPPER: "test",
      MFA_SESSION_SECRET: "test",
      TRUSTED_COOKIE_SECRET: "test",
      OPENAI_API_KEY: "test",
      HMAC_SHARED_SECRET: "test",
      KMS_DATA_KEY: "MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI=",
    },
    include: ["tests/**/*.{test,spec}.{ts,tsx}", "src/**/*.{test,spec}.{ts,tsx}"],
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      "@ibimina/config": path.resolve(__dirname, "./src/index.ts"),
    },
  },
};

export function withVitestBase(overrides: UserConfig = {}) {
  return defineConfig(mergeConfig(baseConfig, overrides));
}

export function createPackageVitestConfig(metaUrl: string, overrides: UserConfig = {}) {
  const packageRoot = path.dirname(fileURLToPath(metaUrl));

  return withVitestBase(
    mergeConfig(
      {
        root: packageRoot,
      },
      overrides
    )
  );
}

export default withVitestBase();
