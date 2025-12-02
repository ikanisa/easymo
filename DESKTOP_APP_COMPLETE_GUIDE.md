# 🖥️ EasyMO Desktop App - Complete Guide

**Two desktop apps from one codebase:** Admin Panel + Client/Staff Portal

---

## 🎯 Quick Start

### Option 1: One-Command Launch (Recommended)

```bash
./start-desktop-app.sh
```

This automatically:
1. Kills any process on port 3000
2. Starts Next.js dev server
3. Waits for server to be ready
4. Launches Electron app
5. Cleans up on exit

### Option 2: Manual Launch

```bash
# Terminal 1: Start Next.js
cd admin-app
npm run dev

# Terminal 2: Start Electron (wait for Next.js to be ready)
cd admin-app
npm run desktop
```

### Option 3: Using Make

```bash
make desktop  # If Makefile has desktop target
```

---

## 📁 Project Structure

```
/
├── admin-app/
│   ├── electron/
│   │   └── main.js              # Electron main process
│   ├── app/                      # Next.js app directory
│   ├── components/               # React components
│   ├── lib/                      # Utilities & adapters
│   ├── package.json              # "main": "electron/main.js"
│   ├── next.config.mjs           # Next.js configuration
│   └── .env.local                # Environment variables
│
├── scripts/
│   ├── list_identities.sh        # List macOS signing identities
│   ├── sign_app.sh               # Sign one .app bundle
│   └── sign_all_apps.sh          # Sign both apps
│
├── docs/
│   ├── internal_mac_signing.md   # macOS signing guide
│   ├── github_actions_signing.md # CI/CD signing
│   └── SIGNING_REFERENCE.md      # Complete signing reference
│
└── start-desktop-app.sh          # Quick start script
```

---

## 🔧 Prerequisites

### Required Software

```bash
# Node.js 18+
node --version  # Should be >= 18.18.0

# pnpm (NOT npm for root workspace)
pnpm --version  # Should be >= 10.18.3

# Install pnpm if needed:
npm install -g pnpm@10.18.3
```

### Install Dependencies

```bash
# From repository root:
pnpm install --frozen-lockfile

# Build shared packages FIRST:
pnpm --filter @va/shared build
pnpm --filter @easymo/commons build
```

---

## 🚀 Development

### Running the App

```bash
# Quick start (recommended):
./start-desktop-app.sh

# Or manually:
cd admin-app
npm run dev        # Terminal 1: Next.js
npm run desktop    # Terminal 2: Electron
```

### Hot Reload

- **Next.js changes:** Automatic reload in Electron window
- **Electron main.js changes:** Restart Electron (Cmd+Q, then rerun)
- **Quick reload:** Press `Cmd+R` in Electron window

### Opening DevTools

- **Development mode:** DevTools open automatically
- **Manual toggle:** View → Toggle Developer Tools
- **Or:** `Cmd+Opt+I`

---

## 🏗️ Building for Production

### macOS Build

```bash
cd admin-app

# Build Next.js static export:
npm run build

# Package with Electron Builder:
npm run build:desktop

# Output: dist/mac/EasyMO Admin Panel.app
```

### Sign macOS Apps

```bash
# List available signing identities:
./scripts/list_identities.sh

# Set identity:
export SIGNING_IDENTITY="Inhouse Dev Signing"

# Sign both apps:
./scripts/sign_all_apps.sh

# Or sign one app:
./scripts/sign_app.sh /path/to/AdminPanel.app "$SIGNING_IDENTITY"
```

### Verify Signature

```bash
# Verify code signature:
codesign --verify --deep --strict --verbose=2 "dist/mac/AdminPanel.app"

# Check Gatekeeper:
spctl --assess --verbose=4 "dist/mac/AdminPanel.app"
```

---

## 🔐 Code Signing Setup

### Create Self-Signed Certificate

1. Open **Keychain Access**
2. Menu: **Keychain Access → Certificate Assistant → Create a Certificate**
3. Settings:
   - Name: `Inhouse Dev Signing`
   - Identity Type: `Self-Signed Root`
   - Certificate Type: `Code Signing`
   - Let me override defaults: ✅
4. Click **Continue** through dialogs
5. Keychain: `login`
6. Right-click certificate → **Get Info** → Trust → Code Signing: **Always Trust**

### Export Certificate (.p12)

```bash
# In Keychain Access:
# 1. Select "Inhouse Dev Signing" certificate
# 2. File → Export Items
# 3. Format: Personal Information Exchange (.p12)
# 4. Save as: inhouse-signing.p12
# 5. Set password when prompted
```

### Import on Other Macs

```bash
# Double-click .p12 file, or:
security import inhouse-signing.p12 -k ~/Library/Keychains/login.keychain-db

# Mark as trusted:
# Open Keychain Access → Find certificate → Get Info → Trust → Always Trust
```

---

## 🌐 Environment Variables

### Client-Safe (Public)

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
```

### Server-Only (NEVER expose to client)

```bash
# .env.local (server-side only)
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
EASYMO_ADMIN_TOKEN=your-secret-token
ADMIN_SESSION_SECRET=min-16-chars-secret
```

**⚠️ CRITICAL:** Never put `SUPABASE_SERVICE_ROLE_KEY` in any `NEXT_PUBLIC_*` or `VITE_*` variable!

---

## 🎨 Customization

### App Name & Branding

```javascript
// electron/main.js
title: 'EasyMO Admin Panel',  // Change window title
backgroundColor: '#1a1a1a',    // Change background color
```

### Window Size

```javascript
// electron/main.js
width: 1400,
height: 900,
minWidth: 1024,
minHeight: 768,
```

### Menu Bar

```javascript
// electron/main.js - createMenu()
// Customize menu items, add custom actions
```

---

## 🐛 Troubleshooting

### "Cannot find module '@easymo/commons'"

```bash
# Build shared packages first:
pnpm --filter @va/shared build
pnpm --filter @easymo/commons build
```

### "Port 3000 already in use"

```bash
# Kill process on port 3000:
lsof -ti:3000 | xargs kill -9

# Or use the start script (handles this automatically):
./start-desktop-app.sh
```

### "App can't be opened because it is from an unidentified developer"

```bash
# First time launch:
# Right-click app → Open → Open (macOS will remember)

# Or sign the app:
./scripts/sign_all_apps.sh
```

### Electron window blank/white

```bash
# Check Next.js is running:
curl http://localhost:3000

# Check Electron console (Cmd+Opt+I):
# Look for errors loading URL

# Try force reload:
# Cmd+R in Electron window
```

### "SECURITY VIOLATION: Service role key in client env"

```bash
# Remove from NEXT_PUBLIC_* variables:
# Edit .env.local
# Remove any NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
# Keep only in server-side: SUPABASE_SERVICE_ROLE_KEY
```

---

## 📦 Distribution

### Internal Distribution (Current)

1. **Build & Sign:**
   ```bash
   cd admin-app
   npm run build:desktop
   cd ..
   ./scripts/sign_all_apps.sh
   ```

2. **Package:**
   ```bash
   # Compress signed apps:
   cd dist/mac
   zip -r AdminPanel-macOS.zip "AdminPanel.app"
   zip -r ClientPortal-macOS.zip "ClientPortal.app"
   ```

3. **Distribute:**
   - Upload to internal file server
   - Share via Slack/email
   - Or use GitHub Releases

### GitHub Releases (Recommended)

```bash
# Tag and push:
git tag v1.0.0
git push origin v1.0.0

# CI/CD will:
# 1. Build apps
# 2. Sign apps
# 3. Create GitHub Release
# 4. Upload artifacts
```

---

## 🚀 CI/CD Integration

### GitHub Actions Secrets

Configure in **GitHub → Settings → Secrets → Actions:**

| Secret | Value | How to Get |
|--------|-------|------------|
| `MACOS_CERT_P12` | Base64 cert | `base64 -i inhouse-signing.p12 | pbcopy` |
| `MACOS_CERT_PASSWORD` | P12 password | Password you set when exporting |
| `MACOS_CERT_IDENTITY` | Certificate name | `"Inhouse Dev Signing"` |

### Workflow Example

```yaml
# .github/workflows/build-desktop.yml
name: Build Desktop
on:
  push:
    tags: ['v*']

jobs:
  build-macos:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup signing
        run: |
          echo "${{ secrets.MACOS_CERT_P12 }}" | base64 -d > cert.p12
          security create-keychain -p actions temp.keychain
          security import cert.p12 -k temp.keychain -P "${{ secrets.MACOS_CERT_PASSWORD }}"
          security set-key-partition-list -S apple-tool:,apple: -k actions temp.keychain
      - name: Build & Sign
        run: |
          cd admin-app
          npm ci
          npm run build:desktop
          cd ..
          ./scripts/sign_all_apps.sh
```

---

## 📚 Additional Documentation

- **Signing Reference:** [docs/SIGNING_REFERENCE.md](docs/SIGNING_REFERENCE.md)
- **macOS Signing:** [docs/internal_mac_signing.md](docs/internal_mac_signing.md)
- **GitHub Actions:** [docs/github_actions_signing.md](docs/github_actions_signing.md)
- **Deployment Checklist:** [DESKTOP_DEPLOYMENT_MASTER_CHECKLIST.md](DESKTOP_DEPLOYMENT_MASTER_CHECKLIST.md)

---

## 🎯 Current Status

| Feature | Status | Notes |
|---------|--------|-------|
| Desktop App | ✅ Running | Electron + Next.js |
| Hot Reload | ✅ Working | Cmd+R to reload |
| DevTools | ✅ Available | Cmd+Opt+I |
| macOS Signing | ✅ Scripts Ready | Test with `./scripts/sign_all_apps.sh` |
| Windows Build | ⬜ TODO | Need Electron Builder config |
| Linux Build | ⬜ TODO | Need AppImage config |
| Auto-Update | ⬜ TODO | Electron AutoUpdater |
| CI/CD Pipeline | ⬜ TODO | GitHub Actions workflow |

---

## 🔗 Quick Commands

```bash
# Start app
./start-desktop-app.sh

# List signing identities
./scripts/list_identities.sh

# Sign apps
./scripts/sign_all_apps.sh

# Build for production
cd admin-app && npm run build:desktop

# Clean Next.js cache
cd admin-app && rm -rf .next

# Clean build artifacts
cd admin-app && rm -rf dist out
```

---

## 🆘 Need Help?

1. **Check logs:** `/tmp/easymo-nextjs.log`
2. **Open DevTools:** Cmd+Opt+I in Electron window
3. **Check Next.js:** `curl http://localhost:3000`
4. **Review docs:** See `docs/` folder
5. **Ask team:** Slack #desktop-support

---

**Last Updated:** December 2, 2025  
**Version:** 1.0.0  
**Maintained by:** EasyMO Desktop Team
