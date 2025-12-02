# 🚀 EasyMO Desktop App - In-House Deployment Guide

**Last Updated:** December 2, 2025  
**Deployment Type:** Internal/In-House  
**Target Audience:** DevOps, IT Teams  
**Estimated Time:** 1-2 days for complete setup

---

## 📋 TABLE OF CONTENTS

1. [Prerequisites](#prerequisites)
2. [Build Production Versions](#build-production-versions)
3. [Distribution Methods](#distribution-methods)
4. [Installation Instructions](#installation-instructions)
5. [Troubleshooting](#troubleshooting)
6. [Monitoring & Support](#monitoring--support)
7. [Update Management](#update-management)

---

## 1. PREREQUISITES

### Development Machine Setup

**Required Software:**
- Node.js 20+ (check: `node --version`)
- pnpm 10.18.3+ (check: `pnpm --version`)
- Rust 1.77.2+ (check: `rustc --version`)

**Platform-Specific:**

**macOS:**
```bash
# Install Xcode Command Line Tools
xcode-select --install

# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install pnpm
npm install -g pnpm@10.18.3
```

**Windows:**
```powershell
# Install Rust
winget install Rustlang.Rust.MSVC

# Install pnpm
npm install -g pnpm@10.18.3

# Install Visual Studio Build Tools
# Download from: https://visualstudio.microsoft.com/downloads/
# Select "Desktop development with C++"
```

### Repository Access

```bash
# Clone repository
git clone https://github.com/ikanisa/easymo.git
cd easymo/admin-app

# Verify you're on the correct branch
git branch
# Should show: * main (or your production branch)
```

---

## 2. BUILD PRODUCTION VERSIONS

### Step 1: Install Dependencies

```bash
cd /path/to/easymo/admin-app

# Install all dependencies
pnpm install --frozen-lockfile

# Build shared packages FIRST (critical!)
cd ..
pnpm --filter @va/shared build
pnpm --filter @easymo/commons build

# Return to admin-app
cd admin-app
```

**Expected Output:**
```
✓ Built @va/shared
✓ Built @easymo/commons
```

### Step 2: Build macOS Version

**Option A: Universal Binary (Recommended)**
```bash
# Builds for both Intel and ARM (M1/M2/M3)
npm run tauri:build:universal

# Expected build time: 5-8 minutes
# Output: src-tauri/target/universal-apple-darwin/release/bundle/
```

**Option B: Architecture-Specific**
```bash
# For M1/M2/M3 Macs only
npm run tauri:build:mac-arm

# For Intel Macs only
npm run tauri:build:mac

# Expected build time: 3-5 minutes
```

**Build Output Locations:**
```
src-tauri/target/release/bundle/
├── dmg/
│   └── EasyMO Admin_1.0.0_aarch64.dmg    (~15-20 MB)
│   └── EasyMO Admin_1.0.0_x64.dmg        (~15-20 MB)
│   └── EasyMO Admin_1.0.0_universal.dmg  (~30-35 MB)
└── macos/
    └── EasyMO Admin.app/
```

### Step 3: Build Windows Version

**On Windows Machine:**
```bash
cd admin-app

# Install dependencies (if not already done)
pnpm install --frozen-lockfile

# Build Windows installer
npm run tauri:build:win

# Expected build time: 4-6 minutes
```

**Build Output Locations:**
```
src-tauri/target/release/bundle/
├── msi/
│   └── EasyMO Admin_1.0.0_x64_en-US.msi  (~12-18 MB)
└── nsis/  (optional alternative installer)
```

### Step 4: Verify Builds

**macOS Verification:**
```bash
# Check DMG can be mounted
hdiutil attach "src-tauri/target/release/bundle/dmg/EasyMO Admin_1.0.0_universal.dmg"

# Test app launches
open "/Volumes/EasyMO Admin/EasyMO Admin.app"

# Clean up
hdiutil detach "/Volumes/EasyMO Admin"
```

**Windows Verification:**
```powershell
# Check MSI is valid
Get-AppPackage -Path "src-tauri\target\release\bundle\msi\EasyMO Admin_1.0.0_x64_en-US.msi"

# Test installation (in VM or test machine)
msiexec /i "EasyMO Admin_1.0.0_x64_en-US.msi" /l*v install.log
```

### Step 5: Generate Checksums

```bash
# macOS/Linux
cd src-tauri/target/release/bundle/dmg
shasum -a 256 *.dmg > checksums.txt

cd ../msi
shasum -a 256 *.msi >> checksums.txt

# Windows (PowerShell)
Get-FileHash -Algorithm SHA256 *.msi | Format-List
```

**Save checksums.txt for documentation**

---

## 3. DISTRIBUTION METHODS

### Method A: Internal Web Server (Recommended)

**Setup Nginx/Apache:**

```nginx
# /etc/nginx/sites-available/releases-easymo
server {
    listen 80;
    server_name releases.internal.easymo.dev;
    
    # Optional: Require authentication
    auth_basic "EasyMO Internal Releases";
    auth_basic_user_file /etc/nginx/.htpasswd;
    
    location / {
        root /var/www/releases;
        autoindex on;
        autoindex_exact_size off;
        autoindex_localtime on;
    }
    
    # Enable downloads
    location ~* \.(dmg|msi|exe|zip)$ {
        add_header Content-Disposition "attachment";
    }
}
```

**Directory Structure:**
```bash
sudo mkdir -p /var/www/releases/desktop/{macos,windows}

# Copy builds
sudo cp src-tauri/target/release/bundle/dmg/*.dmg \
    /var/www/releases/desktop/macos/

sudo cp src-tauri/target/release/bundle/msi/*.msi \
    /var/www/releases/desktop/windows/

# Create index page
cat > /var/www/releases/index.html << 'HTML'
<!DOCTYPE html>
<html>
<head>
    <title>EasyMO Desktop Downloads</title>
    <style>
        body { font-family: sans-serif; max-width: 800px; margin: 50px auto; }
        .download { padding: 20px; border: 1px solid #ddd; margin: 20px 0; }
        .btn { background: #007bff; color: white; padding: 10px 20px; 
               text-decoration: none; border-radius: 4px; }
    </style>
</head>
<body>
    <h1>🖥️ EasyMO Admin Desktop</h1>
    <p>Version 1.0.0 - Internal Release</p>
    
    <div class="download">
        <h2>macOS</h2>
        <p>For M1/M2/M3 and Intel Macs</p>
        <a href="/desktop/macos/EasyMO Admin_1.0.0_universal.dmg" class="btn">
            Download macOS (.dmg)
        </a>
        <p><small>Size: ~30 MB</small></p>
    </div>
    
    <div class="download">
        <h2>Windows</h2>
        <p>Windows 10/11 (64-bit)</p>
        <a href="/desktop/windows/EasyMO Admin_1.0.0_x64_en-US.msi" class="btn">
            Download Windows (.msi)
        </a>
        <p><small>Size: ~15 MB</small></p>
    </div>
    
    <h3>Installation Instructions</h3>
    <ul>
        <li><a href="/docs/INSTALL_MACOS.md">macOS Installation Guide</a></li>
        <li><a href="/docs/INSTALL_WINDOWS.md">Windows Installation Guide</a></li>
        <li><a href="/docs/TROUBLESHOOTING.md">Troubleshooting</a></li>
    </ul>
</body>
</html>
HTML

# Set permissions
sudo chown -R www-data:www-data /var/www/releases
sudo chmod -R 755 /var/www/releases

# Enable site
sudo ln -s /etc/nginx/sites-available/releases-easymo \
    /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Method B: Network File Share

**Windows Server (SMB):**
```powershell
# Create shared folder
New-Item -Path "C:\Shares\EasyMO-Apps" -ItemType Directory

# Share it
New-SmbShare -Name "EasyMO-Apps" `
    -Path "C:\Shares\EasyMO-Apps" `
    -FullAccess "DOMAIN\IT-Team" `
    -ReadAccess "DOMAIN\All-Employees"

# Copy files
Copy-Item "src-tauri\target\release\bundle\msi\*.msi" `
    "C:\Shares\EasyMO-Apps\Desktop\"
```

**Access:** `\\fileserver\EasyMO-Apps\Desktop\`

### Method C: Cloud Storage (Private)

**AWS S3 (Private Bucket):**
```bash
# Create private bucket
aws s3 mb s3://easymo-internal-releases --region us-east-1

# Upload builds
aws s3 cp src-tauri/target/release/bundle/dmg/EasyMO\ Admin_1.0.0_universal.dmg \
    s3://easymo-internal-releases/desktop/macos/ \
    --metadata version=1.0.0

# Generate presigned URL (expires in 7 days)
aws s3 presign \
    s3://easymo-internal-releases/desktop/macos/EasyMO\ Admin_1.0.0_universal.dmg \
    --expires-in 604800

# Share URL with team
```

---

## 4. INSTALLATION INSTRUCTIONS

### macOS Installation Guide

**Create:** `/var/www/releases/docs/INSTALL_MACOS.md`

```markdown
# EasyMO Admin - macOS Installation

## System Requirements
- macOS 10.15 (Catalina) or later
- 100 MB free disk space
- Internet connection

## Installation Steps

### Step 1: Download
1. Go to http://releases.internal.easymo.dev
2. Click "Download macOS (.dmg)"
3. Save to Downloads folder

### Step 2: Install
1. **IMPORTANT:** Right-click the downloaded DMG file
2. Select "Open" from the context menu
3. macOS will show a warning: "macOS cannot verify the developer"
4. Click "Open" again in the dialog
5. Drag "EasyMO Admin" to the Applications folder

### Step 3: First Launch
1. Go to Applications folder
2. **IMPORTANT:** Right-click "EasyMO Admin.app"
3. Select "Open"
4. Click "Open" in the warning dialog
5. App will launch successfully

**Note:** You only need to right-click the first time. After that, 
you can double-click normally.

## Alternative: IT Team Installation

If you have IT support, they can remove the security warning:

```bash
sudo xattr -rd com.apple.quarantine "/Applications/EasyMO Admin.app"
```

After this, you can double-click to open like any other app.

## Troubleshooting

**"App is damaged and can't be opened"**
Run this in Terminal:
```bash
xattr -cr "/Applications/EasyMO Admin.app"
```

**App doesn't open**
Check System Preferences → Security & Privacy → General
Click "Open Anyway" for EasyMO Admin
```

### Windows Installation Guide

**Create:** `/var/www/releases/docs/INSTALL_WINDOWS.md`

```markdown
# EasyMO Admin - Windows Installation

## System Requirements
- Windows 10 (64-bit) or Windows 11
- 100 MB free disk space
- Internet connection

## Installation Steps

### Step 1: Download
1. Go to http://releases.internal.easymo.dev
2. Click "Download Windows (.msi)"
3. Save to Downloads folder

### Step 2: Install
1. Double-click the downloaded MSI file
2. Windows SmartScreen warning will appear:
   "Windows protected your PC - Unknown publisher"
3. Click "More info" link
4. Click "Run anyway" button
5. Follow the installation wizard:
   - Click "Next"
   - Accept license agreement
   - Choose installation location (default: C:\Program Files\EasyMO Admin)
   - Click "Install"
   - Click "Finish"

### Step 3: First Launch
1. Find "EasyMO Admin" in Start Menu
2. Click to launch
3. App will open - no additional warnings

## Alternative: Silent Installation

For IT teams deploying via Group Policy:

```powershell
msiexec /i "EasyMO Admin_1.0.0_x64_en-US.msi" /quiet /norestart
```

## Troubleshooting

**"This app has been blocked for your protection"**
Contact IT team to whitelist the app, or:
1. Right-click the MSI file
2. Select "Properties"
3. Check "Unblock" at the bottom
4. Click "Apply"
5. Try installation again

**Installation fails**
Run installer as Administrator:
1. Right-click MSI file
2. Select "Run as administrator"
```

---

## 5. TROUBLESHOOTING

### Common Issues

#### macOS: "App is damaged"

**Cause:** macOS quarantine flag on unsigned apps

**Fix:**
```bash
# Remove quarantine
sudo xattr -rd com.apple.quarantine "/Applications/EasyMO Admin.app"

# Verify fix
xattr -l "/Applications/EasyMO Admin.app"
# Should show no com.apple.quarantine
```

#### macOS: App crashes on launch

**Diagnosis:**
```bash
# Check crash logs
open ~/Library/Logs/DiagnosticReports/

# Look for files starting with "EasyMO Admin"
# Check Console.app for error messages
```

**Common Fixes:**
```bash
# Reset app state
rm -rf ~/Library/Application\ Support/com.easymo.admin
rm -rf ~/Library/Caches/com.easymo.admin

# Reinstall
```

#### Windows: SmartScreen won't bypass

**Fix 1: Unblock file**
```powershell
Unblock-File -Path "C:\Users\YourName\Downloads\EasyMO Admin_1.0.0_x64_en-US.msi"
```

**Fix 2: Group Policy (IT Team)**
```
Computer Configuration → Administrative Templates → Windows Components
→ Windows Defender SmartScreen → Explorer
→ Configure Windows Defender SmartScreen
Set to: "Warn and allow bypass"
```

#### Windows: Installation fails

**Diagnosis:**
```powershell
# Check event viewer
eventvwr.msc
# Navigate to: Windows Logs → Application
# Filter for "MsiInstaller"

# Or install with logging
msiexec /i "EasyMO Admin_1.0.0_x64_en-US.msi" /l*v install.log
# Review install.log for errors
```

#### App won't connect to Supabase

**Check:**
1. Internet connection active
2. Firewall allows outbound HTTPS
3. Corporate proxy configured

**Test connectivity:**
```bash
# macOS/Linux
curl -I https://your-project.supabase.co

# Windows (PowerShell)
Test-NetConnection -ComputerName your-project.supabase.co -Port 443
```

**Configure proxy (if needed):**
```bash
# Set environment variables
export HTTPS_PROXY=http://proxy.company.com:8080
export NO_PROXY=localhost,127.0.0.1
```

---

## 6. MONITORING & SUPPORT

### Set Up Error Tracking

**Sentry is already configured** in the app. Verify events are flowing:

1. Go to https://sentry.io (or your Sentry instance)
2. Check project: `easymo-admin-desktop`
3. Monitor error rate after deployment

**Create alerts:**
```yaml
# Sentry alert rules
- name: "Desktop App Crash Rate"
  conditions:
    - error_rate > 5%
  actions:
    - email: it-support@easymo.dev
    - slack: #desktop-app-alerts
```

### Usage Analytics

**Track key metrics:**
```typescript
// Already in codebase (lib/analytics.ts)
trackEvent('desktop_app_launched', {
  platform: 'darwin' | 'win32',
  version: '1.0.0',
  arch: 'x64' | 'arm64'
});

trackEvent('feature_used', {
  feature: 'system_tray' | 'global_shortcut' | 'notifications'
});
```

**Monitor in PostHog/Amplitude:**
- Daily active users
- Feature adoption rates
- Crash-free session rate
- Average session duration

### Support Channels

**Set up internal support:**

1. **Slack Channel:** `#desktop-app-support`
   ```
   Channel description:
   "Support for EasyMO Admin Desktop App
   Installation issues, bugs, feature requests
   Response time: < 4 hours during business hours"
   ```

2. **Email:** `desktop-support@easymo.dev`
   - Auto-responder with common solutions
   - Ticket system integration

3. **Wiki/Confluence:**
   - Installation guides
   - FAQ
   - Keyboard shortcuts reference
   - Video tutorials

### Support SLA

| Severity | Response Time | Resolution Time |
|----------|---------------|-----------------|
| Critical (app won't launch) | < 2 hours | < 1 day |
| High (feature broken) | < 4 hours | < 3 days |
| Medium (UI issue) | < 1 day | < 1 week |
| Low (enhancement) | < 1 week | Backlog |

---

## 7. UPDATE MANAGEMENT

### Manual Updates (Recommended for v1.0)

**Create update process:**

```bash
# 1. Build new version
cd admin-app
# Update version in package.json and tauri.conf.json
npm version 1.1.0

# 2. Build
npm run tauri:build:universal  # macOS
npm run tauri:build:win         # Windows

# 3. Upload to distribution server
scp src-tauri/target/release/bundle/dmg/*.dmg \
    server:/var/www/releases/desktop/macos/v1.1.0/

# 4. Update downloads page
# Edit /var/www/releases/index.html
# Change version to 1.1.0, update download links

# 5. Notify users
# Send email with changelog and download link
```

**Update Email Template:**
```markdown
Subject: EasyMO Admin Desktop - Version 1.1.0 Available

Hi team,

A new version of EasyMO Admin Desktop is now available!

**What's New in 1.1.0:**
- Fixed: System tray icon on Windows
- Added: Keyboard shortcuts customization
- Improved: Performance on older Macs

**How to Update:**
1. Download new version: http://releases.internal.easymo.dev
2. Install over existing version (settings are preserved)
3. Restart the app

**Need Help?**
Contact #desktop-app-support on Slack

Thanks,
IT Team
```

### Automatic Updates (Future Enhancement)

**Current status:** Infrastructure ready, signing keys configured

**To enable:**

1. **Set up update server:**
   ```json
   // releases.internal.easymo.dev/desktop/darwin-aarch64/1.0.0.json
   {
     "version": "1.0.0",
     "notes": "Initial release",
     "pub_date": "2025-12-02T00:00:00Z",
     "platforms": {
       "darwin-aarch64": {
         "signature": "...",  // Generated by Tauri CLI
         "url": "https://releases.internal.easymo.dev/desktop/EasyMO-Admin-1.0.0-aarch64.app.tar.gz"
       }
     }
   }
   ```

2. **Generate signatures:**
   ```bash
   # Tauri signing is already configured
   # Keys are in tauri.conf.json
   # Signatures auto-generated during build
   ```

3. **Test update flow:**
   ```bash
   # In app, trigger update check
   # Help → Check for Updates
   # Should download and install automatically
   ```

**Note:** Disabled for v1.0 to ensure stability. Enable in v1.1 after pilot testing.

---

## 📝 DEPLOYMENT CHECKLIST

### Pre-Deployment (1 Day)

- [ ] Build macOS version
- [ ] Build Windows version
- [ ] Generate checksums
- [ ] Verify builds on clean machines
- [ ] Set up distribution server
- [ ] Create installation guides
- [ ] Set up support channel (#desktop-app-support)
- [ ] Configure Sentry alerts
- [ ] Prepare announcement email

### Pilot Deployment (Week 1)

- [ ] Deploy to 5-10 pilot users
- [ ] Send pilot installation guide
- [ ] Daily check-in with pilot users
- [ ] Monitor Sentry for crashes
- [ ] Fix critical bugs within 24h
- [ ] Document workarounds
- [ ] Collect feedback survey

### Full Deployment (Week 2)

- [ ] Address pilot feedback
- [ ] Update installation guides
- [ ] Send all-hands announcement
- [ ] Deploy to all team members
- [ ] Monitor support channel hourly (first 2 days)
- [ ] Track installation success rate
- [ ] Update FAQ based on questions

### Post-Deployment (Week 3+)

- [ ] Send satisfaction survey
- [ ] Review analytics data
- [ ] Plan v1.1 features
- [ ] Add E2E tests
- [ ] Optimize performance
- [ ] Document lessons learned

---

## 🎯 SUCCESS METRICS

### Week 1 (Pilot)
- [ ] 100% pilot users successfully installed
- [ ] 0 critical bugs
- [ ] < 3 support tickets
- [ ] Satisfaction score > 7/10

### Week 2 (Rollout)
- [ ] 95%+ successful installations
- [ ] Crash-free rate > 99%
- [ ] < 5 support tickets/day
- [ ] Average startup time < 3 seconds

### Month 1
- [ ] 80%+ team adoption
- [ ] Satisfaction score > 8/10
- [ ] < 10 open bugs
- [ ] 90%+ users on latest version

---

## 📞 ESCALATION CONTACTS

| Issue Type | Contact | Response Time |
|------------|---------|---------------|
| Installation problems | #desktop-app-support | < 4 hours |
| Critical bugs | @dev-team | < 2 hours |
| Feature requests | @product-team | < 1 week |
| Infrastructure issues | @devops-team | < 2 hours |

---

**END OF DEPLOYMENT GUIDE**

**Status:** Ready for Deployment  
**Next Step:** Build production versions  
**Estimated Completion:** 2-3 weeks

---

*For questions or issues with this guide, contact: devops@easymo.dev*
