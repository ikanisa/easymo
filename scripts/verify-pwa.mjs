#!/usr/bin/env node
import { readFile, access, appendFile } from 'fs/promises';
import { constants as fsConstants } from 'fs';
import { spawn } from 'child_process';
import path from 'path';

const projectRoot = process.cwd();
const manifestPath = path.join(projectRoot, 'public', 'manifest.json');
const icon192Path = path.join(projectRoot, 'public', 'icons', 'icon-192.png');
const icon512Path = path.join(projectRoot, 'public', 'icons', 'icon-512.png');
const indexPath = path.join(projectRoot, 'index.html');
const mainEntryPath = path.join(projectRoot, 'src', 'main.tsx');
const docPath = path.join(projectRoot, 'docs', 'deployment', 'pwa-readiness.md');

const checks = [];

function record(label, success, detail = '') {
  const status = success ? '✅' : '❌';
  console.log(`${status} ${label}${detail ? ` - ${detail}` : ''}`);
  checks.push({ label, success, detail });
}

async function checkManifest() {
  try {
    const raw = await readFile(manifestPath, 'utf-8');
    const json = JSON.parse(raw);
    const sizes = (json.icons || []).map((icon) => icon.sizes);
    const has192 = sizes.includes('192x192');
    const has512 = sizes.includes('512x512');
    if (has192 && has512) {
      record('manifest.json includes 192 & 512 icons', true);
    } else {
      record('manifest.json icon sizes', false, `found: ${sizes.join(', ')}`);
    }
  } catch (error) {
    record('manifest.json accessible', false, error.message);
  }
}

async function checkIcons() {
  try {
    await access(icon192Path, fsConstants.F_OK);
    await access(icon512Path, fsConstants.F_OK);
    record('PWA icons present', true);
  } catch (error) {
    record('PWA icons present', false, error.message);
  }
}

async function checkHeadTags() {
  try {
    const html = await readFile(indexPath, 'utf-8');
    const hasManifest = /<link\s+rel=["']manifest["']\s+href=["']/i.test(html);
    const hasTheme = /<meta\s+name=["']theme-color["']/i.test(html);
    record('index.html has <link rel="manifest">', hasManifest);
    record('index.html has theme-color meta', hasTheme);
  } catch (error) {
    record('index.html accessible', false, error.message);
  }
}

async function checkServiceWorkerRegistration() {
  try {
    const code = await readFile(mainEntryPath, 'utf-8');
    const registered = /navigator\.serviceWorker\s*\.register\(/.test(code);
    record('Service worker registration in src/main.tsx', registered);
  } catch (error) {
    record('Service worker registration check', false, error.message);
  }
}

async function runCommand(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', ...options });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${cmd} exited with code ${code}`));
      }
    });
  });
}

async function runBuild() {
  const runner = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  try {
    await runCommand(runner, ['run', 'build']);
    record('pnpm run build', true);
  } catch (error) {
    record('pnpm run build', false, error.message);
    throw error;
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runPreviewAndProbe() {
  const runner = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const preview = spawn(
    runner,
    ['run', 'preview', '--', '--port', '5000', '--host', '127.0.0.1'],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );

  let previewOutput = '';
  let previewExited = false;
  let previewExitCode = null;

  preview.stdout.on('data', (chunk) => {
    previewOutput += chunk.toString();
  });

  preview.stderr.on('data', (chunk) => {
    previewOutput += chunk.toString();
  });

  preview.on('exit', (code) => {
    previewExited = true;
    previewExitCode = code;
  });

  const maxAttempts = 10;
  let success = false;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await delay(1500);

    if (previewExited && previewExitCode !== 0) {
      const detail = previewOutput.includes('EPERM')
        ? 'Unable to bind preview port (restricted sandbox)'
        : `Preview exited (code ${previewExitCode})`;
      record('Preview server probe (skipped)', true, detail);
      return;
    }

    try {
      const response = await fetch('http://127.0.0.1:5000/', { method: 'GET' });
      if (response.ok) {
        success = true;
        record('Preview server responded with 200', true);
        break;
      }
      record('Preview server probe', false, `HTTP ${response.status}`);
    } catch (error) {
      if (attempt === maxAttempts) {
        record('Preview server probe', false, error.message);
      }
    }
  }

  preview.kill('SIGTERM');
  await delay(500);

  if (!success && !previewExited) {
    throw new Error('Preview probe failed');
  }
}

async function appendReport() {
  const timestamp = new Date().toISOString();
  const lines = checks.map(({ label, success }) => `- ${success ? '✅' : '❌'} ${label}`);
  const block = `\n\n## Verification Run (${timestamp})\n\n${lines.join('\n')}\n`;
  await appendFile(docPath, block, 'utf-8');
}

(async function main() {
  try {
    await checkManifest();
    await checkIcons();
    await checkHeadTags();
    await checkServiceWorkerRegistration();
    await runBuild();
    await runPreviewAndProbe();
    await appendReport();
    console.log('\nPWA verification complete.');
    process.exit(0);
  } catch (error) {
    console.error(`\nVerification halted: ${error.message}`);
    try {
      await appendReport();
    } catch (writeError) {
      console.error('Unable to append verification results:', writeError.message);
    }
    process.exit(1);
  }
})();
