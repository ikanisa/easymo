import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';
import { SharedArray } from 'k6/data';

const summary = new SharedArray('perf_seed_summary', () => {
  try {
    return JSON.parse(open('../fixtures/generated/perf_seed_summary.json')).voucherPreviewPayloads;
  } catch (error) {
    console.error('Unable to read perf_seed_summary.json. Run pnpm perf:seed first.');
    throw error;
  }
});

const previewLatency = new Trend('voucher_preview_latency', true);
const previewFailures = new Rate('voucher_preview_failures');

const BASE_URL = __ENV.PERF_VOUCHER_PREVIEW_URL || `${__ENV.PERF_APP_BASE_URL ?? ''}/api/vouchers/preview`;
const ID_HEADER = __ENV.PERF_IDEMPOTENCY_HEADER ?? 'x-idempotency-key';
const STATIC_HEADERS = {
  'Content-Type': 'application/json',
};

if (!BASE_URL || BASE_URL.endsWith('undefined')) {
  throw new Error('Set PERF_VOUCHER_PREVIEW_URL or PERF_APP_BASE_URL before running the test.');
}

export const options = {
  scenarios: {
    voucher_preview_spike: {
      executor: 'ramping-arrival-rate',
      startRate: 50,
      timeUnit: '1m',
      preAllocatedVUs: 150,
      maxVUs: 500,
      stages: [
        { duration: '1m', target: 150 },
        { duration: '2m', target: 400 },
        { duration: '2m', target: 500 },
        { duration: '1m', target: 0 },
      ],
    },
  },
  thresholds: {
    voucher_preview_latency: ['p(95)<1000', 'avg<600'],
    voucher_preview_failures: ['rate<0.01'],
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<2000'],
  },
  summaryTrendStats: ['avg', 'min', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

function buildPayload() {
  const sample = summary[Math.floor(Math.random() * summary.length)];
  if (!sample) {
    throw new Error('Seed summary does not contain voucher preview payloads.');
  }
  const payload = { ...sample };
  if (__ENV.PERF_FORCE_RANDOM_AMOUNT === 'true') {
    payload.amount = 1000 + Math.floor(Math.random() * 2000);
  }
  return payload;
}

function buildHeaders(payload) {
  const headers = { ...STATIC_HEADERS };
  if (__ENV.PERF_IDEMPOTENCY_PREFIX) {
    headers[ID_HEADER] = `${__ENV.PERF_IDEMPOTENCY_PREFIX}-${payload.code ?? payload.voucherId}-${__VU}-${__ITER}`;
  } else {
    headers[ID_HEADER] = `${payload.code ?? payload.voucherId}-${__VU}-${__ITER}`;
  }
  if (__ENV.BRIDGE_SHARED_SECRET) {
    headers['x-bridge-secret'] = __ENV.BRIDGE_SHARED_SECRET;
  }
  if (__ENV.SUPABASE_SERVICE_ROLE_KEY) {
    headers.Authorization = `Bearer ${__ENV.SUPABASE_SERVICE_ROLE_KEY}`;
  }
  return headers;
}

export default function voucherPreviewSpike() {
  group('voucher preview request', () => {
    const payload = buildPayload();
    const headers = buildHeaders(payload);
    const start = Date.now();

    const response = http.post(BASE_URL, JSON.stringify(payload), { headers });
    const latency = Date.now() - start;
    previewLatency.add(latency);

    const ok = check(response, {
      'status is 200/202': (res) => res.status === 200 || res.status === 202,
      'integration status ok': (res) => (res.json()?.integration?.status ?? 'unknown') !== 'degraded',
    });

    previewFailures.add(!ok);

    if (__ENV.K6_LOG_HTTP === 'true' && !ok) {
      console.log(`Failure payload => ${JSON.stringify(payload)} :: response=${response.status} ${response.body}`);
    }
  });

  sleep(__ENV.PERF_SLEEP_SECONDS ? Number(__ENV.PERF_SLEEP_SECONDS) : 0.2);
}

export function handleSummary(data) {
  const outputFile = __ENV.PERF_OUTPUT_FILE ?? '.perf/k6-voucher-preview-summary.json';
  return {
    stdout: JSON.stringify(data, null, 2),
    [outputFile]: JSON.stringify(data, null, 2),
  };
}
