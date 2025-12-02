# 🚀 MASTER DESKTOP DEPLOYMENT CHECKLIST

**EasyMO Desktop Apps - Complete Release Playbook**

For all desktop platforms: **macOS** (Admin Panel + Client/Staff Portal), **Windows**, **Linux**

**Version:** 1.0.0  
**Last Updated:** 2025-12-02  
**Maintained By:** EasyMO DevOps Team

---

## 📋 Quick Navigation

| Section | Time Required |
|---------|---------------|
| [Pre-Release Requirements](#-pre-release-requirements) | One-time setup |
| [Credentials & Secrets](#-credentials--secrets) | 15 min (first time) |
| [Release Workflow](#-release-workflow) | 30 min per release |
| [QA Checklist](#-qa-checklist) | 15 min per release |
| [Distribution](#-distribution-options) | 10 min per release |
| [Post-Release](#-post-release-steps) | 30 min per release |

**Total time per release:** ~1.5 hours (after initial setup)

---

## 🔧 Pre-Release Requirements

**Complete these ONCE, before your first release:**

### Infrastructure Checklist

| Status | Item | Verification | Priority |
|--------|------|--------------|----------|
| ☐ | **CI/CD builds successfully on GitHub Actions** | Check latest workflow run | 🔴 Critical |
| ☐ | **Versioning strategy documented** | SemVer (v1.4.2) | 🔴 Critical |
| ☐ | **CHANGELOG.md exists** | `cat CHANGELOG.md` | 🔴 Critical |
| ☐ | **macOS code-signing works locally** | `./scripts/test_signing_workflow.sh` | 🔴 Critical |
| ☐ | **macOS code-signing works in CI** | Check workflow logs | 🔴 Critical |
| ☐ | **Windows code-signing configured** | `signtool verify YourApp.exe` | 🟡 High |
| ☐ | **Linux packaging working** | Test `.AppImage` build | 🟢 Medium |
| ☐ | **Distribution point ready** | GitHub Releases or portal | 🔴 Critical |

---

## 🔑 Credentials & Secrets

### Required GitHub Secrets

**Go to:** Repository → Settings → Secrets and variables → Actions

#### macOS Signing (Already Configured ✅)

| Secret Name | Value | Status |
|-------------|-------|--------|
| `MACOS_CERTIFICATE_BASE64` | Base64-encoded .p12 | ✅ Set |
| `MACOS_CERTIFICATE_PASSWORD` | .p12 password | ✅ Set |
| `KEYCHAIN_PASSWORD` | Random 32-char string | ✅ Set |

**Verify:**
```bash
./scripts/check_certificate.sh
```

**Documentation:** Already complete at `docs/github_actions_signing.md`

#### Windows Signing (TODO: Create)

| Secret Name | Value | How to Get |
|-------------|-------|------------|
| `WIN_CERTIFICATE_BASE64` | Base64 .pfx file | Export from cert store |
| `WIN_CERTIFICATE_PASSWORD` | .pfx password | From export |
| `WIN_CERT_SUBJECT_NAME` | "EasyMO Inc" | Certificate CN |

**Create Windows signing docs:**
```bash
# TODO: Create docs/windows_signing.md
# Similar to docs/internal_mac_signing.md but for Windows
```

#### Linux (Optional - No secrets needed typically)

Linux packages (.AppImage, .deb) don't require code signing for internal use.

**Optional:** GPG signing for .deb packages (advanced).

---

## 🔄 Release Workflow

### Phase 1: Preparation (5 minutes)

#### Step 1.1: Pull Latest Code

```bash
git checkout main
git pull origin main
git status  # Should be clean
```

**✓ Checklist:**
- ☐ On `main` branch
- ☐ Working tree clean
- ☐ Up to date with remote

---

#### Step 1.2: Update Version Numbers

**Files to modify:**

1. **Root `package.json`:**
   ```json
   {
     "version": "1.4.2"
   }
   ```

2. **Admin app `admin-app/package.json`:**
   ```json
   {
     "version": "1.4.2"
   }
   ```

3. **Client app (if separate):**
   ```json
   {
     "version": "1.4.2"
   }
   ```

**Quick update script:**
```bash
# Update all at once
pnpm version 1.4.2 --no-git-tag-version
cd admin-app && pnpm version 1.4.2 --no-git-tag-version && cd ..
cd client-portal && pnpm version 1.4.2 --no-git-tag-version && cd ..
```

**✓ Checklist:**
- ☐ Root package.json = 1.4.2
- ☐ Admin app package.json = 1.4.2
- ☐ Client app package.json = 1.4.2

---

#### Step 1.3: Update CHANGELOG.md

**Add to top of file:**

```markdown
## [1.4.2] - 2025-12-02

### Added
- New feature: X
- Enhancement: Y

### Fixed
- Bug: Z causing crashes
- Performance: Improved load time

### Changed
- Updated dependency A to v2.0

### Security
- Fixed vulnerability in package B
```

**✓ Checklist:**
- ☐ Version header added
- ☐ Date is today
- ☐ Changes documented (Added/Fixed/Changed/Security)
- ☐ Follows [Keep a Changelog](https://keepachangelog.com/) format

---

#### Step 1.4: Commit & Tag

```bash
# Stage changes
git add package.json */package.json CHANGELOG.md

# Commit
git commit -m "chore: release v1.4.2

- Update version to 1.4.2
- Update CHANGELOG
"

# Create annotated tag
git tag -a v1.4.2 -m "Release v1.4.2"

# Push everything
git push origin main
git push origin v1.4.2
```

**✓ Checklist:**
- ☐ Changes committed
- ☐ Tag created (annotated with `-a`)
- ☐ Commit pushed to `main`
- ☐ Tag pushed to remote

---

### Phase 2: Automated Build (5-15 minutes)

#### Step 2.1: Monitor GitHub Actions

1. **Go to:** https://github.com/your-org/easymo/actions
2. **Find:** Workflow run for tag `v1.4.2`
3. **Monitor jobs:**
   - ✓ `validate-scripts` (macOS)
   - ✓ `sign-apps` (macOS)
   - ✓ `build-windows` (Windows) - if configured
   - ✓ `build-linux` (Linux) - if configured

**Expected duration:**
- macOS: ~5 min
- Windows: ~8 min
- Linux: ~3 min

**If build fails:**
```bash
# Check logs for errors
# Common issues:
# - Missing secrets
# - Invalid certificate
# - Build configuration error

# Fix and re-push tag:
git tag -d v1.4.2
git push origin :refs/tags/v1.4.2
# Fix issue
git tag -a v1.4.2 -m "Release v1.4.2"
git push origin v1.4.2
```

**✓ Checklist:**
- ☐ All jobs started
- ☐ All jobs completed ✓
- ☐ No red X failures

---

#### Step 2.2: Download Artifacts

After all jobs complete:

1. Click on workflow run
2. Scroll to **Artifacts** section
3. Download:

**macOS (from existing workflow):**
- `admin-panel-signed.zip`
- `client-portal-signed.zip`
- `dmg-installers.zip` (contains .dmg files)

**Windows (when configured):**
- `windows-installers.zip`

**Linux (when configured):**
- `linux-packages.zip` (.AppImage, .deb, .rpm)

**Extract locally:**
```bash
mkdir release-v1.4.2
cd release-v1.4.2
unzip ~/Downloads/admin-panel-signed.zip
unzip ~/Downloads/client-portal-signed.zip
unzip ~/Downloads/dmg-installers.zip
```

**✓ Checklist:**
- ☐ All artifacts downloaded
- ☐ Files extracted
- ☐ No corruption (files open correctly)

---

### Phase 3: Verification (10 minutes)

#### Step 3.1: Verify macOS Apps

```bash
cd release-v1.4.2

# Verify Admin Panel
./scripts/verify_apps.sh
# OR manually:
codesign --verify --deep --strict AdminPanel.app
spctl --assess --verbose AdminPanel.app

# Test launch
open AdminPanel.app

# Verify Client/Staff Portal
codesign --verify --deep --strict ClientPortal.app
open ClientPortal.app
```

**What to check:**
- ☐ Apps launch without crash
- ☐ No "unverified developer" error (or right-click → Open works)
- ☐ Version in About dialog = v1.4.2
- ☐ Login works
- ☐ Core features work

---

#### Step 3.2: Verify Windows (if applicable)

**On Windows machine:**

```powershell
# Verify signature
signtool verify /pa /v "EasyMO-Admin-Setup.exe"

# Run installer
.\EasyMO-Admin-Setup.exe

# Launch from Start Menu
# Verify version in About
```

**What to check:**
- ☐ Installer signature valid
- ☐ Install completes without errors
- ☐ App launches from Start Menu
- ☐ Version = v1.4.2
- ☐ Login works

---

#### Step 3.3: Verify Linux (if applicable)

**On Linux machine:**

```bash
# Test AppImage
chmod +x EasyMO-Admin.AppImage
./EasyMO-Admin.AppImage

# Test .deb
sudo dpkg -i easymo-admin_1.4.2_amd64.deb
easymo-admin
```

**What to check:**
- ☐ AppImage runs with exec permission
- ☐ .deb installs without dependency errors
- ☐ App appears in menu
- ☐ Version = v1.4.2
- ☐ Scaling looks correct (HiDPI)

---

## 🧪 QA Checklist

**Complete BEFORE publishing:**

### Critical Tests (Must Pass)

| Status | Test | Platform | Pass/Fail |
|--------|------|----------|-----------|
| ☐ | **App launches** | macOS Admin | _____ |
| ☐ | **App launches** | macOS Client | _____ |
| ☐ | **App launches** | Windows | _____ |
| ☐ | **App launches** | Linux | _____ |
| ☐ | **Login works** | All platforms | _____ |
| ☐ | **Version correct** | All platforms | _____ |
| ☐ | **Signature valid** | macOS + Windows | _____ |
| ☐ | **No crashes on idle** | All (5 min idle) | _____ |

### Feature Tests

| Status | Feature | Expected Behavior |
|--------|---------|-------------------|
| ☐ | **Dashboard loads** | Shows recent data |
| ☐ | **Search works** | Returns results |
| ☐ | **Navigation** | All screens accessible |
| ☐ | **Forms submit** | Data saves correctly |
| ☐ | **Offline mode** | Graceful degradation |
| ☐ | **Real-time updates** | Data syncs (if applicable) |

### Performance Tests

| Metric | Target | Actual | Pass/Fail |
|--------|--------|--------|-----------|
| **Launch time** | <3 seconds | _____ sec | _____ |
| **Login time** | <2 seconds | _____ sec | _____ |
| **Memory (idle)** | <200 MB | _____ MB | _____ |
| **CPU (idle)** | <5% | _____ % | _____ |

**If any critical test fails:** DO NOT PUBLISH. Fix and re-release.

---

## 🚢 Distribution Options

### Option 1: GitHub Releases (Recommended for Internal)

**Steps:**

1. **Go to:** https://github.com/your-org/easymo/releases
2. **Click:** "Draft a new release"
3. **Fill in:**
   - **Tag:** v1.4.2 (select existing)
   - **Title:** `EasyMO Desktop v1.4.2`
   - **Description:**
     ```markdown
     ## What's New in v1.4.2
     
     ### Added
     - Feature X
     
     ### Fixed
     - Bug Y
     
     ## Downloads
     
     ### macOS
     - [Admin Panel (.dmg)](uploaded file)
     - [Client/Staff Portal (.dmg)](uploaded file)
     
     ### Windows
     - [Admin Panel Installer](uploaded file)
     - [Client/Staff Portal Installer](uploaded file)
     
     ### Linux
     - [AppImage](uploaded file)
     - [.deb Package](uploaded file)
     
     ## Installation
     
     **macOS:** Double-click .dmg, drag to Applications  
     **Windows:** Run .exe installer  
     **Linux:** `chmod +x *.AppImage` and run  
     
     See [docs/installation.md](link) for details.
     ```

4. **Upload files:**
   - Drag & drop all .dmg, .exe, .AppImage, .deb files
   - GitHub will host them

5. **Publish:**
   - ☐ Set as "Latest release"
   - ☐ Click "Publish release"

**Benefits:**
- ✅ Version control
- ✅ Automatic changelog
- ✅ Download statistics
- ✅ Works with auto-updaters

---

### Option 2: Internal Download Portal

**Best for:** Employee-only access, controlled distribution

**Setup:**

1. Upload to Supabase Storage / S3 / R2:
   ```bash
   # Example: Supabase
   supabase storage create desktop-apps
   supabase storage upload desktop-apps/v1.4.2/AdminPanel.dmg
   ```

2. Create download page (Next.js / static):
   ```tsx
   // downloads.tsx
   export default function Downloads() {
     return (
       <div>
         <h1>EasyMO Desktop v1.4.2</h1>
         <h2>macOS</h2>
         <a href="/api/download/admin-macos">Admin Panel</a>
         <a href="/api/download/client-macos">Client Portal</a>
         
         <h2>Windows</h2>
         <a href="/api/download/admin-windows">Admin Panel</a>
         
         <h2>Linux</h2>
         <a href="/api/download/admin-linux">AppImage</a>
       </div>
     );
   }
   ```

3. Add authentication (if needed)

**Benefits:**
- ✅ Full control
- ✅ Analytics
- ✅ Access control
- ✅ Custom branding

---

### Option 3: Network Share (Corporate)

**For organizations with shared drives:**

```bash
# Copy to network share
cp -r release-v1.4.2/* /Volumes/SharedDrive/EasyMO/v1.4.2/

# Create README
cat > /Volumes/SharedDrive/EasyMO/v1.4.2/README.txt << EOF
EasyMO Desktop v1.4.2
Released: 2025-12-02

Installation:
- macOS: Open .dmg file, drag to Applications
- Windows: Run .exe installer
- Linux: chmod +x *.AppImage, then run

Support: support@easymo.com
EOF
```

**Benefits:**
- ✅ No internet required
- ✅ Fast downloads
- ✅ Corporate-friendly

---

## 🔁 Post-Release Steps

### Immediate (Within 1 Hour)

#### 1. Announce Release

**Slack/Teams message:**
```
🎉 EasyMO Desktop v1.4.2 is now available!

✨ What's New:
• Feature X for faster workflows
• Bug fix Y improving stability

📥 Download:
macOS: https://github.com/org/repo/releases/tag/v1.4.2
Windows: [link]
Linux: [link]

📖 Full changelog: [CHANGELOG.md link]

Questions? Ask in #easymo-support
```

**✓ Checklist:**
- ☐ Slack/Teams announcement posted
- ☐ Support team notified
- ☐ Internal wiki updated

---

#### 2. Log Release

**Create/update `RELEASES.md`:**

```markdown
# Release History

## v1.4.2 - 2025-12-02

**Released by:** [Your Name]  
**Build time:** 12 minutes  
**Platforms:** macOS, Windows, Linux  

**Artifacts:**
- AdminPanel-macOS.dmg (48.2 MB)
- ClientPortal-macOS.dmg (47.8 MB)
- AdminPanel-Windows.exe (82.1 MB)
- AdminPanel-Linux.AppImage (95.3 MB)

**GitHub Release:** https://github.com/org/repo/releases/tag/v1.4.2

**QA Status:** All tests passed ✓

**Issues:** None

**Rollback:** Not needed
```

**✓ Checklist:**
- ☐ RELEASES.md updated
- ☐ Build metadata logged
- ☐ GitHub Release link added

---

#### 3. Clean Up Old Builds

```bash
# Remove old versions (keep last 3)
# Example: Remove v1.4.0, keep v1.4.1 and v1.4.2

# From network share
rm -rf /SharedDrive/EasyMO/v1.4.0/

# Archive old GitHub releases (don't delete)
# Manually mark as "Pre-release" in GitHub UI
```

**✓ Checklist:**
- ☐ Old builds removed from shared drives
- ☐ GitHub releases cleaned up (archived, not deleted)
- ☐ Storage usage acceptable

---

### Within 24 Hours

#### 4. Monitor for Issues

**Check:**
- ☐ Slack #support for bug reports
- ☐ Email support@easymo.com
- ☐ Sentry (if configured) for crash reports
- ☐ GitHub Issues

**If bugs found:**
```bash
# Create issue immediately
gh issue create \
  --title "v1.4.2: Bug in feature X" \
  --label "bug,priority:high" \
  --milestone "v1.4.3"
```

---

#### 5. Collect Feedback

**Create Slack thread:**
```
📊 How's v1.4.2 working for you?

✅ What's better?
❌ What's broken?
💡 What's missing?

Reply in thread 👇
```

**✓ Checklist:**
- ☐ Feedback mechanism created
- ☐ Responses tracked
- ☐ Issues logged in GitHub

---

### Within 1 Week

#### 6. Plan Next Release

**Review:**
- Bug reports from v1.4.2
- Feature requests from users
- Performance metrics
- Competitive analysis

**Update roadmap:**
- **v1.4.3** (hotfix): Critical bugs
- **v1.5.0** (minor): New features
- **v2.0.0** (major): Breaking changes

**✓ Checklist:**
- ☐ Bugs triaged and prioritized
- ☐ Features planned for next sprint
- ☐ Team aligned on roadmap
- ☐ Milestone created in GitHub

---

## 💎 Future Upgrades

### High Priority (Do Next)

| Upgrade | Impact | Effort | Cost |
|---------|--------|--------|------|
| **Apple Notarization** | No more "right-click → Open" | 1 day | $99/year |
| **Auto-Update System** | Users auto-update | 2 weeks | Free |
| **Crash Reporting (Sentry)** | Track errors automatically | 1 day | Free tier |
| **Windows EV Cert** | No SmartScreen warnings | Purchase | $500/year |

---

### Medium Priority

| Upgrade | Impact | Effort |
|---------|--------|--------|
| **Desktop Telemetry** | Understand usage | 1 week |
| **In-App Feedback** | Users report bugs in-app | 3 days |
| **Multi-Language** | Reach more users | 3 weeks |

---

### Low Priority

| Upgrade | Impact | Effort |
|---------|--------|--------|
| **Custom Installer Themes** | Branding | 2 days |
| **Portable Versions** | No install required | 1 day |
| **Windows/Mac App Stores** | Wider distribution | 2 weeks |

---

## 🛠️ Troubleshooting

### Issue: macOS "App is Damaged"

**Symptom:** macOS refuses to open app.

**Solution:**
```bash
# Remove quarantine attribute
xattr -cr AdminPanel.app

# OR re-sign
./scripts/sign_app.sh AdminPanel.app "Inhouse Dev Signing"
```

---

### Issue: Windows SmartScreen Block

**Symptom:** Windows blocks installer.

**User Solution:**
1. Click "More info"
2. Click "Run anyway"

**Long-term Solution:** Get EV Code Signing Certificate

---

### Issue: CI Build Fails

**Diagnosis:**
1. Check GitHub Actions logs
2. Look for error messages

**Common causes:**
- Missing GitHub Secrets
- Invalid certificate
- Build configuration error

**Solution:**
```bash
# Test locally first
./scripts/test_signing_workflow.sh

# Verify secrets are set in GitHub
# Re-run workflow
```

---

## 📝 Release Template

**Copy for each release:**

```markdown
# Release v1.4.2 Checklist

**Date:** 2025-12-02  
**Released By:** [Your Name]  

## Pre-Release
- [ ] Version updated in package.json
- [ ] CHANGELOG.md updated
- [ ] Tests passing
- [ ] Code committed to main

## Build
- [ ] Tag created: v1.4.2
- [ ] Tag pushed
- [ ] CI/CD completed ✓
- [ ] Artifacts downloaded

## QA
- [ ] macOS Admin tested ✓
- [ ] macOS Client tested ✓
- [ ] Windows tested ✓
- [ ] Linux tested ✓
- [ ] All signatures valid ✓

## Distribution
- [ ] GitHub Release published
- [ ] Download portal updated
- [ ] Team notified

## Post-Release
- [ ] Slack announcement
- [ ] RELEASES.md updated
- [ ] Old builds cleaned up
- [ ] Feedback collected

## Metrics
- Build time: __ min
- Download count (week 1): __
- Issues reported: __
- Rollback needed: Yes/No
```

---

## 🎯 Success Criteria

A release is successful when:

✅ All platforms build without errors  
✅ All signatures verify correctly  
✅ QA checklist 100% complete  
✅ Zero critical bugs in first 24 hours  
✅ >80% adoption in first week  
✅ Positive user feedback  

---

## 📞 Support Contacts

| Issue Type | Contact | Channel |
|------------|---------|---------|
| **Build failures** | DevOps Team | #devops Slack |
| **Signing issues** | Security Team | security@easymo.com |
| **User bugs** | Support Team | #support Slack |
| **Feature requests** | Product Team | #product Slack |

---

**Last Updated:** 2025-12-02  
**Version:** 1.0.0  
**Next Review:** After 3 releases  

---

🚀 **Ready to release!** Follow this checklist step-by-step for smooth deployments every time.
