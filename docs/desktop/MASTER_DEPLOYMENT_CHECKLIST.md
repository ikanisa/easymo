# 🚀 MASTER DESKTOP DEPLOYMENT CHECKLIST

**For all desktop platforms: macOS + Windows + Linux**

Version: 1.0.0  
Last Updated: 2024-12-02  
Status: ✅ Ready for Implementation

---

## 🔧 PRE-REQUISITES — Must Already Be in Place

| Status | Item |
|--------|------|
| ✅ | CI/CD builds successfully on GitHub Actions |
| ✅ | Versioning flow decided (SemVer: v1.0.0) |
| ⬜ | CHANGELOG.md updated |
| ✅ | Code-signing scripts created for macOS |
| ⬜ | Code-signing working locally for macOS |
| ⬜ | Code-signing working in CI for macOS |
| ⬜ | Code-signing scripts created for Windows |
| ⬜ | Packaging working for Linux (.AppImage / .deb) |
| ⬜ | Download distribution point (GitHub Releases) |

---

## 🔑 CREDENTIALS & SECRETS — Required for Automated Builds

| Platform | Secret | Status | Notes |
|----------|--------|--------|-------|
| macOS | `MACOS_CERT_P12` | ✅ Set | Base64 encoded .p12 |
| macOS | `MACOS_CERT_PASSWORD` | ✅ Set | Unlocks .p12 |
| macOS | `MACOS_CERT_IDENTITY` | ✅ Set | "Inhouse Dev Signing" |
| Windows | `WIN_CERT_PFX` | ⬜ Pending | Base64 encoded .pfx |
| Windows | `WIN_CERT_PASSWORD` | ⬜ Pending | Unlocks .pfx |
| Windows | `WIN_CERT_SUBJECT` | ⬜ Pending | CN used by signtool |
| Linux | N/A | ✅ | No signing required |

### Optional (Future):
- `SENTRY_AUTH_TOKEN` - Error tracking
- `NOTARIZATION_APPLE_ID` - Apple notarization
- `NOTARIZATION_TEAM_ID` - Apple notarization

---

## 📁 FILES & INFRASTRUCTURE — Must Exist in Repository

| Category | Required Files | Status |
|----------|---------------|--------|
| macOS Signing Scripts | `scripts/sign_app.sh` | ✅ |
| macOS Signing Scripts | `scripts/sign_all_apps.sh` | ✅ |
| macOS Signing Scripts | `scripts/list_identities.sh` | ✅ |
| Windows Signing | `scripts/sign_windows.ps1` | ⬜ |
| CI/CD | `.github/workflows/desktop-build.yml` | ✅ |
| CI/CD | `.github/workflows/desktop-release.yml` | ✅ |
| Documentation | `docs/desktop/internal_mac_signing.md` | ✅ |
| Documentation | `docs/desktop/windows_signing.md` | ⬜ |
| Desktop App | `admin-app/electron/main.js` | ✅ |
| Desktop Scripts | `admin-app/start-desktop.sh` | ✅ |
| Build Outputs | `admin-app/dist/` | Auto-generated |

---

## 🔄 DEPLOYMENT WORKFLOW — Every Release Cycle

### 1️⃣ Pre-Release

- [ ] Pull latest `main` branch
- [ ] Update version number in `admin-app/package.json`
- [ ] Update version in About dialog (if applicable)
- [ ] Update `CHANGELOG.md` with release notes
- [ ] Commit version bump:
  ```bash
  git add admin-app/package.json CHANGELOG.md
  git commit -m "chore: bump version to v1.0.0"
  git push origin main
  ```

### 2️⃣ Automated Build (CI/CD)

CI/CD pipeline automatically triggers:

- [ ] **macOS builds:**
  - Admin Panel app
  - Client/Staff Portal app (future)
  - Code-signed with `Inhouse Dev Signing`
  
- [ ] **Windows installer:**
  - MSI or NSIS installer
  - Code-signed with Windows certificate
  
- [ ] **Linux packages:**
  - AppImage (universal)
  - .deb package (Debian/Ubuntu)

- [ ] All artifacts uploaded to GitHub Actions run summary

### 3️⃣ Download & Verify

Wait for CI completion, then:

```bash
# Download artifacts from GitHub Actions
# Verify signatures locally

# macOS
codesign --verify --deep --strict AdminPanel.app
spctl --assess --verbose=4 AdminPanel.app

# Windows
signtool verify /pa AdminPanel.msi

# Linux
chmod +x AdminPanel.AppImage
./AdminPanel.AppImage --help
```

---

## 🚢 PUBLISHING / DISTRIBUTION OPTIONS

Choose one or multiple methods:

| Method | Recommended For | Setup Required |
|--------|----------------|----------------|
| **GitHub Releases** | Internal distribution + power users | Tag + upload artifacts |
| **Private download portal** | Employees / controlled access | Web server + auth |
| **Internal S3 / R2 / Supabase** | Corporate deployment | Cloud storage setup |
| **Auto-update server** (future) | Automatic update prompts | Update server deployment |

### GitHub Releases (Recommended)

```bash
# Create release tag
git tag v1.0.0
git push origin v1.0.0

# Upload artifacts via GitHub UI or gh CLI
gh release create v1.0.0 \
  AdminPanel-macOS.zip \
  ClientPortal-macOS.zip \
  AdminPanel-Windows.zip \
  AdminPanel-Linux.AppImage \
  AdminPanel-Linux.deb \
  --title "EasyMO Desktop v1.0.0" \
  --notes "See CHANGELOG.md for details"
```

---

## 🧪 FINAL QA BEFORE DISTRIBUTION

| Status | Test | Platform |
|--------|------|----------|
| ⬜ | App opens without "unverified developer" block (right-click Open acceptable) | macOS |
| ⬜ | All menu items work correctly | macOS |
| ⬜ | Window resizing, minimizing, maximizing work | All |
| ⬜ | Login/authentication works | All |
| ⬜ | Dashboard loads and displays data | All |
| ⬜ | Navigation between pages works | All |
| ⬜ | API calls to Supabase backend succeed | All |
| ⬜ | Role-based access control (Admin vs Client/Staff) | All |
| ⬜ | Offline behavior (graceful errors) | All |
| ⬜ | Version label in UI matches release version | All |
| ⬜ | DevTools disabled in production build | All |
| ⬜ | No console errors on startup | All |
| ⬜ | Windows installer installs without SmartScreen block | Windows |
| ⬜ | Linux AppImage runs with exec flag | Linux |
| ⬜ | Auto-update tested (if enabled) | All |

---

## 🔁 POST-RELEASE STEPS

- [ ] Announce release internally (Slack / WhatsApp / company portal)
- [ ] Update internal documentation with download links
- [ ] Remove old builds from shared folders (keep last 2 versions)
- [ ] Log version & date in `RELEASES.md`:
  ```markdown
  ## v1.0.0 - 2024-12-02
  - Initial desktop release
  - Admin Panel for macOS, Windows, Linux
  - Code-signed for internal distribution
  ```
- [ ] Collect feedback (bugs, crashes, UX issues)
- [ ] Create issues for next sprint
- [ ] Monitor error tracking (Sentry, if configured)

---

## 💎 OPTIONAL UPGRADES (Future)

| Upgrade | Value | Estimated Effort |
|---------|-------|------------------|
| **Apple Notarization** | Eliminates "right-click → Open" requirement | Medium (requires Apple Developer account) |
| **Windows EV Certificate** | Removes SmartScreen warnings | Medium ($300-500/year) |
| **Auto-Update System** | Users never download installers manually | High (backend + client integration) |
| **Crash Reporting (Sentry)** | Automatic error tracking | Low (already configured for web) |
| **Desktop Telemetry** | Understand feature usage | Medium (analytics integration) |
| **License Management** | For commercial model | High (license server) |
| **Multi-language Support** | International users | Medium (i18n setup) |

---

## 🏁 ONE-LINE VERSION (Quick Reference)

```
Release = bump version → update changelog → push → CI builds & signs → 
download artifacts → QA checklist → publish to GitHub Releases → 
announce internally → collect feedback
```

---

## 📋 CURRENT STATUS

### ✅ Completed
- macOS signing scripts created
- GitHub secrets configured for macOS
- Electron app enhanced with security features
- Desktop startup script created
- Internal signing documentation

### ⏳ In Progress
- Local desktop app testing

### 🔜 Next Steps
1. Test desktop app locally
2. Create Windows signing scripts
3. Set up Linux packaging
4. Configure CI/CD for all platforms
5. Test full release workflow

---

## 🆘 TROUBLESHOOTING

### macOS: "App is damaged and can't be opened"
**Cause:** Gatekeeper blocking app  
**Solution:** Right-click → Open → Open

### Windows: "Windows protected your PC"
**Cause:** SmartScreen blocking unsigned app  
**Solution:** Click "More info" → "Run anyway"

### Linux: Permission denied
**Cause:** AppImage not executable  
**Solution:** `chmod +x AdminPanel.AppImage`

### CI Build fails
**Cause:** Missing secrets or dependencies  
**Solution:** Check GitHub Actions logs, verify secrets are set

---

## 📞 SUPPORT

- **macOS Signing:** See `docs/desktop/internal_mac_signing.md`
- **Windows Signing:** See `docs/desktop/windows_signing.md` (to be created)
- **CI/CD Issues:** Check `.github/workflows/desktop-build.yml`
- **App Issues:** Check `admin-app/electron/main.js` and logs

---

**Maintained by:** DevOps Team  
**Next Review:** After first successful release
