#!/usr/bin/env node
/**
 * Generate update manifest for Tauri updater
 * Usage: node generate-update-manifest.js <version> <artifacts-dir>
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const [,, version, artifactsDir = 'artifacts'] = process.argv;

if (!version) {
  console.error('Error: Version is required');
  console.error('Usage: node generate-update-manifest.js <version> [artifacts-dir]');
  process.exit(1);
}

console.log(`Generating update manifest for version ${version}...`);

const manifest = {
  version,
  date: new Date().toISOString(),
  platforms: {},
  notes: `EasyMO Admin Desktop ${version}`
};

// Platform configurations
const platforms = [
  {
    key: 'windows-x86_64',
    dir: 'windows-x86_64',
    pattern: /easymo-admin.*_x64.*\.msi$/,
    sigPattern: /easymo-admin.*_x64.*\.msi\.sig$/,
  },
  {
    key: 'darwin-x86_64',
    dir: 'darwin-x86_64',
    pattern: /easymo-admin.*_x64.*\.dmg$/,
    sigPattern: /easymo-admin.*_x64.*\.dmg\.sig$/,
  },
  {
    key: 'darwin-aarch64',
    dir: 'darwin-aarch64',
    pattern: /easymo-admin.*_aarch64.*\.dmg$/,
    sigPattern: /easymo-admin.*_aarch64.*\.dmg\.sig$/,
  },
];

// Process each platform
for (const platform of platforms) {
  const platformDir = path.join(artifactsDir, platform.dir);
  
  if (!fs.existsSync(platformDir)) {
    console.warn(`Warning: Platform directory not found: ${platformDir}`);
    continue;
  }

  const files = fs.readdirSync(platformDir);
  
  // Find installer file
  const installerFile = files.find(f => platform.pattern.test(f));
  if (!installerFile) {
    console.warn(`Warning: No installer found for ${platform.key}`);
    continue;
  }

  // Find signature file
  const sigFile = files.find(f => platform.sigPattern.test(f));
  if (!sigFile) {
    console.warn(`Warning: No signature found for ${platform.key}`);
    continue;
  }

  // Read signature
  const sigPath = path.join(platformDir, sigFile);
  const signature = fs.readFileSync(sigPath, 'utf8').trim();

  // Get file size
  const installerPath = path.join(platformDir, installerFile);
  const stats = fs.statSync(installerPath);
  const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

  // Build download URL (for now, use GitHub releases)
  // TODO: Update to use releases.easymo.dev when available
  const downloadUrl = `https://github.com/ikanisa/easymo/releases/download/desktop-v${version}/${installerFile}`;

  manifest.platforms[platform.key] = {
    signature,
    url: downloadUrl,
    size: stats.size,
  };

  console.log(`✓ ${platform.key}: ${installerFile} (${sizeInMB} MB)`);
}

// Validate manifest
if (Object.keys(manifest.platforms).length === 0) {
  console.error('Error: No platforms found in manifest');
  process.exit(1);
}

// Write manifest
const manifestPath = 'latest.json';
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

console.log(`\n✓ Manifest generated: ${manifestPath}`);
console.log(`  Version: ${manifest.version}`);
console.log(`  Platforms: ${Object.keys(manifest.platforms).join(', ')}`);
console.log(`  Date: ${manifest.date}`);

// Also write per-platform manifests for the update server structure
for (const [platformKey, platformData] of Object.entries(manifest.platforms)) {
  const platformManifest = {
    version: manifest.version,
    date: manifest.date,
    platform: platformKey,
    ...platformData,
    notes: manifest.notes,
  };

  const platformManifestPath = `${platformKey}-latest.json`;
  fs.writeFileSync(platformManifestPath, JSON.stringify(platformManifest, null, 2));
  console.log(`  ✓ ${platformManifestPath}`);
}

console.log('\n✓ Update manifest generation complete!');
