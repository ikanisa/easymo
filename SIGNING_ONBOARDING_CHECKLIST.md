# macOS Code Signing - Onboarding Checklist

**Use this checklist to track your setup progress.**

---

## ✅ Phase 1: Initial Setup (5 minutes)

- [ ] **Read Quick Start Guide**
  ```bash
  open SIGNING_QUICK_START.md
  ```
  Time: 2 minutes

- [ ] **Create Code Signing Certificate**
  - [ ] Open Keychain Access
  - [ ] Menu: Certificate Assistant → Create a Certificate
  - [ ] Name: `Inhouse Dev Signing`
  - [ ] Identity Type: Self Signed Root
  - [ ] Certificate Type: Code Signing
  - [ ] Let me override defaults: ✓
  - [ ] Validity: 3650 days (10 years)
  - [ ] Keychain: login
  - [ ] Created successfully
  Time: 3 minutes

- [ ] **Trust Certificate**
  - [ ] Find certificate in Keychain Access
  - [ ] Double-click certificate
  - [ ] Expand "Trust" section
  - [ ] Set "Code Signing" to "Always Trust"
  - [ ] Close window (enter password)
  Time: 30 seconds

- [ ] **Verify Setup**
  ```bash
  ./scripts/check_certificate.sh
  ```
  Expected: ✓ Certificate found
  Time: 10 seconds

- [ ] **Run Test Suite**
  ```bash
  ./scripts/test_signing_workflow.sh
  ```
  Expected: All tests pass (or certificate needed warning)
  Time: 15 seconds

**Phase 1 Complete!** ✓

---

## ✅ Phase 2: First Build (10 minutes)

- [ ] **Build Your Apps**
  ```bash
  # Your build commands (example)
  cd admin-app && npm run build
  cd ../client-portal && npm run build
  ```
  Time: Varies (5-10 minutes)

- [ ] **Update App Paths**
  - [ ] Open `scripts/sign_all_apps.sh` in editor
  - [ ] Update line 28: `ADMIN_APP_PATH="./path/to/AdminPanel.app"`
  - [ ] Update line 29: `CLIENT_APP_PATH="./path/to/ClientPortal.app"`
  - [ ] Save file
  Time: 1 minute

- [ ] **Sign Both Apps**
  ```bash
  ./scripts/sign_all_apps.sh
  ```
  Expected: ✓ ALL APPS SIGNED SUCCESSFULLY
  Time: 30 seconds

- [ ] **Verify Signatures**
  ```bash
  ./scripts/verify_apps.sh
  ```
  Expected: ✓ ALL APPS VERIFIED
  Time: 10 seconds

- [ ] **Test App Launch**
  - [ ] Double-click first app
  - [ ] If warning: Right-click → Open → Open
  - [ ] App launches successfully
  - [ ] Repeat for second app
  Time: 1 minute

**Phase 2 Complete!** ✓

---

## ✅ Phase 3: Team Distribution (15 minutes)

- [ ] **Export Certificate**
  - [ ] Open Keychain Access
  - [ ] Find "Inhouse Dev Signing"
  - [ ] Right-click → Export "Inhouse Dev Signing"
  - [ ] Save as: `InhouseDevSigning.p12`
  - [ ] Set password (write it down!)
  - [ ] Enter Mac login password to export
  Time: 2 minutes

- [ ] **Secure Distribution**
  - [ ] Choose secure channel (1Password, Slack DM, encrypted email)
  - [ ] Share .p12 file with team
  - [ ] Share password separately
  - [ ] **NEVER commit .p12 to git!**
  Time: 5 minutes

- [ ] **Document for Team**
  - [ ] Send link to SIGNING_QUICK_START.md
  - [ ] Send import instructions (Part 3 of guide)
  - [ ] Confirm team members received files
  Time: 3 minutes

- [ ] **Team Member Verification** (for each team member)
  - [ ] Import .p12 (double-click)
  - [ ] Trust certificate in Keychain
  - [ ] Run `./scripts/check_certificate.sh`
  - [ ] Success confirmed
  Time: 2 minutes per person

- [ ] **Clean Up**
  ```bash
  rm InhouseDevSigning.p12  # After distributing
  ```
  Time: 10 seconds

**Phase 3 Complete!** ✓

---

## ✅ Phase 4: CI/CD Automation (Optional, 20 minutes)

- [ ] **Read CI/CD Guide**
  ```bash
  open docs/github_actions_signing.md
  ```
  Time: 5 minutes

- [ ] **Export for GitHub Actions**
  ```bash
  security find-identity -v -p codesigning
  security export -t identities -f pkcs12 \
    -P "your-password" -o cert.p12 "Inhouse Dev Signing"
  base64 -i cert.p12 -o cert.txt
  ```
  Time: 2 minutes

- [ ] **Add GitHub Secrets**
  - [ ] Go to repo Settings → Secrets and variables → Actions
  - [ ] Add `MACOS_CERTIFICATE_BASE64` (contents of cert.txt)
  - [ ] Add `MACOS_CERTIFICATE_PASSWORD` (your password)
  - [ ] Add `KEYCHAIN_PASSWORD` (random 32-char password)
  Time: 3 minutes

- [ ] **Clean Up Local Files**
  ```bash
  rm cert.p12 cert.txt
  ```
  Time: 10 seconds

- [ ] **Test Workflow**
  - [ ] Go to GitHub Actions tab
  - [ ] Select "macOS Code Signing" workflow
  - [ ] Click "Run workflow"
  - [ ] Watch workflow complete
  - [ ] Download artifacts
  Time: 5-10 minutes (mostly waiting)

- [ ] **Verify Automated Signing**
  - [ ] Extract downloaded .app files
  - [ ] Run local verification:
    ```bash
    codesign --verify --deep --strict AdminPanel.app
    ```
  - [ ] Confirmed working
  Time: 2 minutes

**Phase 4 Complete!** ✓

---

## ✅ Phase 5: Production Readiness

- [ ] **Documentation Review**
  - [ ] Read through `docs/internal_mac_signing.md`
  - [ ] Bookmark `docs/SIGNING_REFERENCE.md` for quick lookup
  - [ ] Familiarize with troubleshooting section
  Time: 15 minutes

- [ ] **Workflow Integration**
  - [ ] Add signing to your build script
  - [ ] Update release checklist to include signing
  - [ ] Document signing process in team wiki
  Time: 10 minutes

- [ ] **Security Audit**
  - [ ] Verify .gitignore blocks .p12 files
    ```bash
    grep "*.p12" .gitignore
    ```
  - [ ] Confirm no secrets in git history
  - [ ] Verify GitHub Secrets are set correctly
  Time: 5 minutes

- [ ] **Team Training**
  - [ ] Share SIGNING_QUICK_START.md with team
  - [ ] Conduct signing workshop (optional)
  - [ ] Answer team questions
  Time: 30 minutes

- [ ] **Backup & Recovery**
  - [ ] Store .p12 in secure location (1Password, encrypted drive)
  - [ ] Document password in team password manager
  - [ ] Test recovery process (import on different Mac)
  Time: 10 minutes

**Phase 5 Complete!** ✓

---

## 🎯 Optional: Advanced Setup

### Upgrade to Apple Developer ID

- [ ] **Join Apple Developer Program**
  - [ ] Go to https://developer.apple.com/programs/
  - [ ] Complete enrollment ($99/year)
  - [ ] Wait for approval (1-2 days)

- [ ] **Get Developer ID Certificate**
  - [ ] Open Xcode
  - [ ] Preferences → Accounts → Manage Certificates
  - [ ] Click "+" → Developer ID Application
  - [ ] Download certificate

- [ ] **Update Scripts**
  - [ ] Edit `scripts/sign_all_apps.sh` line 33
  - [ ] Change to: `DEFAULT_IDENTITY="Developer ID Application: Your Company (TEAMID)"`
  - [ ] Save file

- [ ] **Update CI/CD**
  - [ ] Export new certificate
  - [ ] Update GitHub Secret `MACOS_CERTIFICATE_BASE64`
  - [ ] Update workflow identity name

- [ ] **Test & Deploy**
  - [ ] Sign locally: `./scripts/sign_all_apps.sh`
  - [ ] Verify: Apps work without right-click
  - [ ] Push tag to trigger CI/CD

**Developer ID Complete!** ✓

### Enable Notarization

- [ ] **Get App-Specific Password**
  - [ ] Go to appleid.apple.com
  - [ ] Sign in → Security → App-Specific Passwords
  - [ ] Generate new password
  - [ ] Copy password

- [ ] **Add GitHub Secrets**
  - [ ] `APPLE_ID` - Your Apple ID email
  - [ ] `APPLE_APP_SPECIFIC_PASSWORD` - Password from above
  - [ ] `APPLE_TEAM_ID` - Your Team ID

- [ ] **Enable Notarization**
  - [ ] Edit `.github/workflows/macos-signing.yml`
  - [ ] Line 165: Change `if: false` to `if: true`
  - [ ] Commit and push

- [ ] **Test Notarization**
  - [ ] Push version tag
  - [ ] Wait for workflow (10-15 minutes)
  - [ ] Download notarized apps
  - [ ] Verify: Work on any Mac without warnings

**Notarization Complete!** ✓

---

## 📊 Progress Tracker

**Quick Status:**
- Phase 1 (Setup): ☐ Not started | ◐ In progress | ✓ Complete
- Phase 2 (First Build): ☐ Not started | ◐ In progress | ✓ Complete
- Phase 3 (Team): ☐ Not started | ◐ In progress | ✓ Complete
- Phase 4 (CI/CD): ☐ Not started | ◐ In progress | ✓ Complete | ⊘ Skipped
- Phase 5 (Production): ☐ Not started | ◐ In progress | ✓ Complete

**Overall Completion:** ____%

---

## 🆘 Troubleshooting Quick Links

| Issue | Solution |
|-------|----------|
| Certificate not found | Run `./scripts/check_certificate.sh` for diagnosis |
| Signing fails | Check `docs/internal_mac_signing.md` → Troubleshooting |
| CI/CD errors | See `docs/github_actions_signing.md` → Troubleshooting |
| Gatekeeper blocks app | Right-click → Open (first time only) |
| Team can't import cert | Verify .p12 not corrupted, password correct |

**Full troubleshooting:** [docs/internal_mac_signing.md](docs/internal_mac_signing.md)

---

## 📝 Notes & Observations

Use this space to track issues, questions, or customizations:

```
Date: ___________
Notes:




```

---

## ✅ Final Checklist

Before marking complete, verify:

- [ ] All scripts are executable (`ls -l scripts/*.sh`)
- [ ] Certificate is trusted in Keychain
- [ ] Apps sign successfully
- [ ] Apps launch without errors
- [ ] Team members can import certificate
- [ ] CI/CD workflow runs (if enabled)
- [ ] Documentation is accessible
- [ ] .p12 is backed up securely
- [ ] No secrets in git

**Status:** ☐ Ready for Production

---

**Completion Date:** ___________  
**Completed By:** ___________  
**Next Review:** ___________ (recommended: quarterly)

---

🎊 **Congratulations! Your code signing infrastructure is production-ready!** 🎊

**Quick Reference:**
- Daily signing: `./scripts/sign_all_apps.sh`
- Verification: `./scripts/verify_apps.sh`
- Help: `./scripts/welcome.sh` or `docs/INDEX.md`
