import { defineConfig, devices } from "@playwright/test";

const isRemote = process.env.PLAYWRIGHT_REMOTE === "1";
const baseURL =
  process.env.PLAYWRIGHT_REMOTE_BASE_URL ??
  process.env.PLAYWRIGHT_BASE_URL ??
  "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90_000,
  expect: {
    timeout: 10_000,
  },
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { outputFolder: ".reports/playwright", open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: isRemote
    ? undefined
    : {
        command: [
          `AUTH_E2E_STUB=1`,
          `ADMIN_USE_STANDALONE_START=1`,
          `NEXT_PUBLIC_E2E=1`,
          `E2E_USE_DEV=${process.env.E2E_USE_DEV ?? "1"}`,
          `NEXT_PUBLIC_SUPABASE_URL=${process.env.PLAYWRIGHT_SUPABASE_URL ?? "http://127.0.0.1:54321"}`,
          `NEXT_PUBLIC_SUPABASE_ANON_KEY=${process.env.PLAYWRIGHT_SUPABASE_ANON_KEY ?? "stub-anon-key"}`,
          `SUPABASE_SERVICE_ROLE_KEY=${process.env.PLAYWRIGHT_SUPABASE_SERVICE_ROLE_KEY ?? "stub-service-role-key"}`,
          `HMAC_SHARED_SECRET=${process.env.PLAYWRIGHT_HMAC_SHARED_SECRET ?? "stub-hmac-secret"}`,
          `OPENAI_API_KEY=${process.env.PLAYWRIGHT_OPENAI_API_KEY ?? "stub-openai-key"}`,
          `HOSTNAME=${process.env.PLAYWRIGHT_HOST ?? "127.0.0.1"}`,
          `PORT=${process.env.PLAYWRIGHT_PORT ?? "3100"}`,
          "pnpm",
          "run",
          "start:e2e",
        ].join(" "),
        url: "http://127.0.0.1:3100",
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
