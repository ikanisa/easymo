#!/usr/bin/env node
import http from 'node:http';
import https from 'node:https';

function getFunctionsBaseUrl() {
  const base = process.env.SUPABASE_FUNCTIONS_URL
    || (process.env.SUPABASE_URL ? `${process.env.SUPABASE_URL.replace(/\/$/, '')}/functions/v1` : null)
    || (process.env.SERVICE_URL ? `${process.env.SERVICE_URL.replace(/\/$/, '')}/functions/v1` : null)
    || null;
  return base;
}

function get(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on('error', reject);
  });
}

async function main() {
  const base = getFunctionsBaseUrl();
  if (!base) {
    console.error('missing_functions_base: Set SUPABASE_FUNCTIONS_URL or SUPABASE_URL');
    process.exit(2);
  }
  const endpoints = ['wa-webhook-core/health'];
  let failures = 0;
  for (const ep of endpoints) {
    const url = `${base}/${ep}`;
    try {
      const { status, body } = await get(url);
      const ok = status >= 200 && status < 300;
      console.log(`[${ok ? 'OK' : 'FAIL'}] GET ${url} -> ${status}`);
      if (!ok) {
        console.log(body);
        failures++;
      }
    } catch (err) {
      console.error(`[ERR] GET ${url}:`, err.message || String(err));
      failures++;
    }
  }
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error('smoke_failed', e);
  process.exit(1);
});

