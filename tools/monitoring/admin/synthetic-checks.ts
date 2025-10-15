#!/usr/bin/env -S deno run --allow-env --allow-net
/**
 * Lightweight synthetic checks for critical Admin APIs.
 *
 * Usage:
 *   ADMIN_BASE_URL=https://admin.example.com \
 *   ADMIN_API_TOKEN=xyz \
 *   deno run --allow-env --allow-net tools/monitoring/admin/synthetic-checks.ts
 *
 * The script reports non-2xx/3xx responses or network failures and exits with
 * code 1 so it can be wired into cron/GitHub Actions.
 */

type EndpointCheck = {
  path: string;
  method?: string;
  expectBody?: boolean;
};

const baseUrl = Deno.env.get("ADMIN_BASE_URL");
if (!baseUrl) {
  console.error("Missing ADMIN_BASE_URL environment variable.");
  Deno.exit(1);
}

const token = Deno.env.get("ADMIN_API_TOKEN");

const endpoints: EndpointCheck[] = [
  { path: "/api/orders?limit=1" },
  { path: "/api/notifications/retry", method: "POST", expectBody: true },
  { path: "/api/notifications?limit=1" },
  { path: "/api/menus?limit=1" },
  { path: "/api/ocr/jobs?limit=1" },
  { path: "/api/stations?limit=1" },
  { path: "/api/settings/alerts" },
  { path: "/api/integrations/status" },
  { path: "/api/admin/hub" },
  { path: "/api/admin/diagnostics" },
];

type CheckResult = {
  path: string;
  ok: boolean;
  status?: number;
  error?: string;
};

async function runCheck(check: EndpointCheck): Promise<CheckResult> {
  const url = `${baseUrl}${check.path}`;
  const requestInit: RequestInit = {
    method: check.method ?? "GET",
    headers: {
      "content-type": "application/json",
    },
  };

  if (token) {
    (requestInit.headers as Record<string, string>).authorization =
      `Bearer ${token}`;
  }

  if (check.method === "POST") {
    requestInit.body = check.expectBody ? "{}" : undefined;
  }

  try {
    const response = await fetch(url, requestInit);
    const ok = response.status >= 200 && response.status < 400;
    return { path: check.path, ok, status: response.status };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { path: check.path, ok: false, error: message };
  }
}

const results = await Promise.all(endpoints.map(runCheck));

const failures = results.filter((result) => !result.ok);

for (const result of results) {
  if (result.ok) {
    console.log(`✅ ${result.path} -> ${result.status}`);
  } else {
    if (result.status) {
      console.error(`❌ ${result.path} -> HTTP ${result.status}`);
    } else {
      console.error(`❌ ${result.path} -> ${result.error}`);
    }
  }
}

if (failures.length > 0) {
  Deno.exit(1);
}
