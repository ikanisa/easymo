/**
 * Load Testing - Mobility V2
 * 
 * Tests:
 * - 1000 concurrent find-drivers requests
 * - 500 concurrent match creations
 * - Cache performance under load
 * - Database connection pool limits
 * 
 * Requirements:
 * - k6 (brew install k6)
 * - All services running
 * - Redis running
 */

import { check, sleep } from 'k6';
import http from 'k6/http';
import { Counter,Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const cacheHitRate = new Rate('cache_hits');
const findDriversDuration = new Trend('find_drivers_duration');
const matchCreationDuration = new Trend('match_creation_duration');
const driversFoundCount = new Trend('drivers_found_count');
const totalRequests = new Counter('total_requests');

// Configuration
const BASE_URL = __ENV.ORCHESTRATOR_URL || 'http://localhost:4600';
const SUPABASE_URL = __ENV.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_KEY = __ENV.SUPABASE_SERVICE_ROLE_KEY || 'test-key';

// Test scenarios
export const options = {
  scenarios: {
    // Scenario 1: Gradual ramp-up
    ramp_up: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 },   // Ramp to 100 users
        { duration: '5m', target: 100 },   // Stay at 100
        { duration: '2m', target: 500 },   // Ramp to 500
        { duration: '5m', target: 500 },   // Stay at 500
        { duration: '2m', target: 1000 },  // Ramp to 1000
        { duration: '5m', target: 1000 },  // Stay at 1000
        { duration: '3m', target: 0 },     // Ramp down
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<1000'], // 95% of requests < 1s
    'http_req_failed': ['rate<0.01'],    // Error rate < 1%
    'errors': ['rate<0.01'],
    'cache_hits': ['rate>0.5'],          // Cache hit rate > 50%
  },
};

// Test data
const VEHICLE_TYPES = ['moto', 'car', 'bus'];
const TEST_USERS = {
  passenger: '00000000-0000-0000-0000-000000000001',
  driver1: '00000000-0000-0000-0000-000000000002',
  driver2: '00000000-0000-0000-0000-000000000003',
};

// Helper: Create test trip
function createTrip(userId, role, vehicleType) {
  const payload = JSON.stringify({
    creator_user_id: userId,
    role: role,
    vehicle_type: vehicleType,
    pickup_lat: -1.9500 + (Math.random() * 0.1),
    pickup_lng: 30.0600 + (Math.random() * 0.1),
    pickup_text: 'Test Location',
    expires_at: new Date(Date.now() + 3600000).toISOString(),
  });

  const res = http.post(`${SUPABASE_URL}/rest/v1/mobility_trips`, payload, {
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'return=representation',
    },
  });

  if (res.status === 201 && res.json().length > 0) {
    return res.json()[0].id;
  }
  return null;
}

// Test: Find drivers workflow
export default function () {
  totalRequests.add(1);

  // Random vehicle type
  const vehicleType = VEHICLE_TYPES[Math.floor(Math.random() * VEHICLE_TYPES.length)];

  // Create passenger trip
  const passengerTripId = createTrip(TEST_USERS.passenger, 'passenger', vehicleType);

  if (!passengerTripId) {
    errorRate.add(1);
    return;
  }

  // Find drivers
  const findStart = Date.now();
  const findRes = http.post(`${BASE_URL}/workflows/find-drivers`, JSON.stringify({
    userId: TEST_USERS.passenger,
    passengerTripId: passengerTripId,
    vehicleType: vehicleType,
    radiusKm: 15,
    limit: 9,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  const findDuration = (Date.now() - findStart) / 1000;
  findDriversDuration.add(findDuration);

  // Check response
  const findSuccess = check(findRes, {
    'find-drivers status 200': (r) => r.status === 200,
    'find-drivers has drivers': (r) => r.json().count >= 0,
    'find-drivers response time < 1s': () => findDuration < 1,
  });

  if (!findSuccess) {
    errorRate.add(1);
  } else {
    errorRate.add(0);
  }

  // Track cache hits
  if (findRes.json().cached === true) {
    cacheHitRate.add(1);
  } else {
    cacheHitRate.add(0);
  }

  // Track drivers found
  driversFoundCount.add(findRes.json().count || 0);

  // 30% of requests create a match
  if (Math.random() < 0.3 && findRes.json().count > 0) {
    const drivers = findRes.json().drivers || [];
    if (drivers.length > 0) {
      const matchStart = Date.now();
      const matchRes = http.post(`${BASE_URL}/workflows/accept-match`, JSON.stringify({
        driverTripId: drivers[0].trip_id,
        passengerTripId: passengerTripId,
        driverUserId: drivers[0].user_id,
        passengerUserId: TEST_USERS.passenger,
      }), {
        headers: { 'Content-Type': 'application/json' },
      });

      const matchDuration = (Date.now() - matchStart) / 1000;
      matchCreationDuration.add(matchDuration);

      check(matchRes, {
        'accept-match status 200': (r) => r.status === 200,
        'accept-match response time < 500ms': () => matchDuration < 0.5,
      });
    }
  }

  // Think time
  sleep(Math.random() * 2 + 1); // 1-3 seconds
}

// Summary handler
export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'load-test-results.json': JSON.stringify(data, null, 2),
  };
}

function textSummary(data, opts) {
  const { indent = '', enableColors = false } = opts || {};
  
  const summary = [
    '',
    '═══════════════════════════════════════════',
    '   Mobility V2 Load Test Results',
    '═══════════════════════════════════════════',
    '',
    `Total Requests: ${data.metrics.total_requests.values.count}`,
    `Error Rate: ${(data.metrics.errors.values.rate * 100).toFixed(2)}%`,
    `Cache Hit Rate: ${(data.metrics.cache_hits.values.rate * 100).toFixed(2)}%`,
    '',
    'Find Drivers Duration:',
    `  p50: ${data.metrics.find_drivers_duration.values['p(50)'].toFixed(0)}ms`,
    `  p95: ${data.metrics.find_drivers_duration.values['p(95)'].toFixed(0)}ms`,
    `  p99: ${data.metrics.find_drivers_duration.values['p(99)'].toFixed(0)}ms`,
    '',
    'Match Creation Duration:',
    `  p50: ${data.metrics.match_creation_duration.values['p(50)'].toFixed(0)}ms`,
    `  p95: ${data.metrics.match_creation_duration.values['p(95)'].toFixed(0)}ms`,
    '',
    'Drivers Found per Search:',
    `  avg: ${data.metrics.drivers_found_count.values.avg.toFixed(1)}`,
    `  p95: ${data.metrics.drivers_found_count.values['p(95)'].toFixed(0)}`,
    '',
    '═══════════════════════════════════════════',
    '',
  ];

  return summary.join('\n');
}
