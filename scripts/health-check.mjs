#!/usr/bin/env node
import process from 'node:process';
import https from 'node:https';
import http from 'node:http';

const DEFAULT_URL = 'http://localhost:54321/functions/v1/admin-health';
const apiBase = process.env.VITE_API_BASE ? process.env.VITE_API_BASE.replace(/\/$/, '') : undefined;
const url = process.env.HEALTH_URL || (apiBase ? `${apiBase}/admin-health` : DEFAULT_URL);
const adminToken = process.env.VITE_ADMIN_TOKEN || process.env.ADMIN_TOKEN || process.env.EASYMO_ADMIN_TOKEN || '';

function request(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: {
        'x-admin-token': adminToken,
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        resolve({ status: res.statusCode ?? 0, body: data });
      });
    });
    req.on('error', reject);
  });
}

(async () => {
  try {
    const { status, body } = await request(url);
    if (status >= 200 && status < 300) {
      console.log(`Health OK (${status})`);
      console.log(body);
      process.exit(0);
    }
    console.error(`Health check failed (${status})`);
    console.error(body);
    process.exit(1);
  } catch (err) {
    console.error('Health check error', err);
    process.exit(1);
  }
})();
