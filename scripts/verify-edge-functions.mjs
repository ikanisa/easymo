#!/usr/bin/env node
import process from 'node:process';

const DEFAULT_BASE = 'http://localhost:54321/functions/v1';
const base = (process.env.EDGE_FUNCTIONS_BASE || DEFAULT_BASE).replace(/\/$/, '');
const token = process.env.EDGE_FUNCTIONS_TOKEN || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// IMPORTANT: wa-webhook is DEPRECATED (Issue #485) - DO NOT ADD BACK
// The legacy monolithic wa-webhook has been replaced by wa-webhook-core + domain microservices
const defaultFunctions = [
  { name: 'wa-webhook-core', path: 'wa-webhook-core', expect: (body, raw) => raw.includes('messages') || typeof body === 'object' },
  { name: 'wa-webhook-ai-agents', path: 'wa-webhook-ai-agents', expect: (_body, raw) => raw.length > 0 },
  { name: 'waiter-ai-agent', path: 'waiter-ai-agent', expect: (_body, raw) => raw.length > 0 },
  { name: 'agent-monitor', path: 'agent-monitor', expect: (_body, raw) => raw.length > 0 },
  { name: 'agent-runner', path: 'agent-runner', expect: (_body, raw) => raw.length > 0 },
];

function parseOverrides() {
  const override = process.env.EDGE_FUNCTIONS;
  if (!override) return null;
  return override
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((name) => ({ name, path: name, expect: (_body, raw) => raw.length > 0 }));
}

async function checkFunction(def) {
  const url = `${base}/${def.path}`;
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  const raw = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }

  if (!res.ok) {
    throw new Error(`${def.name} returned ${res.status} ${raw.slice(0, 120)}`);
  }

  const expectation = def.expect ? def.expect(parsed ?? raw, raw) : true;
  if (!expectation) {
    throw new Error(`${def.name} did not return expected payload: ${raw.slice(0, 120)}`);
  }

  console.log(`✅ ${def.name} reachable (${res.status})`);
  return { name: def.name, status: res.status };
}

(async () => {
  const targets = parseOverrides() || defaultFunctions;
  const results = [];
  for (const fn of targets) {
    try {
      const result = await checkFunction(fn);
      results.push(result);
    } catch (error) {
      console.error(`❌ ${fn.name} check failed:`, error.message);
      process.exitCode = 1;
    }
  }

  if (process.exitCode) {
    console.error('Edge deployment verification failed');
    process.exit(process.exitCode);
  }

  console.log(`Verified ${results.length} edge functions at ${base}`);
})();
