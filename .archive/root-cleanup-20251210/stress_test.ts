import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";

const SERVICES = [
  "wa-webhook-core",
  "wa-webhook-profile",
  "wa-webhook-insurance",
  "wa-webhook-jobs",
  "wa-webhook-property",
  "wa-webhook-marketplace",
  "wa-webhook-mobility",
  "wa-webhook-ai-agents"
];

const PROJECT_REF = "lhbowpbcpwoiparwnwgt";
const BASE_URL = `https://${PROJECT_REF}.supabase.co/functions/v1`;

async function checkHealth(service: string, i: number) {
  const start = performance.now();
  try {
    const res = await fetch(`${BASE_URL}/${service}/health`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""}`
      }
    });
    const duration = performance.now() - start;
    if (res.ok) {
      return { service, status: "ok", duration, i };
    } else {
      return { service, status: "error", code: res.status, duration, i };
    }
  } catch (err) {
    return { service, status: "failed", error: String(err), duration: performance.now() - start, i };
  }
}

async function runStressTest() {
  console.log("🚀 Starting Stress Test on Microservices...");
  
  const CONCURRENCY = 5;
  const ITERATIONS = 5;
  const results: any[] = [];

  for (const service of SERVICES) {
    console.log(`\nTesting ${service}...`);
    const promises = [];
    for (let i = 0; i < ITERATIONS; i++) {
      promises.push(checkHealth(service, i));
    }
    
    const serviceResults = await Promise.all(promises);
    results.push(...serviceResults);
    
    const avgLatency = serviceResults.reduce((acc, r) => acc + r.duration, 0) / ITERATIONS;
    const successCount = serviceResults.filter(r => r.status === "ok").length;
    
    console.log(`  ✅ Success: ${successCount}/${ITERATIONS}`);
    console.log(`  ⏱️ Avg Latency: ${avgLatency.toFixed(2)}ms`);
  }

  console.log("\n📊 Final Results Summary:");
  const failures = results.filter(r => r.status !== "ok");
  if (failures.length === 0) {
    console.log("✅ ALL SERVICES PASSED STRESS TEST");
  } else {
    console.log(`❌ ${failures.length} REQUESTS FAILED`);
    console.log(failures);
  }
}

runStressTest();
