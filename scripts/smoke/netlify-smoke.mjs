#!/usr/bin/env node

import { logStructuredEvent, logError, recordMetric, recordDurationMetric } from "../_shared/logger.mjs";

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
  const response = await fetch(url, { headers: { Accept: "application/json,text/html" } });
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
  const startTime = Date.now();

  logStructuredEvent("SMOKE_TEST_STARTED", {
    baseUrl,
    endpointCount: DEFAULT_ENDPOINTS.length,
  });

  const results = [];
  for (const endpoint of DEFAULT_ENDPOINTS) {
    const checkStart = Date.now();
    try {
      const result = await checkEndpoint(baseUrl, endpoint);
      results.push(result);
      
      logStructuredEvent("ENDPOINT_CHECK_PASSED", {
        path: endpoint.path,
        status: result.status,
        expect: endpoint.expect,
      });
      
      recordMetric("smoke.endpoint.checked", 1, {
        path: endpoint.path,
        status: result.status,
        result: "success",
      });
      
      recordDurationMetric("smoke.endpoint.duration", checkStart, {
        path: endpoint.path,
      });
    } catch (error) {
      logError("endpoint_check", error, {
        path: endpoint.path,
        baseUrl,
      });
      
      recordMetric("smoke.endpoint.checked", 1, {
        path: endpoint.path,
        result: "failure",
      });
      
      throw error;
    }
  }

  recordDurationMetric("smoke.suite.duration", startTime);

  logStructuredEvent("SMOKE_TEST_COMPLETED", {
    baseUrl,
    checksRun: results.length,
    results: results.map(r => ({ path: r.path, status: r.status })),
  });
}

main().catch((error) => {
  logError("smoke_test_suite", error);
  process.exit(1);
});
