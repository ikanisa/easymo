# macOS Code Signing - Complete Reference

Comprehensive index of all signing-related files and workflows.

## 📁 File Structure

```
easymo/
├── scripts/
│   ├── list_identities.sh           # List available code-signing identities
│   ├── sign_app.sh                   # Sign a single .app bundle
│   ├── sign_all_apps.sh              # Sign both apps at once
│   ├── check_certificate.sh          # Verify certificate setup
│   ├── verify_apps.sh                # Verify signatures post-signing
│   └── test_signing_workflow.sh      # End-to-end test suite
├── docs/
│   ├── internal_mac_signing.md       # Complete signing guide (8.4 KB)
│   └── github_actions_signing.md     # CI/CD automation guide
├── .github/workflows/
│   └── macos-signing.yml             # Automated signing workflow
├── SIGNING_QUICK_START.md            # 5-minute getting started
└── .gitignore                        # Blocks .p12, .cer files
```

---

## 🚀 Quick Commands

### Development Workflow
```bash
# 1. Verify certificate exists
./scripts/check_certificate.sh

# 2. List available identities
./scripts/list_identities.sh

# 3. Sign both apps
./scripts/sign_all_apps.sh

# 4. Verify signatures
./scripts/verify_apps.sh

# 5. Run full test suite
./scripts/test_signing_workflow.sh
```

### CI/CD Workflow
```bash
# Trigger automated signing on GitHub
git tag v1.0.0
git push origin v1.0.0

# Or manually via GitHub Actions UI:
# Actions → macOS Code Signing → Run workflow
```

---

## 📚 Documentation Map

| Document | Purpose | Audience | Length |
|----------|---------|----------|--------|
| **SIGNING_QUICK_START.md** | Fast setup guide | Developers | 2 min read |
| **docs/internal_mac_signing.md** | Complete reference | All users | 10 min read |
| **docs/github_actions_signing.md** | CI/CD setup | DevOps | 5 min read |

### When to use which doc:

- **First time setup?** → `SIGNING_QUICK_START.md`
- **Need detailed steps?** → `docs/internal_mac_signing.md`
- **Setting up CI/CD?** → `docs/github_actions_signing.md`
- **Troubleshooting?** → `docs/internal_mac_signing.md` (Troubleshooting section)

---

## 🔧 Script Reference

### `list_identities.sh`
**Purpose:** List all code-signing identities on the current Mac.

**Usage:**
```bash
./scripts/list_identities.sh
```

**Output:**
- All valid code-signing certificates
- Instructions for setting `SIGNING_IDENTITY` env var

**When to use:**
- Verify certificate exists before signing
- Find exact certificate name
- Debug "identity not found" errors

---

### `check_certificate.sh`
**Purpose:** Verify a specific certificate exists and is trusted.

**Usage:**
```bash
./scripts/check_certificate.sh ["Certificate Name"]

# Default checks "Inhouse Dev Signing"
./scripts/check_certificate.sh

# Check custom certificate
./scripts/check_certificate.sh "Developer ID Application: Company (TEAMID)"
```

**Output:**
- ✅ Certificate found
- ✅ Trust settings
- ✅ Validity period

**Exit codes:**
- `0` = Certificate found and valid
- `1` = Certificate not found

**When to use:**
- Before running signing scripts
- Debugging trust issues
- Verifying setup on new machines

---

### `sign_app.sh`
**Purpose:** Sign a single macOS .app bundle with full verification.

**Usage:**
```bash
./scripts/sign_app.sh <app-path> <identity> [entitlements-path]

# Basic usage
./scripts/sign_app.sh ./dist/mac/AdminPanel.app "Inhouse Dev Signing"

# With entitlements
./scripts/sign_app.sh ./dist/mac/AdminPanel.app "Inhouse Dev Signing" ./entitlements.plist
```

**Features:**
- Deep signing with `--deep`
- Hardened runtime with `--options runtime`
- Timestamping
- Automatic verification
- Gatekeeper assessment
- Color-coded output

**Exit codes:**
- `0` = Successfully signed and verified
- `1` = Signing or verification failed

**When to use:**
- Sign a single app during development
- Test signing setup
- Called by `sign_all_apps.sh`

---

### `sign_all_apps.sh`
**Purpose:** Sign both apps (Admin Panel + Client/Staff Portal) in one command.

**Usage:**
```bash
# Use default identity
./scripts/sign_all_apps.sh

# Override identity
SIGNING_IDENTITY="Developer ID Application: Company (TEAMID)" ./scripts/sign_all_apps.sh
```

**Configuration:**
Edit lines 28-29 to set app paths:
```bash
ADMIN_APP_PATH="./dist/mac/AdminPanel.app"
CLIENT_APP_PATH="./dist/mac/ClientPortal.app"
```

Edit line 33 for default identity:
```bash
DEFAULT_IDENTITY="Inhouse Dev Signing"
```

**Exit codes:**
- `0` = Both apps signed successfully
- `1` = One or more apps failed

**When to use:**
- Sign both apps before distribution
- Automated CI/CD pipelines
- Release builds

---

### `verify_apps.sh`
**Purpose:** Comprehensive verification of signed apps.

**Usage:**
```bash
./scripts/verify_apps.sh
```

**Checks:**
1. App bundle exists
2. Signature validity (`codesign --verify`)
3. Signature details (authority, identifier)
4. Gatekeeper status (`spctl --assess`)

**Output:**
- Detailed verification report for each app
- Color-coded status (green=pass, red=fail, yellow=warning)

**Exit codes:**
- `0` = All apps verified successfully
- `1` = One or more apps failed verification

**When to use:**
- After signing apps
- Before distributing to users
- Debugging signature issues
- CI/CD verification step

---

### `test_signing_workflow.sh`
**Purpose:** End-to-end test of the entire signing workflow.

**Usage:**
```bash
./scripts/test_signing_workflow.sh
```

**Tests:**
1. ✅ All scripts exist and are executable
2. ✅ Documentation files exist
3. ✅ Scripts run without errors
4. ✅ Certificate exists (if available)
5. ✅ Can sign mock .app bundles
6. ✅ Signatures verify correctly
7. ✅ `.gitignore` blocks .p12 files

**Features:**
- Creates temporary mock .app bundles
- Safe to run repeatedly (no side effects)
- Auto-cleanup on exit
- Works with or without certificate

**Exit codes:**
- `0` = All tests passed
- `1` = One or more tests failed

**When to use:**
- After initial setup
- Before committing changes to signing scripts
- CI/CD validation
- Debugging setup issues

---

## 🔐 Security

### Protected Files (never commit)
```
*.p12                    # Certificate exports
*.cer                    # Certificate files
*.mobileprovision        # Provisioning profiles
InhouseDevSigning.*      # Certificate exports
*.certSigningRequest     # CSR files
```

All these are automatically blocked by `.gitignore`.

### GitHub Secrets (required for CI/CD)
```
MACOS_CERTIFICATE_BASE64      # Base64-encoded .p12
MACOS_CERTIFICATE_PASSWORD    # .p12 password
KEYCHAIN_PASSWORD             # Temporary keychain password
APPLE_ID                      # (Optional) For notarization
APPLE_APP_SPECIFIC_PASSWORD   # (Optional) For notarization
APPLE_TEAM_ID                 # (Optional) For notarization
```

---

## 🎯 Common Workflows

### First-Time Setup (Developer)
```bash
# 1. Create certificate (Keychain Access GUI)
# 2. Verify setup
./scripts/check_certificate.sh

# 3. Update app paths
vim scripts/sign_all_apps.sh  # Edit lines 28-29

# 4. Test workflow
./scripts/test_signing_workflow.sh

# 5. Sign real apps
./scripts/sign_all_apps.sh
```

### Daily Development
```bash
# After building apps
./scripts/sign_all_apps.sh && ./scripts/verify_apps.sh
```

### Release Build
```bash
# 1. Tag release
git tag v1.2.3

# 2. Push tag (triggers CI/CD)
git push origin v1.2.3

# 3. Download signed apps from GitHub Actions artifacts
```

### New Team Member Setup
```bash
# 1. Import .p12 certificate (double-click, trust it)
# 2. Verify setup
./scripts/check_certificate.sh

# 3. Test
./scripts/test_signing_workflow.sh
```

### Upgrade to Apple Developer ID
```bash
# 1. Get certificate from Apple Developer portal
# 2. Update scripts/sign_all_apps.sh line 33:
DEFAULT_IDENTITY="Developer ID Application: Your Company (TEAMID)"

# 3. Update CI/CD workflow (see docs/github_actions_signing.md)
# 4. Re-sign apps
./scripts/sign_all_apps.sh
```

---

## 🐛 Troubleshooting

| Problem | Solution | Doc Reference |
|---------|----------|---------------|
| "No identity found" | Run `./scripts/check_certificate.sh` | `docs/internal_mac_signing.md` |
| "App bundle not found" | Update paths in `sign_all_apps.sh` | `SIGNING_QUICK_START.md` |
| "Signature invalid" | Re-sign: `./scripts/sign_all_apps.sh` | `docs/internal_mac_signing.md` |
| CI/CD fails | Check GitHub Secrets | `docs/github_actions_signing.md` |
| Gatekeeper rejects | Right-click → Open (first time only) | `SIGNING_QUICK_START.md` |
| Certificate not trusted | Mark "Always Trust" in Keychain | `docs/internal_mac_signing.md` |

Full troubleshooting guide: `docs/internal_mac_signing.md` → Troubleshooting section

---

## 🔄 Upgrade Paths

### Self-Signed → Developer ID
**Effort:** 15 minutes  
**Cost:** $99/year  
**Benefits:** No user warnings, works on any Mac  
**Guide:** `docs/internal_mac_signing.md` → Part 7

### Manual → CI/CD
**Effort:** 10 minutes  
**Cost:** Free  
**Benefits:** Automatic signing on release  
**Guide:** `docs/github_actions_signing.md`

### Developer ID → Notarized
**Effort:** 5 minutes (if already have Dev ID)  
**Cost:** Included in Developer ID  
**Benefits:** Extra trust, no warnings  
**Guide:** `docs/github_actions_signing.md` → Notarization

---

## 📊 Metrics

| Metric | Value |
|--------|-------|
| Scripts | 6 executable files |
| Documentation | 3 comprehensive guides |
| Total Lines | ~1,200 LOC (scripts + docs) |
| Setup time | 5 minutes (first time) |
| Sign time | <30 seconds (both apps) |
| Test time | ~10 seconds |
| CI/CD time | ~5 minutes (build + sign + upload) |

---

## ✅ Checklist

### For Developers
- [ ] Read `SIGNING_QUICK_START.md`
- [ ] Create certificate in Keychain Access
- [ ] Run `./scripts/check_certificate.sh` (passes)
- [ ] Update app paths in `sign_all_apps.sh`
- [ ] Run `./scripts/test_signing_workflow.sh` (passes)
- [ ] Sign real apps with `./scripts/sign_all_apps.sh`
- [ ] Verify with `./scripts/verify_apps.sh`

### For Team Members
- [ ] Receive .p12 file + password securely
- [ ] Import certificate (double-click .p12)
- [ ] Trust certificate in Keychain Access
- [ ] Run `./scripts/check_certificate.sh` (passes)
- [ ] Test with `./scripts/test_signing_workflow.sh`

### For DevOps
- [ ] Read `docs/github_actions_signing.md`
- [ ] Export certificate as base64
- [ ] Add GitHub Secrets (3 required)
- [ ] Test workflow manually (Actions UI)
- [ ] Verify artifacts download correctly
- [ ] (Optional) Enable notarization

---

## 🎓 Learning Path

1. **Beginner:** Start with `SIGNING_QUICK_START.md`
2. **Intermediate:** Read `docs/internal_mac_signing.md` fully
3. **Advanced:** Set up CI/CD via `docs/github_actions_signing.md`
4. **Expert:** Customize scripts for your build process

---

## 🔗 External Resources

- [Apple Code Signing Guide](https://developer.apple.com/support/code-signing/)
- [Apple Notarization Guide](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [codesign Manual](https://www.manpagez.com/man/1/codesign/)
- [spctl Manual](https://www.manpagez.com/man/8/spctl/)

---

## 📝 Maintenance

### Regular Tasks
- **Quarterly:** Verify certificates haven't expired
- **Yearly:** Review trust settings on all Macs
- **Every 2-3 years:** Rotate certificates

### Updates
- Scripts are designed to be future-proof
- Changing identity name: Edit one variable
- Adding third app: Add to `sign_all_apps.sh`
- New entitlements: Pass as third argument to `sign_app.sh`

---

**Last updated:** 2025-12-02  
**Version:** 1.0.0  
**Maintainer:** EasyMO DevOps Team
