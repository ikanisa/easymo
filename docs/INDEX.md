# macOS Code Signing - Index

**Complete index of the macOS code signing infrastructure for EasyMO desktop apps.**

---

## 📋 Table of Contents

1. [Quick Links](#quick-links)
2. [Getting Started](#getting-started)
3. [File Reference](#file-reference)
4. [Common Tasks](#common-tasks)
5. [Troubleshooting](#troubleshooting)
6. [CI/CD](#cicd)
7. [Upgrade Paths](#upgrade-paths)

---

## Quick Links

### I want to...

| Task | Go to |
|------|-------|
| **Get started (first time)** | [SIGNING_QUICK_START.md](../SIGNING_QUICK_START.md) |
| **Sign apps now** | `./scripts/sign_all_apps.sh` |
| **Learn everything** | [internal_mac_signing.md](./internal_mac_signing.md) |
| **Set up CI/CD** | [github_actions_signing.md](./github_actions_signing.md) |
| **Find a specific command** | [SIGNING_REFERENCE.md](./SIGNING_REFERENCE.md) |
| **See visual workflow** | [SIGNING_WORKFLOW_DIAGRAM.md](./SIGNING_WORKFLOW_DIAGRAM.md) |
| **Check what files exist** | [../SIGNING_FILES_MANIFEST.md](../SIGNING_FILES_MANIFEST.md) |
| **Troubleshoot an issue** | [Troubleshooting](#troubleshooting) below |
| **Upgrade to Developer ID** | [Upgrade Paths](#upgrade-paths) below |

---

## Getting Started

### ⏱️ Time Investment

- **Initial setup:** 5 minutes (one-time)
- **First build:** 2 minutes
- **CI/CD setup:** 10 minutes (optional)
- **Daily signing:** 30 seconds

### 🎯 Recommended Path

```
Day 1: Setup
├─> Read: SIGNING_QUICK_START.md (2 min)
├─> Create certificate via Keychain Access (3 min)
├─> Run: ./scripts/check_certificate.sh (10 sec)
└─> Run: ./scripts/test_signing_workflow.sh (15 sec)

Day 2: First Build
├─> Build your apps (varies)
├─> Update paths in scripts/sign_all_apps.sh (1 min)
├─> Run: ./scripts/sign_all_apps.sh (30 sec)
└─> Run: ./scripts/verify_apps.sh (10 sec)

Week 2: Automation (optional)
├─> Read: docs/github_actions_signing.md (5 min)
├─> Export certificate, add GitHub secrets (5 min)
└─> Push tag, verify workflow (5 min)
```

---

## File Reference

### 📁 Structure

```
easymo/
├── scripts/                              (6 signing scripts)
│   ├── list_identities.sh               Standalone: List certificates
│   ├── check_certificate.sh             Standalone: Verify setup
│   ├── sign_app.sh                      Core: Sign single app
│   ├── sign_all_apps.sh                 ⭐ MAIN: Sign both apps
│   ├── verify_apps.sh                   Standalone: Verify signatures
│   └── test_signing_workflow.sh         Standalone: Test suite
│
├── docs/                                 (5 documentation files)
│   ├── internal_mac_signing.md          Complete guide (8.4 KB)
│   ├── github_actions_signing.md        CI/CD setup (6.4 KB)
│   ├── SIGNING_REFERENCE.md             Master index (11.6 KB)
│   ├── SIGNING_WORKFLOW_DIAGRAM.md      Visual diagrams (20 KB)
│   └── INDEX.md                         This file
│
├── .github/workflows/                    (1 workflow file)
│   └── macos-signing.yml                GitHub Actions workflow
│
├── SIGNING_QUICK_START.md               Start here! (3 KB)
└── SIGNING_FILES_MANIFEST.md            Complete manifest (4.5 KB)
```

### 🎯 Entry Points

| For... | Start with |
|--------|------------|
| **First-time users** | `SIGNING_QUICK_START.md` |
| **Daily signing** | `./scripts/sign_all_apps.sh` |
| **Troubleshooting** | `docs/internal_mac_signing.md` → Troubleshooting |
| **CI/CD setup** | `docs/github_actions_signing.md` |
| **Reference lookup** | `docs/SIGNING_REFERENCE.md` |
| **Visual learners** | `docs/SIGNING_WORKFLOW_DIAGRAM.md` |

---

## Common Tasks

### One-Time Setup

```bash
# 1. Create certificate (Keychain Access GUI)
open "/Applications/Utilities/Keychain Access.app"
# Menu: Certificate Assistant → Create a Certificate
# Name: "Inhouse Dev Signing"
# Type: Code Signing
# Trust: Always Trust

# 2. Verify certificate exists
./scripts/check_certificate.sh

# 3. Test workflow
./scripts/test_signing_workflow.sh
```

### Daily Development

```bash
# Build apps (your build process)
npm run build  # or electron-builder, etc.

# Sign both apps
./scripts/sign_all_apps.sh

# Verify signatures
./scripts/verify_apps.sh

# Done! Apps ready for distribution
```

### Team Distribution

```bash
# Export certificate (developer)
# 1. Open Keychain Access
# 2. Find "Inhouse Dev Signing"
# 3. Right-click → Export
# 4. Save as InhouseDevSigning.p12
# 5. Set password
# 6. Share .p12 + password securely (NOT in git!)

# Import certificate (team member)
# 1. Double-click InhouseDevSigning.p12
# 2. Enter password
# 3. Open Keychain Access
# 4. Find certificate → Double-click
# 5. Trust → Code Signing → Always Trust
```

### CI/CD Setup

```bash
# Export for GitHub Actions
security find-identity -v -p codesigning
security export -t identities -f pkcs12 \
  -P "password123" -o cert.p12 "Inhouse Dev Signing"
base64 -i cert.p12 -o cert.txt

# Add to GitHub Secrets:
# - MACOS_CERTIFICATE_BASE64 (contents of cert.txt)
# - MACOS_CERTIFICATE_PASSWORD (password123)
# - KEYCHAIN_PASSWORD (any random 32-char password)

# Clean up
rm cert.p12 cert.txt
```

---

## Troubleshooting

### Quick Diagnostics

```bash
# Check certificate exists
./scripts/check_certificate.sh

# List all identities
./scripts/list_identities.sh

# Run full test suite
./scripts/test_signing_workflow.sh

# Verify specific app
codesign --verify --deep --strict --verbose=2 ./path/to/App.app
spctl --assess --verbose=4 --type execute ./path/to/App.app
```

### Common Issues

| Problem | Solution |
|---------|----------|
| **"No identity found"** | Create certificate in Keychain Access. See SIGNING_QUICK_START.md |
| **"Certificate not trusted"** | Open certificate in Keychain → Trust → Code Signing → Always Trust |
| **"App bundle not found"** | Update paths in `scripts/sign_all_apps.sh` lines 28-29 |
| **"Signature invalid"** | Re-sign: `./scripts/sign_all_apps.sh` |
| **"Gatekeeper rejects app"** | Normal for self-signed. Right-click → Open on first launch |
| **CI/CD "No identity found"** | Check GitHub Secrets are set correctly |

**Full troubleshooting:** [docs/internal_mac_signing.md](./internal_mac_signing.md) → Troubleshooting section

---

## CI/CD

### Workflow Triggers

```bash
# Trigger on version tag
git tag v1.0.0
git push origin v1.0.0

# Manual trigger
# Go to GitHub → Actions → macOS Code Signing → Run workflow
```

### Workflow Jobs

1. **validate-scripts** - Runs on all PRs
   - Checks script permissions
   - Validates bash syntax
   - Runs test suite

2. **sign-apps** - Runs on tags/manual
   - Imports certificate
   - Builds apps
   - Signs with `sign_all_apps.sh`
   - Creates DMG files
   - Uploads artifacts

3. **notarize** - Optional (disabled by default)
   - Requires Apple Developer ID
   - Submits to Apple for notarization

### Artifacts

After workflow completes:
- `admin-panel-signed/` - Signed Admin Panel.app
- `client-portal-signed/` - Signed Client Portal.app
- `dmg-installers/` - DMG files for distribution

**Setup guide:** [docs/github_actions_signing.md](./github_actions_signing.md)

---

## Upgrade Paths

### Self-Signed → Apple Developer ID

**Time:** 15 minutes  
**Cost:** $99/year  
**Benefits:** No warnings, works instantly, public-ready

```bash
# 1. Join Apple Developer Program
# https://developer.apple.com/programs/

# 2. Get Developer ID certificate (Xcode)
# Preferences → Accounts → Manage Certificates → +

# 3. Update scripts/sign_all_apps.sh line 33
DEFAULT_IDENTITY="Developer ID Application: Your Company (TEAMID)"

# 4. Update GitHub Actions workflow (if using CI/CD)
# See docs/github_actions_signing.md → "Upgrading to Apple Developer ID"

# 5. Re-sign apps
./scripts/sign_all_apps.sh
```

**Full guide:** [docs/internal_mac_signing.md](./internal_mac_signing.md) → Part 7

### Developer ID → Notarized

**Time:** 5 minutes (if you already have Developer ID)  
**Cost:** Included in Developer ID  
**Benefits:** Maximum trust, no warnings

```bash
# 1. Enable notarization in CI/CD workflow
# Edit .github/workflows/macos-signing.yml line 165
if: false  # Change to: if: true

# 2. Add GitHub Secrets
# - APPLE_ID
# - APPLE_APP_SPECIFIC_PASSWORD
# - APPLE_TEAM_ID

# 3. Push tag
git tag v1.0.0 && git push origin v1.0.0
```

**Full guide:** [docs/github_actions_signing.md](./github_actions_signing.md) → Notarization

### Manual → Automated (CI/CD)

**Time:** 10 minutes  
**Cost:** Free  
**Benefits:** Automatic signing on every release

```bash
# 1. Export certificate for CI
# See "CI/CD Setup" in Common Tasks above

# 2. Add GitHub Secrets
# See docs/github_actions_signing.md → Quick Setup

# 3. Push tag to trigger workflow
git tag v1.0.0 && git push origin v1.0.0
```

---

## Quick Commands Reference

```bash
# === Setup ===
./scripts/check_certificate.sh           # Verify certificate
./scripts/test_signing_workflow.sh       # Run tests

# === Signing ===
./scripts/sign_all_apps.sh               # Sign both apps (main)
./scripts/sign_app.sh <path> <identity>  # Sign one app
./scripts/verify_apps.sh                 # Verify signatures

# === Information ===
./scripts/list_identities.sh             # List certificates
codesign -dvv ./App.app                  # Show signature details
spctl --assess --verbose ./App.app       # Check Gatekeeper status

# === Verification ===
codesign --verify --deep --strict ./App.app        # Verify signature
spctl --assess --verbose=4 --type execute ./App.app # Assess Gatekeeper
```

---

## Documentation Map

```
START HERE
    │
    ├─── SIGNING_QUICK_START.md ········ 5-minute setup
    │       │
    │       ├─── Need details? ········· internal_mac_signing.md
    │       ├─── Setting up CI/CD? ····· github_actions_signing.md
    │       ├─── Looking for X? ········ SIGNING_REFERENCE.md
    │       └─── Want diagrams? ········ SIGNING_WORKFLOW_DIAGRAM.md
    │
    ├─── SIGNING_FILES_MANIFEST.md ····· Complete file list
    └─── INDEX.md ······················ This file (you are here)
```

---

## Support & Resources

### Internal Resources

- **Scripts:** [../scripts/README.md](../scripts/README.md)
- **Main README:** [../README.md](../README.md)
- **All signing docs:** [./](./index.md)

### External Resources

- [Apple Code Signing Guide](https://developer.apple.com/support/code-signing/)
- [Apple Notarization Guide](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [codesign man page](https://www.manpagez.com/man/1/codesign/)

---

## Metrics

- **Setup time:** 5 minutes (one-time)
- **Daily signing:** 30 seconds
- **Files created:** 13
- **Documentation:** 50+ KB
- **Test coverage:** 7 automated tests
- **Supported apps:** 2 (Admin Panel + Client/Staff Portal)
- **Scripts:** 6 production-ready tools
- **CI/CD workflows:** 1 (GitHub Actions)

---

**Last updated:** 2025-12-02  
**Version:** 1.0.0  
**Status:** Production Ready ✓  
**Maintainer:** EasyMO DevOps Team

---

🚀 **You're all set! Pick a task from "I want to..." above and get started.**
