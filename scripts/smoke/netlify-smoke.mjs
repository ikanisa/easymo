#!/usr/bin/env node

const DEFAULT_ENDPOINTS = [
  { path: "/login", expect: "text" },
  { path: "/dashboard", expect: "text" },
  { path: "/api/live-calls", expect: "json" },
  { path: "/marketplace", expect: "text" },
  { path: "/marketplace/settings", expect: "text" },
  { path: "/api/marketplace/settings", expect: "json" },
];

function resolveBaseUrl() {
  return (
    process.env.SMOKE_BASE_URL ||
    process.env.DEPLOY_URL ||
    process.env.DEPLOY_PRIME_URL ||
    process.env.NETLIFY_PREVIEW_URL ||
    "http://localhost:3000"
  );
}

async function checkEndpoint(baseUrl, endpoint) {
  const url = new URL(endpoint.path, baseUrl).toString();
  const acceptHeader =
    endpoint.expect === "json"
      ? "application/json"
      : "text/html";
  const response = await fetch(url, { headers: { Accept: acceptHeader } });
  const ok = response.status < 400;

  let detail = "";
  if (endpoint.expect === "json") {
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      detail = `Expected JSON but got content-type ${contentType || "unknown"}`;
    } else {
      const body = await response.json().catch(() => null);
      if (!body) {
        detail = "JSON body could not be parsed";
      }
    }
  }

  if (!ok || detail) {
    throw new Error(`Endpoint ${endpoint.path} failed: status ${response.status}. ${detail}`);
  }

  return { path: endpoint.path, status: response.status };
}

async function main() {
  const baseUrl = resolveBaseUrl();
  console.log(`Running Netlify smoke tests against ${baseUrl}`);

  const results = [];
  for (const endpoint of DEFAULT_ENDPOINTS) {
    try {
      const result = await checkEndpoint(baseUrl, endpoint);
      results.push(result);
      console.log(`✅ ${endpoint.path} (${result.status})`);
    } catch (error) {
      console.error(`❌ ${endpoint.path}: ${error.message}`);
      throw error;
    }
  }

  console.log("\nSmoke tests passed:");
  for (const result of results) {
    console.log(`- ${result.path} (${result.status})`);
  }
}

main().catch((error) => {
  console.error("Smoke test suite failed", error);
  process.exit(1);
});
