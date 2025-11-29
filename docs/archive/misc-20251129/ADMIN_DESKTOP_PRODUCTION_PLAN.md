# EasyMO Admin Desktop App - Production Implementation Plan
**Created:** 2025-11-28  
**Target Completion:** 2025-12-19 (3 weeks)  
**Status:** 🔴 Not Started  

---

## 📋 EXECUTIVE SUMMARY

This plan addresses **10 blocking/high-priority issues** identified in the production audit. Implementation is divided into 4 phases over 3 weeks, with clear ownership, success criteria, and rollback procedures.

**Critical Path Items:**
1. Security hardening (can start immediately)
2. Code signing certificate procurement (1 week lead time)
3. Auto-updater implementation (depends on signing keys)
4. Platform-specific builds & testing

---

## 🗓️ PHASE 1: IMMEDIATE FIXES (Week 1: Dec 2-6)
**Goal:** Fix code-level security issues and bugs  
**Owner:** Development Team  
**Estimated Effort:** 8-12 hours  

### 1.1 Remove DevTools from Production Build
**Priority:** 🔴 CRITICAL  
**File:** `admin-app/src-tauri/Cargo.toml`  
**Estimated Time:** 30 minutes  

**Current State:**
```toml
[dependencies]
tauri = { version = "2.9.2", features = ["tray-icon", "devtools"] }
```

**Target State:**
```toml
[features]
default = []
devtools = ["tauri/devtools"]

[dependencies]
tauri = { version = "2.9.2", features = ["tray-icon"] }
```

**Implementation Steps:**
1. Add `[features]` section to Cargo.toml
2. Remove `devtools` from default dependencies
3. Update dev command to use feature flag:
   ```json
   // package.json
   "tauri:dev": "tauri dev --features devtools"
   ```
4. Test dev mode still has devtools
5. Test production build doesn't have devtools

**Success Criteria:**
- [ ] Dev build: F12 opens devtools
- [ ] Production build: F12 does nothing
- [ ] CI/CD builds without errors

**Rollback:** Revert commit and rebuild

---

### 1.2 Fix Duplicate Plugin Registration
**Priority:** 🔴 CRITICAL  
**File:** `admin-app/src-tauri/src/lib.rs`  
**Estimated Time:** 20 minutes  

**Current State:**
```rust
// Line 26: First registration
.plugin(tauri_plugin_global_shortcut::Builder::new().build())

// Line 145-146: Duplicate registration in setup_shortcuts()
app.handle()
    .plugin(tauri_plugin_global_shortcut::Builder::new().build())?;
```

**Target State:**
```rust
// Keep line 26 registration only
.plugin(tauri_plugin_global_shortcut::Builder::new().build())

// Remove duplicate from setup_shortcuts()
fn setup_shortcuts<R: Runtime>(app: &tauri::App<R>) -> tauri::Result<()> {
    use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};
    
    // Plugin already registered at app level, just use it
    let shortcut = if cfg!(target_os = "macos") {
        Shortcut::new(Some(Modifiers::META), Code::KeyK)
    } else {
        Shortcut::new(Some(Modifiers::CONTROL), Code::KeyK)
    };
    
    let app_handle = app.handle().clone();
    // NO .plugin() call here
    app.global_shortcut().on_shortcut(shortcut, move |_app, _shortcut, _event| {
        // ... existing logic
    })?;
    
    Ok(())
}
```

**Success Criteria:**
- [ ] App starts without plugin registration errors
- [ ] Cmd/Ctrl+K shortcut still works
- [ ] No duplicate registration warnings in logs

**Rollback:** Revert commit

---

### 1.3 Harden Content Security Policy
**Priority:** 🔴 CRITICAL  
**File:** `admin-app/src-tauri/tauri.conf.json`  
**Estimated Time:** 2 hours (includes testing)  

**Current State:**
```json
"csp": {
  "default-src": "'self'",
  "connect-src": "'self' https://*.supabase.co wss://*.supabase.co https://sentry.io",
  "script-src": "'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src": "'self' 'unsafe-inline'",
  "img-src": "'self' data: https://*.supabase.co blob:",
  "font-src": "'self' data:"
}
```

**Target State:**
```json
"csp": {
  "default-src": "'self'",
  "connect-src": "'self' https://*.supabase.co wss://*.supabase.co https://sentry.io https://o4507916341673984.ingest.us.sentry.io",
  "script-src": "'self' 'wasm-unsafe-eval'",
  "style-src": "'self'",
  "img-src": "'self' data: https://*.supabase.co blob:",
  "font-src": "'self' data:"
}
```

**Implementation Steps:**
1. Remove `unsafe-inline` from script-src (Next.js 15 supports this)
2. Replace `unsafe-eval` with `wasm-unsafe-eval` (for WebAssembly only)
3. Remove `unsafe-inline` from style-src
4. Test all app features work:
   - [ ] Login flow
   - [ ] Dashboard loads
   - [ ] Charts render
   - [ ] Modals work
   - [ ] Forms submit
   - [ ] Tailwind styles apply

**Known Issues:**
- Some inline styles may break (check Tailwind JIT)
- Dynamic component loading may need adjustment

**Success Criteria:**
- [ ] All routes render correctly
- [ ] No CSP violations in console (production build)
- [ ] Security scan passes

**Rollback:** Revert to previous CSP configuration

---

### 1.4 Fix Public Path Matching Bug
**Priority:** 🟡 HIGH  
**File:** `admin-app/middleware.ts`  
**Estimated Time:** 1 hour  

**Current State:**
```typescript
function isPublicPath(pathname: string): boolean {
  if (pathname === '/') return true;
  if (PUBLIC_PATHS.some((p) => p !== '/' && pathname.startsWith(p))) return true;
  // ...
}
```

**Problem:** `/loginadmin` would match `/login`

**Target State:**
```typescript
function isPublicPath(pathname: string): boolean {
  if (pathname === '/') return true;
  
  // Exact match for public paths
  if (PUBLIC_PATHS.includes(pathname)) return true;
  
  // Match with trailing slash for directory paths
  if (PUBLIC_PATHS.some((p) => {
    if (p === '/') return false;
    return pathname === p || pathname.startsWith(p + '/');
  })) return true;
  
  // File extensions
  if (pathname.endsWith('.svg') || pathname.endsWith('.ico') || pathname.endsWith('.png')) return true;
  if (pathname.startsWith('/_next/')) return true;
  
  return false;
}
```

**Test Cases:**
```typescript
// tests/middleware.test.ts
describe('isPublicPath', () => {
  it('allows exact public paths', () => {
    expect(isPublicPath('/login')).toBe(true);
  });
  
  it('blocks similar paths', () => {
    expect(isPublicPath('/loginadmin')).toBe(false);
  });
  
  it('allows sub-paths with trailing slash', () => {
    expect(isPublicPath('/_next/static/chunk.js')).toBe(true);
  });
});
```

**Success Criteria:**
- [ ] All tests pass
- [ ] `/login` is accessible
- [ ] `/loginadmin` requires auth
- [ ] `/_next/*` paths work

**Rollback:** Revert commit

---

### 1.5 Add Error Logging to Tray Events
**Priority:** 🟡 HIGH  
**File:** `admin-app/src-tauri/src/lib.rs`  
**Estimated Time:** 30 minutes  

**Current State:**
```rust
"show" => {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}
```

**Target State:**
```rust
"show" => {
    if let Some(window) = app.get_webview_window("main") {
        if let Err(e) = window.show() {
            log::error!("Failed to show window: {}", e);
        }
        if let Err(e) = window.set_focus() {
            log::error!("Failed to focus window: {}", e);
        }
    } else {
        log::warn!("Main window not found when trying to show");
    }
}
```

**Apply to all tray menu events:**
- "show"
- "hide"
- "quit"

**Success Criteria:**
- [ ] Errors are logged to tauri logs
- [ ] No silent failures
- [ ] Logs viewable via `tauri-plugin-log`

**Rollback:** Revert commit

---

### 1.6 Add Missing Security Headers
**Priority:** 🟡 HIGH  
**File:** `admin-app/next.config.mjs`  
**Estimated Time:** 30 minutes  

**Current State:**
```javascript
headers: [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
]
```

**Target State:**
```javascript
headers: [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
]
```

**Success Criteria:**
- [ ] All headers present in response
- [ ] Security scan improves score
- [ ] No browser warnings

**Rollback:** Revert commit

---

### 1.7 Fix Minor Issues
**Priority:** 🟢 MEDIUM  
**Estimated Time:** 15 minutes  

**1.7.1 Fix Repository URL**
```toml
# admin-app/src-tauri/Cargo.toml
repository = "https://github.com/ikanisa/easymo"  # Remove trailing hyphen
```

**1.7.2 Change App Identifier**
```json
// admin-app/src-tauri/tauri.conf.json
"identifier": "com.easymo.admin"  // Change from dev.easymo.admin
```

**Success Criteria:**
- [ ] Links resolve correctly
- [ ] App bundle has correct identifier

---

### Phase 1 Deliverables
- [ ] All code-level security fixes merged
- [ ] Unit tests pass
- [ ] Dev build works with devtools
- [ ] Production build has no devtools
- [ ] No duplicate plugin errors
- [ ] CSP violations resolved
- [ ] Security headers added
- [ ] All bugs fixed

**Phase 1 Sign-off:** Development Lead + Security Review

---

## 🔐 PHASE 2: CODE SIGNING SETUP (Week 1-2: Dec 2-13)
**Goal:** Obtain certificates and configure signing  
**Owner:** DevOps + Finance  
**Estimated Effort:** 1-2 weeks lead time  

### 2.1 Windows Code Signing Certificate
**Priority:** 🔴 CRITICAL  
**Lead Time:** 5-7 business days  
**Cost:** $300-500/year  

**Recommended Provider:** DigiCert or Sectigo

**Certificate Type Options:**

| Type | Validation | Cost | SmartScreen | Delivery |
|------|------------|------|-------------|----------|
| Standard OV | Organization | $300/yr | Slow reputation | 3-5 days |
| EV Code Signing | Extended | $500/yr | Instant reputation | 5-7 days + hardware token |

**Recommendation:** EV Certificate (better SmartScreen reputation)

**Steps:**
1. **Day 1:** Start certificate application
   - Prepare company documents (Articles of Incorporation, EIN)
   - Prepare authorized signer documents (Driver's license, passport)
   - Fill out DigiCert/Sectigo application

2. **Day 2-5:** Validation process
   - Respond to validation emails/calls
   - Verify business phone/address
   - Complete identity verification

3. **Day 6-7:** Receive certificate
   - EV: USB token shipped
   - Standard: PFX file download

4. **Day 8:** Configure signing in CI/CD
   ```yaml
   # .github/workflows/desktop-build.yml
   - name: Import Windows certificate
     run: |
       echo "${{ secrets.WINDOWS_CERTIFICATE }}" | base64 -d > cert.pfx
       
   - name: Sign Windows build
     run: |
       tauri build --target x86_64-pc-windows-msvc
     env:
       WINDOWS_CERTIFICATE: ${{ secrets.WINDOWS_CERTIFICATE }}
       WINDOWS_CERTIFICATE_PASSWORD: ${{ secrets.WINDOWS_CERT_PASSWORD }}
   ```

**Success Criteria:**
- [ ] Certificate obtained
- [ ] Certificate imported to build machine
- [ ] Test build is signed
- [ ] Signature verifies with `signtool verify`

**Cost:** $300-500 (one-time annual)

---

### 2.2 macOS Code Signing Setup
**Priority:** 🔴 CRITICAL  
**Lead Time:** 1-2 days  
**Cost:** $99/year  

**Steps:**

1. **Day 1: Enroll in Apple Developer Program**
   - Visit https://developer.apple.com/programs/
   - Pay $99 annual fee
   - Wait for approval (usually 24 hours)

2. **Day 2: Create Certificates**
   ```bash
   # On macOS build machine
   # Request Developer ID Application certificate
   open https://developer.apple.com/account/resources/certificates/add
   
   # Select "Developer ID Application"
   # Download and install in Keychain
   ```

3. **Day 2: Configure Tauri**
   ```json
   // admin-app/src-tauri/tauri.conf.json
   {
     "bundle": {
       "macOS": {
         "signingIdentity": "Developer ID Application: EasyMO Platform (TEAM_ID)",
         "entitlements": "src-tauri/Entitlements.plist",
         "exceptionDomain": null
       }
     }
   }
   ```

4. **Day 2: Create Entitlements**
   ```xml
   <!-- admin-app/src-tauri/Entitlements.plist -->
   <?xml version="1.0" encoding="UTF-8"?>
   <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
   <plist version="1.0">
   <dict>
       <key>com.apple.security.app-sandbox</key>
       <true/>
       <key>com.apple.security.network.client</key>
       <true/>
       <key>com.apple.security.network.server</key>
       <false/>
       <key>com.apple.security.files.user-selected.read-write</key>
       <true/>
       <key>com.apple.security.files.downloads.read-write</key>
       <true/>
   </dict>
   </plist>
   ```

5. **Day 3: Setup Notarization**
   ```bash
   # Create app-specific password for notarization
   # Visit https://appleid.apple.com/account/manage
   # Generate app-specific password
   
   # Store in keychain
   xcrun notarytool store-credentials "easymo-notary" \
     --apple-id "your@email.com" \
     --team-id "TEAM_ID" \
     --password "app-specific-password"
   ```

6. **Day 3: Configure CI/CD**
   ```yaml
   # .github/workflows/desktop-build.yml
   - name: Build and sign macOS
     run: tauri build --target universal-apple-darwin
     env:
       APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
       APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERT_PASSWORD }}
       APPLE_ID: ${{ secrets.APPLE_ID }}
       APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
       APPLE_PASSWORD: ${{ secrets.APPLE_APP_PASSWORD }}
   ```

**Success Criteria:**
- [ ] Apple Developer account active
- [ ] Certificates created and installed
- [ ] Entitlements file created
- [ ] Test build is signed
- [ ] Notarization credentials configured

**Cost:** $99/year

---

### 2.3 Tauri Signing Keys for Auto-Updates
**Priority:** 🔴 CRITICAL  
**Estimated Time:** 1 hour  

**Steps:**

1. **Generate Signing Keys**
   ```bash
   cd admin-app
   
   # Generate key pair
   npm run tauri signer generate -- -w ~/.tauri/easymo-admin.key
   
   # Output will show:
   # Your private key was saved to ~/.tauri/easymo-admin.key
   # Your public key:
   # dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IEFCQzEyMzQ1Njc4OQ==
   ```

2. **Store Private Key Securely**
   ```bash
   # GitHub Secrets
   gh secret set TAURI_SIGNING_PRIVATE_KEY < ~/.tauri/easymo-admin.key
   
   # Also create password secret
   gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD
   ```

3. **Update tauri.conf.json**
   ```json
   {
     "plugins": {
       "updater": {
         "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IEFCQzEyMzQ1Njc4OQ==",
         "endpoints": [
           "https://releases.easymo.dev/desktop/{{target}}/{{current_version}}"
         ],
         "windows": {
           "installMode": "passive"
         }
       }
     }
   }
   ```

4. **Enable Updater Plugin**
   ```toml
   # admin-app/src-tauri/Cargo.toml
   [dependencies]
   tauri-plugin-updater = "2"
   ```

   ```rust
   // admin-app/src-tauri/src/lib.rs (line 25)
   .plugin(tauri_plugin_updater::Builder::new().build())
   ```

**Success Criteria:**
- [ ] Keys generated
- [ ] Private key secured in GitHub Secrets
- [ ] Public key added to config
- [ ] Build succeeds with updater enabled

**Rollback:** Comment out updater plugin again

---

### Phase 2 Deliverables
- [ ] Windows code signing certificate obtained
- [ ] macOS Developer account active
- [ ] macOS certificates created
- [ ] Tauri signing keys generated
- [ ] All secrets stored in CI/CD
- [ ] Entitlements.plist created
- [ ] Test builds are signed

**Phase 2 Sign-off:** DevOps Lead + Security Team

---

## 🚀 PHASE 3: AUTO-UPDATE INFRASTRUCTURE (Week 2: Dec 9-13)
**Goal:** Deploy update server and implement update flow  
**Owner:** Backend Team  
**Estimated Effort:** 16-20 hours  

### 3.1 Deploy Update Server
**Priority:** 🔴 CRITICAL  
**Estimated Time:** 8 hours  

**Architecture:**
```
releases.easymo.dev
├── /desktop/
│   ├── windows-x86_64/
│   │   ├── 1.0.0/
│   │   │   ├── latest.json
│   │   │   └── easymo-admin_1.0.0_x64_en-US.msi.zip
│   │   └── 1.0.1/
│   ├── darwin-x86_64/
│   │   └── 1.0.0/
│   │       ├── latest.json
│   │       └── easymo-admin_1.0.0_x64.app.tar.gz
│   └── darwin-aarch64/
│       └── 1.0.0/
```

**Implementation:**

**Option A: Static CDN (Recommended for MVP)**
```bash
# Use Cloudflare R2 or AWS S3 + CloudFront
# Benefits: Simple, cheap, fast
# Cost: ~$5/month

# Setup Cloudflare R2 bucket
wrangler r2 bucket create easymo-releases

# Configure custom domain
# releases.easymo.dev -> R2 bucket

# Upload releases manually or via CI
```

**Option B: Dedicated Update Server**
```typescript
// services/update-server/src/index.ts
import express from 'express';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const app = express();
const s3 = new S3Client({ region: 'us-east-1' });

app.get('/desktop/:platform/:version', async (req, res) => {
  const { platform, version } = req.params;
  const currentVersion = req.query.current_version;
  
  // Check if update available
  const latestVersion = await getLatestVersion(platform);
  
  if (isNewerVersion(latestVersion, currentVersion)) {
    const manifest = {
      version: latestVersion,
      date: new Date().toISOString(),
      platforms: {
        [platform]: {
          signature: await getSignature(platform, latestVersion),
          url: `https://releases.easymo.dev/desktop/${platform}/${latestVersion}/bundle.zip`
        }
      }
    };
    res.json(manifest);
  } else {
    res.status(204).send(); // No update available
  }
});

app.listen(3000);
```

**Manifest Format (latest.json):**
```json
{
  "version": "1.0.1",
  "date": "2025-12-13T00:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "base64_signature_here",
      "url": "https://releases.easymo.dev/desktop/windows-x86_64/1.0.1/easymo-admin_1.0.1_x64_en-US.msi.zip"
    },
    "darwin-x86_64": {
      "signature": "base64_signature_here",
      "url": "https://releases.easymo.dev/desktop/darwin-x86_64/1.0.1/easymo-admin_1.0.1_x64.app.tar.gz"
    },
    "darwin-aarch64": {
      "signature": "base64_signature_here",
      "url": "https://releases.easymo.dev/desktop/darwin-aarch64/1.0.1/easymo-admin_1.0.1_aarch64.app.tar.gz"
    }
  },
  "notes": "Bug fixes and performance improvements"
}
```

**Success Criteria:**
- [ ] Domain resolves: releases.easymo.dev
- [ ] SSL certificate valid
- [ ] Manifest endpoint returns 200
- [ ] Download URLs work
- [ ] CORS headers set correctly

---

### 3.2 Implement Update Check Flow
**Priority:** 🔴 CRITICAL  
**File:** `admin-app/components/system/UpdaterInit.tsx`  
**Estimated Time:** 4 hours  

**Current State:**
```typescript
// Likely calls disabled updater
```

**Target State:**
```typescript
'use client';

import { useEffect, useState } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export function UpdaterInit() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    checkForUpdate();
    
    // Check every 6 hours
    const interval = setInterval(checkForUpdate, 6 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  async function checkForUpdate() {
    try {
      const update = await check();
      
      if (update?.available) {
        setUpdateAvailable(true);
        setUpdateInfo(update);
        console.log(`Update available: ${update.version}`);
      }
    } catch (error) {
      console.error('Failed to check for updates:', error);
    }
  }

  async function downloadAndInstall() {
    if (!updateInfo) return;
    
    setDownloading(true);
    
    try {
      await updateInfo.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          console.log('Download started');
        } else if (event.event === 'Progress') {
          const percent = (event.data.downloaded / event.data.total) * 100;
          setDownloadProgress(percent);
          console.log(`Downloaded ${percent.toFixed(1)}%`);
        } else if (event.event === 'Finished') {
          console.log('Download finished, installing...');
        }
      });
      
      // Update installed, relaunch app
      await relaunch();
    } catch (error) {
      console.error('Failed to install update:', error);
      setDownloading(false);
    }
  }

  if (!updateAvailable) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-blue-600 text-white p-4 rounded-lg shadow-lg max-w-sm">
      <h3 className="font-semibold mb-2">Update Available</h3>
      <p className="text-sm mb-3">
        Version {updateInfo?.version} is ready to install
      </p>
      
      {downloading ? (
        <div>
          <div className="w-full bg-blue-800 rounded-full h-2 mb-2">
            <div 
              className="bg-white h-2 rounded-full transition-all"
              style={{ width: `${downloadProgress}%` }}
            />
          </div>
          <p className="text-xs">Downloading... {downloadProgress.toFixed(0)}%</p>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={downloadAndInstall}
            className="px-4 py-2 bg-white text-blue-600 rounded hover:bg-gray-100 text-sm font-medium"
          >
            Install Now
          </button>
          <button
            onClick={() => setUpdateAvailable(false)}
            className="px-4 py-2 border border-white rounded hover:bg-blue-700 text-sm"
          >
            Later
          </button>
        </div>
      )}
    </div>
  );
}
```

**Success Criteria:**
- [ ] Update check runs on app start
- [ ] Update check runs every 6 hours
- [ ] UI shows when update available
- [ ] Download progress displays
- [ ] App relaunches after install

---

### 3.3 Create Release Workflow
**Priority:** 🔴 CRITICAL  
**File:** `.github/workflows/desktop-release.yml`  
**Estimated Time:** 6 hours  

```yaml
name: Desktop Release

on:
  push:
    tags:
      - 'desktop-v*'

jobs:
  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 10
      
      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable
      
      - name: Install dependencies
        working-directory: admin-app
        run: pnpm install --frozen-lockfile
      
      - name: Import Windows certificate
        run: |
          $bytes = [Convert]::FromBase64String("${{ secrets.WINDOWS_CERTIFICATE }}")
          [IO.File]::WriteAllBytes("cert.pfx", $bytes)
      
      - name: Build Windows app
        working-directory: admin-app
        run: pnpm tauri build --target x86_64-pc-windows-msvc
        env:
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
      
      - name: Sign Windows installer
        run: |
          & "C:\Program Files (x86)\Windows Kits\10\bin\10.0.22621.0\x64\signtool.exe" sign `
            /f cert.pfx `
            /p "${{ secrets.WINDOWS_CERT_PASSWORD }}" `
            /tr http://timestamp.digicert.com `
            /td sha256 `
            /fd sha256 `
            admin-app/src-tauri/target/release/bundle/msi/*.msi
      
      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: windows-x86_64
          path: admin-app/src-tauri/target/release/bundle/msi/*.msi

  build-macos:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 10
      
      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: x86_64-apple-darwin,aarch64-apple-darwin
      
      - name: Install dependencies
        working-directory: admin-app
        run: pnpm install --frozen-lockfile
      
      - name: Import Apple certificate
        run: |
          echo "${{ secrets.APPLE_CERTIFICATE }}" | base64 -d > cert.p12
          security create-keychain -p actions build.keychain
          security default-keychain -s build.keychain
          security unlock-keychain -p actions build.keychain
          security import cert.p12 -k build.keychain -P "${{ secrets.APPLE_CERT_PASSWORD }}" -T /usr/bin/codesign
          security set-key-partition-list -S apple-tool:,apple: -s -k actions build.keychain
      
      - name: Build macOS app (Universal)
        working-directory: admin-app
        run: pnpm tauri build --target universal-apple-darwin
        env:
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
          APPLE_SIGNING_IDENTITY: "Developer ID Application: EasyMO Platform"
      
      - name: Notarize macOS app
        run: |
          xcrun notarytool submit \
            admin-app/src-tauri/target/universal-apple-darwin/release/bundle/dmg/*.dmg \
            --keychain-profile "easymo-notary" \
            --wait
          
          xcrun stapler staple admin-app/src-tauri/target/universal-apple-darwin/release/bundle/dmg/*.dmg
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: macos-universal
          path: admin-app/src-tauri/target/universal-apple-darwin/release/bundle/dmg/*.dmg

  publish-release:
    needs: [build-windows, build-macos]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Download all artifacts
        uses: actions/download-artifact@v4
      
      - name: Generate signatures
        run: |
          # Tauri CLI will have signed during build
          # Just verify signatures exist
          ls -la windows-x86_64/*.msi.sig
          ls -la macos-universal/*.dmg.sig
      
      - name: Upload to release server
        run: |
          # Extract version from tag (desktop-v1.0.0 -> 1.0.0)
          VERSION=${GITHUB_REF#refs/tags/desktop-v}
          
          # Upload to Cloudflare R2 or S3
          aws s3 sync windows-x86_64/ s3://easymo-releases/desktop/windows-x86_64/$VERSION/ \
            --endpoint-url ${{ secrets.R2_ENDPOINT }}
          
          aws s3 sync macos-universal/ s3://easymo-releases/desktop/darwin-universal/$VERSION/ \
            --endpoint-url ${{ secrets.R2_ENDPOINT }}
          
          # Generate latest.json manifest
          node scripts/generate-update-manifest.js $VERSION
          
          # Upload manifest
          aws s3 cp latest.json s3://easymo-releases/desktop/ \
            --endpoint-url ${{ secrets.R2_ENDPOINT }}
      
      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          files: |
            windows-x86_64/*.msi
            macos-universal/*.dmg
          body: |
            ## Desktop App Release ${{ github.ref_name }}
            
            ### Installation
            - **Windows:** Download and run the `.msi` installer
            - **macOS:** Download and open the `.dmg` file
            
            ### Auto-updates
            Existing users will be notified of this update automatically.
```

**Supporting Script:**
```javascript
// scripts/generate-update-manifest.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const version = process.argv[2];

const manifest = {
  version,
  date: new Date().toISOString(),
  platforms: {
    'windows-x86_64': {
      signature: fs.readFileSync(`windows-x86_64/easymo-admin_${version}_x64_en-US.msi.sig`, 'utf8').trim(),
      url: `https://releases.easymo.dev/desktop/windows-x86_64/${version}/easymo-admin_${version}_x64_en-US.msi.zip`
    },
    'darwin-universal': {
      signature: fs.readFileSync(`macos-universal/easymo-admin_${version}_universal.dmg.sig`, 'utf8').trim(),
      url: `https://releases.easymo.dev/desktop/darwin-universal/${version}/easymo-admin_${version}_universal.dmg.tar.gz`
    }
  }
};

fs.writeFileSync('latest.json', JSON.stringify(manifest, null, 2));
console.log('Generated latest.json:', manifest);
```

**Success Criteria:**
- [ ] Workflow triggers on tags
- [ ] Windows build succeeds
- [ ] macOS build succeeds
- [ ] Artifacts signed correctly
- [ ] Manifest generated
- [ ] Files uploaded to CDN
- [ ] GitHub release created

---

### 3.4 Test Update Flow End-to-End
**Priority:** 🔴 CRITICAL  
**Estimated Time:** 4 hours  

**Test Plan:**

1. **Install v1.0.0**
   - [ ] Install on Windows test machine
   - [ ] Install on macOS test machine
   - [ ] Verify app launches

2. **Publish v1.0.1**
   - [ ] Tag commit: `git tag desktop-v1.0.1`
   - [ ] Push tag: `git push origin desktop-v1.0.1`
   - [ ] Wait for CI to complete
   - [ ] Verify files on releases.easymo.dev

3. **Test Update Detection**
   - [ ] Open v1.0.0 app
   - [ ] Wait for update notification (or trigger manually)
   - [ ] Verify update dialog shows v1.0.1

4. **Test Update Installation**
   - [ ] Click "Install Now"
   - [ ] Verify download progress shows
   - [ ] Verify app closes and relaunches
   - [ ] Verify new version shows in About dialog

5. **Test Update Server**
   ```bash
   # Test manifest endpoint
   curl https://releases.easymo.dev/desktop/windows-x86_64/1.0.0
   
   # Should return latest.json with v1.0.1
   ```

**Rollback Plan:**
- Delete tag: `git tag -d desktop-v1.0.1 && git push origin :refs/tags/desktop-v1.0.1`
- Remove files from CDN
- Users will stay on v1.0.0

---

### Phase 3 Deliverables
- [ ] Update server deployed at releases.easymo.dev
- [ ] Update check implemented in app
- [ ] Release workflow working
- [ ] End-to-end update tested
- [ ] Manifest generation automated
- [ ] Rollback procedure documented

**Phase 3 Sign-off:** DevOps Lead + QA Team

---

## 🧪 PHASE 4: PLATFORM BUILDS & TESTING (Week 3: Dec 16-19)
**Goal:** Build platform-specific installers and validate  
**Owner:** QA Team  
**Estimated Effort:** 20-24 hours  

### 4.1 Windows Build & Testing
**Priority:** 🔴 CRITICAL  
**Estimated Time:** 8 hours  

**Build Configurations:**

```bash
# Build for Windows x64
cd admin-app
pnpm tauri build --target x86_64-pc-windows-msvc
```

**Test Matrix:**

| OS Version | Architecture | Test Status | Notes |
|------------|-------------|-------------|-------|
| Windows 11 23H2 | x64 | ⬜ | Primary target |
| Windows 11 22H2 | x64 | ⬜ | |
| Windows 10 22H2 | x64 | ⬜ | Minimum supported |
| Windows 10 21H2 | x64 | ⬜ | Edge case |

**Test Cases:**

**4.1.1 Installation**
- [ ] Download .msi installer
- [ ] Right-click → Properties → Digital Signatures → Verify signature valid
- [ ] Double-click installer (no SmartScreen warning expected with EV cert)
- [ ] Follow installation wizard
- [ ] Verify installed in Program Files
- [ ] Verify Start Menu shortcut created
- [ ] Verify Desktop shortcut created (if selected)

**4.1.2 First Launch**
- [ ] Launch from Start Menu
- [ ] Verify no Windows Defender warnings
- [ ] Verify login screen loads
- [ ] Log in with test credentials
- [ ] Verify dashboard loads
- [ ] Check DevTools not accessible (F12 should do nothing)

**4.1.3 Core Features**
- [ ] System tray icon appears
- [ ] Tray menu works (Show/Hide/Quit)
- [ ] Window state persists (close and reopen)
- [ ] Global shortcut works (Ctrl+K)
- [ ] Deep links work (easymo:// protocol)
- [ ] File associations work (.easymo files)
- [ ] Native notifications work
- [ ] Auto-start preference works

**4.1.4 Update Flow**
- [ ] Publish test update
- [ ] Wait for update notification
- [ ] Install update
- [ ] Verify app relaunches with new version

**4.1.5 Uninstallation**
- [ ] Uninstall from Control Panel
- [ ] Verify all files removed
- [ ] Verify registry entries cleaned
- [ ] Verify shortcuts removed

**Known Issues:**
- WebView2 may need separate install on Windows 10 < 21H2
- Configure `downloadBootstrapper` in tauri.conf.json to auto-install

**Success Criteria:**
- [ ] All test cases pass on Windows 11
- [ ] All test cases pass on Windows 10 22H2
- [ ] No security warnings
- [ ] Signature verified
- [ ] Update flow works

---

### 4.2 macOS Build & Testing
**Priority:** 🔴 CRITICAL  
**Estimated Time:** 8 hours  

**Build Configurations:**

```bash
# Build universal binary (Intel + Apple Silicon)
cd admin-app
pnpm tauri build --target universal-apple-darwin

# Or build separately
pnpm tauri build --target x86_64-apple-darwin
pnpm tauri build --target aarch64-apple-darwin
```

**Test Matrix:**

| macOS Version | Architecture | Test Status | Notes |
|--------------|-------------|-------------|-------|
| macOS 15 Sequoia | ARM64 | ⬜ | Latest |
| macOS 14 Sonoma | ARM64 | ⬜ | |
| macOS 14 Sonoma | x86_64 | ⬜ | Intel Mac |
| macOS 13 Ventura | ARM64 | ⬜ | |
| macOS 12 Monterey | x86_64 | ⬜ | |
| macOS 10.15 Catalina | x86_64 | ⬜ | Minimum supported |

**Test Cases:**

**4.2.1 Installation**
- [ ] Download .dmg file
- [ ] Verify no Gatekeeper warnings (should open directly with notarization)
- [ ] Drag app to Applications folder
- [ ] Eject DMG
- [ ] Open from Applications
- [ ] Verify "EasyMO Admin" is not damaged or unsigned

**4.2.2 First Launch**
- [ ] Launch from Applications
- [ ] Verify no security prompts
- [ ] Verify login screen loads
- [ ] Log in with test credentials
- [ ] Verify dashboard loads
- [ ] Check DevTools not accessible (Cmd+Option+I should do nothing)

**4.2.3 Core Features**
- [ ] Menu bar icon appears
- [ ] Menu works (Show/Hide/Quit)
- [ ] Window state persists
- [ ] Global shortcut works (Cmd+K)
- [ ] Deep links work (easymo:// protocol)
- [ ] File associations work (.easymo files)
- [ ] Native notifications work
- [ ] Auto-start preference works (LaunchAgent)
- [ ] Dock integration works

**4.2.4 Update Flow**
- [ ] Publish test update
- [ ] Wait for update notification
- [ ] Install update
- [ ] Verify app relaunches with new version
- [ ] Verify signature still valid after update

**4.2.5 Notarization Verification**
```bash
# Verify notarization
spctl -a -vv -t install /Applications/EasyMO\ Admin.app

# Should show:
# /Applications/EasyMO Admin.app: accepted
# source=Notarized Developer ID

# Check signature
codesign -dvv /Applications/EasyMO\ Admin.app

# Verify hardened runtime
codesign -dvvv /Applications/EasyMO\ Admin.app | grep runtime
```

**4.2.6 Uninstallation**
- [ ] Drag app to Trash
- [ ] Empty Trash
- [ ] Verify LaunchAgent removed
- [ ] Verify preferences removed from ~/Library/

**Success Criteria:**
- [ ] All test cases pass on macOS 14+ (ARM)
- [ ] All test cases pass on macOS 14+ (Intel)
- [ ] All test cases pass on macOS 10.15 (Intel)
- [ ] No Gatekeeper warnings
- [ ] Notarization verified
- [ ] Update flow works

---

### 4.3 Performance & Security Testing
**Priority:** 🟡 HIGH  
**Estimated Time:** 4 hours  

**Performance Tests:**

1. **Startup Time**
   - [ ] Cold start < 3 seconds
   - [ ] Warm start < 1 second
   - [ ] Memory usage < 200MB on idle

2. **Resource Usage**
   - [ ] CPU idle < 5%
   - [ ] CPU active (dashboard) < 30%
   - [ ] Memory stable (no leaks over 1 hour)
   - [ ] Disk I/O minimal

3. **Bundle Size**
   - [ ] Windows installer < 80MB
   - [ ] macOS DMG < 80MB
   - [ ] App bundle (unpacked) < 150MB

**Security Tests:**

1. **Code Signing**
   ```bash
   # Windows
   signtool verify /pa easymo-admin.msi
   
   # macOS
   codesign --verify --deep --strict --verbose=2 EasyMO\ Admin.app
   spctl -a -t execute -vv EasyMO\ Admin.app
   ```

2. **CSP Compliance**
   - [ ] Open app DevTools in dev mode
   - [ ] Check console for CSP violations
   - [ ] All external resources allowed in CSP

3. **Network Security**
   - [ ] All connections use HTTPS
   - [ ] Certificate pinning for Supabase (optional)
   - [ ] No plain-text credentials in logs

4. **Penetration Testing**
   - [ ] Run OWASP ZAP against app
   - [ ] Check for XSS vulnerabilities
   - [ ] Verify local storage encryption
   - [ ] Test deep link injection attacks

**Success Criteria:**
- [ ] Performance benchmarks met
- [ ] No security vulnerabilities found
- [ ] Code signing verified
- [ ] CSP violations resolved

---

### 4.4 Beta Testing Program
**Priority:** 🟡 HIGH  
**Estimated Time:** 1 week (parallel with other work)  

**Beta Tester Recruitment:**
- 5-10 internal team members
- 10-15 trusted customers/partners

**Beta Build Distribution:**
```yaml
# .github/workflows/beta-release.yml
on:
  push:
    branches:
      - beta

jobs:
  build:
    # Same as desktop-release.yml but upload to beta channel
```

**Beta Testing Checklist:**
- [ ] Install beta build
- [ ] Complete feature walkthrough
- [ ] Report bugs via form
- [ ] Test update from beta to stable

**Feedback Collection:**
- Google Form for bug reports
- Sentry for crash reports
- Analytics for usage patterns

**Beta Exit Criteria:**
- [ ] No P0 (critical) bugs
- [ ] < 3 P1 (high) bugs
- [ ] 80%+ feature completion
- [ ] 90%+ tester satisfaction

---

### Phase 4 Deliverables
- [ ] Windows builds tested on 4+ OS versions
- [ ] macOS builds tested on 6+ OS/arch combinations
- [ ] Performance benchmarks met
- [ ] Security audit passed
- [ ] Beta testing completed
- [ ] All P0/P1 bugs fixed
- [ ] Release notes written

**Phase 4 Sign-off:** QA Lead + Product Manager

---

## 📦 RELEASE PLAN (Dec 19-20)

### Pre-Release Checklist (Dec 19 AM)
- [ ] All Phase 1-4 deliverables complete
- [ ] Final security review passed
- [ ] Release notes approved
- [ ] Marketing materials ready
- [ ] Support team trained
- [ ] Rollback plan documented

### Release Day (Dec 19 PM)
1. **Tag Release**
   ```bash
   git tag desktop-v1.0.0
   git push origin desktop-v1.0.0
   ```

2. **Monitor CI/CD** (30 min)
   - [ ] Windows build succeeds
   - [ ] macOS build succeeds
   - [ ] Artifacts uploaded
   - [ ] Manifest generated

3. **Smoke Test Production Builds** (1 hour)
   - [ ] Download from release server
   - [ ] Install on clean Windows machine
   - [ ] Install on clean macOS machine
   - [ ] Verify basic functionality
   - [ ] Check Sentry for errors

4. **Publish Release** (15 min)
   - [ ] Create GitHub Release (public)
   - [ ] Update website download links
   - [ ] Post announcement on social media
   - [ ] Send email to beta testers

5. **Monitor Initial Adoption** (4 hours)
   - [ ] Watch Sentry for crash reports
   - [ ] Monitor download counts
   - [ ] Check support channels for issues
   - [ ] Respond to early feedback

### Post-Release (Dec 20+)
- [ ] Monitor update adoption rate
- [ ] Track metrics (installs, crashes, updates)
- [ ] Collect user feedback
- [ ] Plan hotfix if needed
- [ ] Schedule retrospective meeting

---

## 🚨 RISK MANAGEMENT

### High Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Certificate delays | Blocks release | Medium | Start procurement Day 1 |
| CSP breaks app | Major | Medium | Thorough testing in dev |
| macOS notarization fails | Blocks macOS | Low | Test early, have support contact |
| Update server downtime | No updates | Low | Use reliable CDN (Cloudflare R2) |
| Breaking bug in release | Reputation | Medium | Beta testing + staged rollout |

### Rollback Procedures

**If Production Build Fails:**
1. Don't tag release
2. Fix issue in branch
3. Re-test
4. Tag when ready

**If Update Server Down:**
1. Apps continue working (no updates)
2. Fix server
3. Push hotfix update

**If Critical Bug in v1.0.0:**
1. Immediately tag v1.0.1 with fix
2. CI auto-builds and publishes
3. Users auto-update within 6 hours
4. Post incident report

---

## 📊 SUCCESS METRICS

### Technical Metrics
- [ ] 100% code signing (Windows + macOS)
- [ ] 0 CSP violations in production
- [ ] < 1% crash rate (Sentry)
- [ ] < 5% failed update rate
- [ ] 90%+ update adoption in 1 week

### Business Metrics
- [ ] 100 installs in first week
- [ ] 500 installs in first month
- [ ] 4.0+ star rating (if published to stores)
- [ ] < 10 support tickets per 100 users

### Timeline Metrics
- [ ] Phase 1 complete by Dec 6
- [ ] Phase 2 complete by Dec 13
- [ ] Phase 3 complete by Dec 13
- [ ] Phase 4 complete by Dec 19
- [ ] Release by Dec 19

---

## 👥 TEAM ASSIGNMENTS

| Phase | Owner | Contributors | Hours |
|-------|-------|--------------|-------|
| Phase 1 | Dev Lead | 2 developers | 12 hours |
| Phase 2 | DevOps Lead | Finance, Security | 8 hours + wait time |
| Phase 3 | Backend Lead | DevOps, 1 developer | 20 hours |
| Phase 4 | QA Lead | 2 QA engineers, Beta testers | 24 hours |

**Total Estimated Effort:** 64 hours (8 person-days)

---

## 📝 APPENDIX

### A. Required Secrets (GitHub Actions)

```bash
# Tauri Signing
TAURI_SIGNING_PRIVATE_KEY
TAURI_SIGNING_PRIVATE_KEY_PASSWORD

# Windows Code Signing
WINDOWS_CERTIFICATE (base64 encoded PFX)
WINDOWS_CERT_PASSWORD

# Apple Code Signing
APPLE_CERTIFICATE (base64 encoded P12)
APPLE_CERT_PASSWORD
APPLE_ID (email)
APPLE_TEAM_ID
APPLE_APP_PASSWORD (app-specific password)

# Release Server
R2_ENDPOINT (or AWS S3 endpoint)
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
```

### B. Testing Environments

**Development:**
- Local machines with `tauri dev`
- DevTools enabled
- Mock data allowed

**Staging:**
- Beta channel builds
- Production signing
- Real Supabase (staging project)

**Production:**
- Public release
- Production Supabase
- Metrics enabled

### C. Documentation Updates

Files to update after implementation:
- [ ] `admin-app/README.md` - Build instructions
- [ ] `admin-app/DESKTOP_README.md` - Desktop-specific docs
- [ ] `docs/DEPLOYMENT.md` - Add desktop deployment
- [ ] `docs/SECURITY.md` - Add signing info
- [ ] `.github/CONTRIBUTING.md` - Add desktop workflow

### D. Cost Summary

| Item | Annual Cost | One-Time Cost |
|------|-------------|---------------|
| Windows EV Certificate | $500 | - |
| Apple Developer Program | $99 | - |
| Cloudflare R2 (Storage) | $60 | - |
| Domain (releases.easymo.dev) | $12 | - |
| **Total Annual** | **$671** | - |
| **Monthly** | **~$56** | - |

---

## ✅ FINAL CHECKLIST

### Pre-Implementation
- [ ] Plan reviewed by all team leads
- [ ] Budget approved ($671/year)
- [ ] Timeline approved (3 weeks)
- [ ] Team availability confirmed
- [ ] Backup resources identified

### Phase Gate Reviews
- [ ] Phase 1 Sign-off (Dev Lead + Security)
- [ ] Phase 2 Sign-off (DevOps Lead + Security)
- [ ] Phase 3 Sign-off (DevOps Lead + QA)
- [ ] Phase 4 Sign-off (QA Lead + Product)

### Go/No-Go Decision (Dec 18)
- [ ] All critical bugs resolved
- [ ] Security audit passed
- [ ] Performance benchmarks met
- [ ] Beta testing successful
- [ ] Team consensus to ship

---

**Next Steps:**
1. Review and approve this plan
2. Assign phase owners
3. Schedule kickoff meeting (Dec 2)
4. Begin Phase 1 immediately
5. Start certificate procurement in parallel

**Questions/Concerns:** Please comment or contact the project lead.

**Last Updated:** 2025-11-28
