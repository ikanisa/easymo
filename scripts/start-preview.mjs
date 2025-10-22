#!/usr/bin/env node
import { spawn } from 'node:child_process';
import process from 'node:process';

const port = process.env.PORT ?? '3000';

const child = spawn(
  'pnpm',
  ['exec', 'vite', 'preview', '--host', '0.0.0.0', '--port', port],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      PORT: port,
    },
  },
);

child.on('close', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

child.on('error', (error) => {
  console.error('Failed to launch Vite preview server:', error);
  process.exit(1);
});
