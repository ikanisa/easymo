#!/usr/bin/env node

/**
 * PWA Icon Generator
 * Creates PNG icons for the Waiter AI PWA
 * Run: node scripts/generate-icons.js
 */

const fs = require('fs');
const path = require('path');

// Simple SVG template for the Waiter AI icon
const createSVG = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="${size}" height="${size}" fill="#0ea5e9" rx="${size * 0.15}"/>
  
  <!-- Waiter icon (simplified) -->
  <g transform="translate(${size * 0.25}, ${size * 0.2})">
    <!-- Plate -->
    <ellipse cx="${size * 0.25}" cy="${size * 0.5}" rx="${size * 0.2}" ry="${size * 0.05}" fill="#ffffff" opacity="0.9"/>
    <ellipse cx="${size * 0.25}" cy="${size * 0.5}" rx="${size * 0.18}" ry="${size * 0.04}" fill="#e0f2fe"/>
    
    <!-- Fork and Knife -->
    <path d="M ${size * 0.15} ${size * 0.35} L ${size * 0.15} ${size * 0.5}" stroke="#ffffff" stroke-width="${size * 0.02}" stroke-linecap="round"/>
    <path d="M ${size * 0.12} ${size * 0.35} L ${size * 0.12} ${size * 0.42}" stroke="#ffffff" stroke-width="${size * 0.015}" stroke-linecap="round"/>
    <path d="M ${size * 0.18} ${size * 0.35} L ${size * 0.18} ${size * 0.42}" stroke="#ffffff" stroke-width="${size * 0.015}" stroke-linecap="round"/>
    
    <path d="M ${size * 0.35} ${size * 0.35} L ${size * 0.35} ${size * 0.5}" stroke="#ffffff" stroke-width="${size * 0.025}" stroke-linecap="round"/>
    <path d="M ${size * 0.33} ${size * 0.35} L ${size * 0.37} ${size * 0.38}" stroke="#ffffff" stroke-width="${size * 0.02}" stroke-linecap="round"/>
  </g>
  
  <!-- AI Spark -->
  <g transform="translate(${size * 0.65}, ${size * 0.25})">
    <circle cx="0" cy="0" r="${size * 0.08}" fill="#fbbf24" opacity="0.9"/>
    <path d="M 0 ${-size * 0.12} L 0 ${size * 0.12} M ${-size * 0.12} 0 L ${size * 0.12} 0" stroke="#ffffff" stroke-width="${size * 0.025}" stroke-linecap="round"/>
  </g>
</svg>
`;

// Output directories
const publicDir = path.join(__dirname, '..', 'public');

// Generate icons
const sizes = [192, 512];

sizes.forEach(size => {
  const svg = createSVG(size);
  const filename = `icon-${size}.svg`;
  const filepath = path.join(publicDir, filename);
  
  fs.writeFileSync(filepath, svg.trim());
  console.log(`✅ Created ${filename}`);
});

// Update manifest to use SVG icons (modern browsers support SVG)
const manifestPath = path.join(publicDir, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

manifest.icons = [
  {
    "src": "/icon-192.svg",
    "sizes": "192x192",
    "type": "image/svg+xml",
    "purpose": "any maskable"
  },
  {
    "src": "/icon-512.svg",
    "sizes": "512x512",
    "type": "image/svg+xml",
    "purpose": "any maskable"
  }
];

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log('✅ Updated manifest.json');

// Create favicon
const faviconSVG = createSVG(32);
fs.writeFileSync(path.join(publicDir, 'favicon.svg'), faviconSVG.trim());
console.log('✅ Created favicon.svg');

console.log('\n🎉 PWA icons generated successfully!');
console.log('\nNote: SVG icons work in modern browsers. For PNG icons, use an online converter or ImageMagick:');
console.log('  convert public/icon-192.svg public/icon-192.png');
console.log('  convert public/icon-512.svg public/icon-512.png\n');
