# EasyMO Desktop App Deployment Guide

Internal deployment guide for EasyMO Admin Panel and Client Portal desktop applications.

> **Note**: These are internal in-house deployments only.

## Overview

| App | Identifier | Window Size | Purpose |
|-----|------------|-------------|---------|
| Admin Panel | `com.easymo.admin` | 1400x900 | Operations hub for staff |
| Client Portal | `com.easymo.client` | 420x800 | Customer-facing app |

## Prerequisites

1. **Rust** - Install via [rustup](https://rustup.rs/)
2. **Node.js 20+** and **pnpm 8+**
3. **Platform-specific requirements:**
   - **macOS**: Xcode Command Line Tools
   - **Windows**: Visual Studio Build Tools, WebView2
   - **Linux**: webkit2gtk, libappindicator

## Admin Panel Desktop

### Development

```bash
cd admin-app
pnpm install
pnpm tauri:dev
```

### Build for Distribution

```bash
# macOS (Intel)
pnpm tauri:build:mac

# macOS (Apple Silicon)
pnpm tauri:build:mac-arm

# macOS (Universal)
pnpm tauri:build:universal

# Windows
pnpm tauri:build:win
```

### Output Location
- macOS: `src-tauri/target/release/bundle/dmg/`
- Windows: `src-tauri/target/release/bundle/msi/`
- Linux: `src-tauri/target/release/bundle/deb/`

## Client Portal Desktop

### Development

```bash
cd client-pwa
pnpm install
pnpm tauri:dev
```

### Build for Distribution

```bash
# macOS (Intel)
pnpm tauri:build:mac

# macOS (Apple Silicon)
pnpm tauri:build:mac-arm

# Windows
pnpm tauri:build:win
```

### Output Location
- macOS: `src-tauri/target/release/bundle/dmg/`
- Windows: `src-tauri/target/release/bundle/msi/`

## Internal Distribution

### Option 1: Direct File Sharing
1. Build the app for target platform
2. Share the installer via internal file server or cloud storage
3. Users download and install manually

### Option 2: Auto-Update Server (Admin Panel)
The admin panel supports auto-updates via Tauri updater:
1. Host update manifests at `https://releases.easymo.dev/desktop/`
2. Configure `plugins.updater.endpoints` in `tauri.conf.json`
3. Sign updates with the configured public key

## Code Signing (macOS)

For internal distribution without App Store:

```bash
# Create self-signed certificate
./scripts/check_certificate.sh

# Sign the app
./scripts/sign_app.sh admin-app
./scripts/sign_app.sh client-pwa
```

See [docs/internal_mac_signing.md](./internal_mac_signing.md) for details.

## Environment Variables

Set in `.env.local` before building:

```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Admin Panel only
EASYMO_ADMIN_TOKEN=your-admin-token
```

## Quick Build Commands

```bash
# Build both apps for macOS ARM
cd admin-app && pnpm tauri:build:mac-arm
cd ../client-pwa && pnpm tauri:build:mac-arm

# Or use the deployment script
./scripts/deploy-desktop.sh all mac-arm
```

## Troubleshooting

### Rust not found
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env
```

### WebView2 missing (Windows)
Download from: https://developer.microsoft.com/en-us/microsoft-edge/webview2/

### Build fails with "framework not found"
```bash
xcode-select --install
```

## Supported Countries

Both apps operate in exactly 4 countries:
- 🇷🇼 RW - Rwanda (Primary)
- 🇨🇩 CD - DR Congo
- 🇧🇮 BI - Burundi
- 🇹🇿 TZ - Tanzania
