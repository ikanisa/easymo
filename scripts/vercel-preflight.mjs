#!/usr/bin/env node
import { execSync } from 'node:child_process';
import process from 'node:process';

const run = (command, options = {}) => {
  execSync(command, { stdio: 'inherit', ...options });
};

const bool = (value) => {
  if (typeof value !== 'string') return false;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
};

const ensureNodeVersion = () => {
  const [major] = process.versions.node.split('.');
  if (Number.parseInt(major, 10) < 18) {
    throw new Error(`Node.js 18+ is required. Detected ${process.versions.node}`);
  }
};

const requireEnv = () => {
  const useMocks = bool(process.env.NEXT_PUBLIC_USE_MOCKS ?? 'false');
  const missing = [];

  if (!process.env.ADMIN_SESSION_SECRET) {
    missing.push('ADMIN_SESSION_SECRET');
  }

  if (!useMocks) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      || process.env.SERVICE_ROLE_KEY;
    const serviceUrl = process.env.SUPABASE_URL
      || process.env.SERVICE_URL
      || supabaseUrl;

    if (!supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL');
    if (!supabaseAnonKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    if (!serviceUrl) missing.push('SUPABASE_URL or SERVICE_URL');
    if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY or SERVICE_ROLE_KEY');
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};

const main = () => {
  try {
    ensureNodeVersion();
    console.log('[preflight] Node version OK:', process.versions.node);
    run('corepack enable');
    console.log('[preflight] Installing dependencies via pnpm');
    run('pnpm install --frozen-lockfile');

    requireEnv();

    console.log('[preflight] Pulling Vercel preview environment');
    run('pnpm dlx vercel pull --yes --environment=preview', { cwd: 'admin-app' });

    console.log('[preflight] Building Vercel preview bundle');
    run('pnpm dlx vercel build', { cwd: 'admin-app' });

    console.log('[preflight] PASS');
  } catch (error) {
    console.error('[preflight] FAIL');
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }
    process.exit(1);
  }
};

main();
