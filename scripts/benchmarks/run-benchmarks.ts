/**
 * Performance Benchmark Script
 * Measures and reports performance metrics
 */

// ============================================================================
// TYPES
// ============================================================================

type BenchmarkResult = {
  name: string;
  iterations: number;
  totalMs: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  p50Ms: number;
  p90Ms: number;
  p99Ms: number;
  opsPerSecond: number;
};

type BenchmarkSuite = {
  name: string;
  results: BenchmarkResult[];
  totalDurationMs: number;
};

// ============================================================================
// BENCHMARK RUNNER
// ============================================================================

async function benchmark(
  name: string,
  fn: () => Promise<void> | void,
  iterations: number = 100
): Promise<BenchmarkResult> {
  const times: number[] = [];

  // Warmup
  for (let i = 0; i < Math.min(10, iterations / 10); i++) {
    await fn();
  }

  // Actual benchmark
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    times.push(performance.now() - start);
  }

  const sorted = times.sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);

  return {
    name,
    iterations,
    totalMs: sum,
    avgMs: sum / iterations,
    minMs: sorted[0],
    maxMs: sorted[sorted.length - 1],
    p50Ms: percentile(sorted, 50),
    p90Ms: percentile(sorted, 90),
    p99Ms: percentile(sorted, 99),
    opsPerSecond: (iterations / sum) * 1000,
  };
}

function percentile(sorted: number[], p: number): number {
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

// ============================================================================
// BENCHMARK SUITES
// ============================================================================

async function runCacheBenchmarks(): Promise<BenchmarkResult[]> {
  // Import cache implementation
  const cachePath = "../../supabase/functions/_shared/cache/memory-cache.ts";
  const { MemoryCache } = await import(cachePath);
  const cache = new MemoryCache<string>({ maxSize: 10000 });
  const results: BenchmarkResult[] = [];

  // Cache set benchmark
  results.push(await benchmark("cache_set", () => {
    const key = `key_${Math.random()}`;
    cache.set(key, "value");
  }, 10000));

  // Pre-populate cache
  for (let i = 0; i < 1000; i++) {
    cache.set(`preload_${i}`, `value_${i}`);
  }

  // Cache get (hit) benchmark
  results.push(await benchmark("cache_get_hit", () => {
    cache.get(`preload_${Math.floor(Math.random() * 1000)}`);
  }, 10000));

  // Cache get (miss) benchmark
  results.push(await benchmark("cache_get_miss", () => {
    cache.get(`nonexistent_${Math.random()}`);
  }, 10000));

  return results;
}

async function runQueryBuilderBenchmarks(): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];

  // Query building (no execution)
  results.push(await benchmark("query_build", () => {
    // Simulate query building
    const filters = [
      { column: "status", value: "open" },
      { column: "role", value: "driver" },
    ];
    const query = filters.reduce((q, f) => q + ` AND ${f.column} = '${f.value}'`, "SELECT *");
  }, 10000));

  return results;
}

async function runSerializationBenchmarks(): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];
  
  const testData = {
    id: "test-id-123",
    name: "Test User",
    email: "test@example.com",
    metadata: {
      preferences: { language: "en", theme: "dark" },
      history: Array.from({ length: 10 }, (_, i) => ({ action: `action_${i}`, timestamp: Date.now() })),
    },
  };

  // JSON stringify
  results.push(await benchmark("json_stringify", () => {
    JSON.stringify(testData);
  }, 10000));

  const jsonStr = JSON.stringify(testData);

  // JSON parse
  results.push(await benchmark("json_parse", () => {
    JSON.parse(jsonStr);
  }, 10000));

  return results;
}

async function runCryptoBenchmarks(): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];

  // UUID generation
  results.push(await benchmark("uuid_generation", () => {
    crypto.randomUUID();
  }, 10000));

  // HMAC signature (simulated)
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode("test-secret-key"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const data = encoder.encode("test data to sign");

  results.push(await benchmark("hmac_sha256", async () => {
    await crypto.subtle.sign("HMAC", key, data);
  }, 1000));

  return results;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log("🚀 Running Performance Benchmarks");
  console.log("==================================\n");

  const suites: BenchmarkSuite[] = [];
  const startTime = performance.now();

  // Cache benchmarks
  console.log("📦 Cache Benchmarks...");
  const cacheResults = await runCacheBenchmarks();
  suites.push({ name: "Cache", results: cacheResults, totalDurationMs: 0 });
  printResults(cacheResults);

  // Query builder benchmarks
  console.log("\n📦 Query Builder Benchmarks...");
  const queryResults = await runQueryBuilderBenchmarks();
  suites.push({ name: "Query Builder", results: queryResults, totalDurationMs: 0 });
  printResults(queryResults);

  // Serialization benchmarks
  console.log("\n📦 Serialization Benchmarks...");
  const serializationResults = await runSerializationBenchmarks();
  suites.push({ name: "Serialization", results: serializationResults, totalDurationMs: 0 });
  printResults(serializationResults);

  // Crypto benchmarks
  console.log("\n📦 Crypto Benchmarks...");
  const cryptoResults = await runCryptoBenchmarks();
  suites.push({ name: "Crypto", results: cryptoResults, totalDurationMs: 0 });
  printResults(cryptoResults);

  // Summary
  const totalDuration = performance.now() - startTime;
  console.log("\n==================================");
  console.log(`✅ Benchmarks completed in ${totalDuration.toFixed(2)}ms`);

  // Export results
  const report = {
    timestamp: new Date().toISOString(),
    totalDurationMs: totalDuration,
    suites,
  };

  try {
    await Deno.writeTextFile(
      "coverage/benchmark-results.json",
      JSON.stringify(report, null, 2)
    );
    console.log("\n📄 Results saved to coverage/benchmark-results.json");
  } catch (error) {
    console.log("\n⚠️  Could not save results:", error);
  }
}

function printResults(results: BenchmarkResult[]) {
  console.log("");
  console.log("| Benchmark | Avg (ms) | P50 (ms) | P99 (ms) | Ops/sec |");
  console.log("|-----------|----------|----------|----------|---------|");
  
  for (const r of results) {
    console.log(
      `| ${r.name.padEnd(9)} | ${r.avgMs.toFixed(4).padStart(8)} | ${r.p50Ms.toFixed(4).padStart(8)} | ${r.p99Ms.toFixed(4).padStart(8)} | ${r.opsPerSecond.toFixed(0).padStart(7)} |`
    );
  }
}

// Run benchmarks
if (import.meta.main) {
  await main();
}

export { benchmark, type BenchmarkResult };
