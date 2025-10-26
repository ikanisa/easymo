import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';
import { SharedArray } from 'k6/data';

const summary = new SharedArray('perf_seed_summary_redeem', () => {
  try {
    return JSON.parse(open('../fixtures/generated/perf_seed_summary.json')).stationRedeemPayloads;
  } catch (error) {
    console.error('Unable to read perf_seed_summary.json. Run pnpm perf:seed first.');
    throw error;
  }
});

const redeemLatency = new Trend('station_redeem_latency', true);
const redeemFailures = new Rate('station_redeem_failures');
const redeemAttempts = new Counter('station_redeem_attempts');

const BASE_URL = __ENV.PERF_STATION_REDEEM_URL;
const AUTH_HEADER = __ENV.PERF_STATION_AUTH_HEADER ?? 'authorization';

if (!BASE_URL) {
  throw new Error('Set PERF_STATION_REDEEM_URL before running the station peak scenario.');
}

export const options = {
  scenarios: {
    station_redeem_peak: {
      executor: 'constant-arrival-rate',
      rate: 150, // 50 stations * 3 vouchers per minute
      timeUnit: '1m',
      duration: '10m',
      preAllocatedVUs: 120,
      maxVUs: 200,
    },
  },
  thresholds: {
    station_redeem_latency: ['p(95)<500', 'avg<300'],
    station_redeem_failures: ['rate<0.01'],
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000'],
  },
  summaryTrendStats: ['avg', 'min', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

function pickStation() {
  const sample = summary[Math.floor(Math.random() * summary.length)];
  if (!sample) {
    throw new Error('Seed summary missing station redeem payloads.');
  }
  return sample;
}

function buildHeaders(station) {
  const headers = {
    'Content-Type': 'application/json',
  };
  if (station.token) {
    headers[AUTH_HEADER] = station.token;
  } else if (__ENV.PERF_STATION_BEARER) {
    headers[AUTH_HEADER] = `Bearer ${__ENV.PERF_STATION_BEARER}`;
  }
  if (__ENV.BRIDGE_SHARED_SECRET) {
    headers['x-bridge-secret'] = __ENV.BRIDGE_SHARED_SECRET;
  }
  if (__ENV.SUPABASE_SERVICE_ROLE_KEY) {
    headers.Authorization = `Bearer ${__ENV.SUPABASE_SERVICE_ROLE_KEY}`;
  }
  return headers;
}

export default function stationRedeemPeak() {
  const station = pickStation();
  const headers = buildHeaders(station);
  const payload = {
    voucherId: station.voucherIds[(__ITER + __VU) % station.voucherIds.length],
    stationId: station.stationId,
    operator: station.operator,
  };

  group('station redeem request', () => {
    redeemAttempts.add(1);
    const start = Date.now();
    const response = http.post(BASE_URL, JSON.stringify(payload), { headers });
    const latency = Date.now() - start;
    redeemLatency.add(latency);

    const ok = check(response, {
      'status is 200/201': (res) => res.status === 200 || res.status === 201,
      'voucher marked redeemed': (res) => {
        try {
          const json = res.json();
          return json?.status === 'redeemed' || json?.data?.status === 'redeemed';
        } catch (error) {
          return false;
        }
      },
    });

    redeemFailures.add(!ok);

    if (__ENV.K6_LOG_HTTP === 'true' && !ok) {
      console.log(`Redeem failure for station ${station.stationId} payload=${JSON.stringify(payload)} response=${response.status} ${response.body}`);
    }
  });

  sleep(__ENV.PERF_REDEEM_SLEEP_SECONDS ? Number(__ENV.PERF_REDEEM_SLEEP_SECONDS) : 0.1);
}

export function handleSummary(data) {
  const outputFile = __ENV.PERF_OUTPUT_FILE ?? '.perf/k6-station-redeem-summary.json';
  return {
    stdout: JSON.stringify(data, null, 2),
    [outputFile]: JSON.stringify(data, null, 2),
  };
}
