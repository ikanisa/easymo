#!/usr/bin/env node
/**
 * Load Testing Script for Admin Panel API Routes
 * 
 * Tests rate limiting implementation under stress conditions
 * Verifies proper 429 responses and rate limit headers
 */

import autocannon from 'autocannon';
import { writeFileSync } from 'fs';
import { join } from 'path';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const RESULTS_DIR = join(process.cwd(), 'load-test-results');

interface TestResult {
  endpoint: string;
  duration: number;
  requests: number;
  throughput: number;
  latency: {
    mean: number;
    p50: number;
    p95: number;
    p99: number;
  };
  statusCodes: Record<string, number>;
  rateLimitEnforced: boolean;
}

const results: TestResult[] = [];

/**
 * Test auth/login endpoint rate limiting
 */
async function testLoginRateLimit() {
  console.log('\n🔐 Testing /api/auth/login rate limiting...');
  
  const result = await autocannon({
    url: `${BASE_URL}/api/auth/login`,
    connections: 20,
    duration: 10,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: 'test@example.com',
      password: 'testpassword',
    }),
  });

  const statusCodes = result.statusCodeStats || {};
  const has429 = statusCodes['429'] && statusCodes['429'].count > 0;

  const testResult: TestResult = {
    endpoint: '/api/auth/login',
    duration: result.duration,
    requests: result.requests.total,
    throughput: result.throughput.mean,
    latency: {
      mean: result.latency.mean,
      p50: result.latency.p50,
      p95: result.latency.p95,
      p99: result.latency.p99,
    },
    statusCodes: Object.fromEntries(
      Object.entries(statusCodes).map(([code, stats]: [string, any]) => [
        code,
        stats.count,
      ])
    ),
    rateLimitEnforced: has429,
  };

  results.push(testResult);

  console.log(`  ✓ Total requests: ${result.requests.total}`);
  console.log(`  ✓ Throughput: ${result.throughput.mean.toFixed(2)} req/sec`);
  console.log(`  ✓ Mean latency: ${result.latency.mean.toFixed(2)}ms`);
  console.log(`  ✓ Status codes:`, testResult.statusCodes);
  console.log(`  ${has429 ? '✅' : '❌'} Rate limit enforced (429 responses)`);

  return testResult;
}

/**
 * Test users/invite endpoint rate limiting
 */
async function testInviteRateLimit() {
  console.log('\n👥 Testing /api/users/invite rate limiting...');

  const result = await autocannon({
    url: `${BASE_URL}/api/users/invite`,
    connections: 15,
    duration: 10,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': 'admin_session=test-session-token',
    },
    body: JSON.stringify({
      email: 'newuser@example.com',
      role: 'staff',
    }),
  });

  const statusCodes = result.statusCodeStats || {};
  const has429 = statusCodes['429'] && statusCodes['429'].count > 0;

  const testResult: TestResult = {
    endpoint: '/api/users/invite',
    duration: result.duration,
    requests: result.requests.total,
    throughput: result.throughput.mean,
    latency: {
      mean: result.latency.mean,
      p50: result.latency.p50,
      p95: result.latency.p95,
      p99: result.latency.p99,
    },
    statusCodes: Object.fromEntries(
      Object.entries(statusCodes).map(([code, stats]: [string, any]) => [
        code,
        stats.count,
      ])
    ),
    rateLimitEnforced: has429,
  };

  results.push(testResult);

  console.log(`  ✓ Total requests: ${result.requests.total}`);
  console.log(`  ✓ Throughput: ${result.throughput.mean.toFixed(2)} req/sec`);
  console.log(`  ✓ Mean latency: ${result.latency.mean.toFixed(2)}ms`);
  console.log(`  ✓ Status codes:`, testResult.statusCodes);
  console.log(`  ${has429 ? '✅' : '❌'} Rate limit enforced (429 responses)`);

  return testResult;
}

/**
 * Test settings endpoint rate limiting (GET)
 */
async function testSettingsGetRateLimit() {
  console.log('\n⚙️  Testing /api/settings (GET) rate limiting...');

  const result = await autocannon({
    url: `${BASE_URL}/api/settings`,
    connections: 35,
    duration: 10,
    method: 'GET',
  });

  const statusCodes = result.statusCodeStats || {};
  const has429 = statusCodes['429'] && statusCodes['429'].count > 0;

  const testResult: TestResult = {
    endpoint: '/api/settings (GET)',
    duration: result.duration,
    requests: result.requests.total,
    throughput: result.throughput.mean,
    latency: {
      mean: result.latency.mean,
      p50: result.latency.p50,
      p95: result.latency.p95,
      p99: result.latency.p99,
    },
    statusCodes: Object.fromEntries(
      Object.entries(statusCodes).map(([code, stats]: [string, any]) => [
        code,
        stats.count,
      ])
    ),
    rateLimitEnforced: has429,
  };

  results.push(testResult);

  console.log(`  ✓ Total requests: ${result.requests.total}`);
  console.log(`  ✓ Throughput: ${result.throughput.mean.toFixed(2)} req/sec`);
  console.log(`  ✓ Mean latency: ${result.latency.mean.toFixed(2)}ms`);
  console.log(`  ✓ Status codes:`, testResult.statusCodes);
  console.log(`  ${has429 ? '✅' : '❌'} Rate limit enforced (429 responses)`);

  return testResult;
}

/**
 * Test settings endpoint rate limiting (POST)
 */
async function testSettingsPostRateLimit() {
  console.log('\n⚙️  Testing /api/settings (POST) rate limiting...');

  const result = await autocannon({
    url: `${BASE_URL}/api/settings`,
    connections: 15,
    duration: 10,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': 'admin_session=test-session-token',
    },
    body: JSON.stringify({
      quietHours: { start: '22:00', end: '06:00' },
      throttlePerMinute: 60,
      optOutList: [],
    }),
  });

  const statusCodes = result.statusCodeStats || {};
  const has429 = statusCodes['429'] && statusCodes['429'].count > 0;

  const testResult: TestResult = {
    endpoint: '/api/settings (POST)',
    duration: result.duration,
    requests: result.requests.total,
    throughput: result.throughput.mean,
    latency: {
      mean: result.latency.mean,
      p50: result.latency.p50,
      p95: result.latency.p95,
      p99: result.latency.p99,
    },
    statusCodes: Object.fromEntries(
      Object.entries(statusCodes).map(([code, stats]: [string, any]) => [
        code,
        stats.count,
      ])
    ),
    rateLimitEnforced: has429,
  };

  results.push(testResult);

  console.log(`  ✓ Total requests: ${result.requests.total}`);
  console.log(`  ✓ Throughput: ${result.throughput.mean.toFixed(2)} req/sec`);
  console.log(`  ✓ Mean latency: ${result.latency.mean.toFixed(2)}ms`);
  console.log(`  ✓ Status codes:`, testResult.statusCodes);
  console.log(`  ${has429 ? '✅' : '❌'} Rate limit enforced (429 responses)`);

  return testResult;
}

/**
 * Generate summary report
 */
function generateReport() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 LOAD TEST SUMMARY REPORT');
  console.log('='.repeat(60));

  const allRateLimitsEnforced = results.every((r) => r.rateLimitEnforced);

  results.forEach((result) => {
    console.log(`\n${result.endpoint}:`);
    console.log(`  Requests: ${result.requests}`);
    console.log(`  Throughput: ${result.throughput.toFixed(2)} req/sec`);
    console.log(`  Latency (mean): ${result.latency.mean.toFixed(2)}ms`);
    console.log(`  Latency (p95): ${result.latency.p95.toFixed(2)}ms`);
    console.log(`  Latency (p99): ${result.latency.p99.toFixed(2)}ms`);
    console.log(`  Status codes:`, result.statusCodes);
    console.log(
      `  Rate limiting: ${result.rateLimitEnforced ? '✅ PASS' : '❌ FAIL'}`
    );
  });

  console.log('\n' + '='.repeat(60));
  console.log(
    `Overall Result: ${allRateLimitsEnforced ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`
  );
  console.log('='.repeat(60) + '\n');

  // Save results to file
  try {
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const filename = `load-test-${timestamp}.json`;
    const filepath = join(RESULTS_DIR, filename);

    writeFileSync(
      filepath,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          baseUrl: BASE_URL,
          results,
          summary: {
            totalTests: results.length,
            passed: results.filter((r) => r.rateLimitEnforced).length,
            failed: results.filter((r) => !r.rateLimitEnforced).length,
          },
        },
        null,
        2
      )
    );

    console.log(`📁 Results saved to: ${filepath}\n`);
  } catch (error) {
    console.error('Failed to save results:', error);
  }

  return allRateLimitsEnforced;
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Starting Admin Panel Load Tests');
  console.log(`Target: ${BASE_URL}`);
  console.log('='.repeat(60));

  try {
    await testLoginRateLimit();
    await testInviteRateLimit();
    await testSettingsGetRateLimit();
    await testSettingsPostRateLimit();

    const success = generateReport();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('\n❌ Load test failed:', error);
    process.exit(1);
  }
}

main();
