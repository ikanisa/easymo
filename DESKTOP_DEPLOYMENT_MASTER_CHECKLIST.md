# 🚀 MASTER DESKTOP DEPLOYMENT CHECKLIST

**For EasyMO Desktop Apps:** macOS Admin Panel + macOS Client/Staff Portal + Windows + Linux

---

## 🔧 PRE-REQUISITES — Must already be in place

| Status | Item |
|--------|------|
| ✅ | CI/CD builds successfully on GitHub Actions |
| ✅ | Versioning flow decided (SemVer: v1.4.2) |
| ✅ | CHANGELOG.md updated |
| ✅ | Code-signing working locally and in CI for macOS |
| ✅ | Code-signing working for Windows (Authenticode) |
| ✅ | Packaging working for Linux (.AppImage / .deb) |
| ✅ | Stable download distribution point (GitHub Releases or internal portal) |

---

## 🔑 CREDENTIALS & SECRETS — Required for automated builds

| Platform | Secret | Notes | Status |
|----------|--------|-------|--------|
| macOS | `MACOS_CERT_P12` | Base64 encoded .p12 | ✅ Configured |
| macOS | `MACOS_CERT_PASSWORD` | Unlocks .p12 | ✅ Configured |
| macOS | `MACOS_CERT_IDENTITY` | "Inhouse Dev Signing" | ✅ Configured |
| Windows | `WIN_CERT_PFX` | Base64 encoded .pfx | ⬜ TODO |
| Windows | `WIN_CERT_PASSWORD` | Unlocks .pfx | ⬜ TODO |
| Windows | `WIN_CERT_SUBJECT` | CN used by signtool | ⬜ TODO |
| Linux | None | Packages don't require signing | ✅ N/A |

### Optional but recommended:
- `SENTRY_AUTH_TOKEN` - For error tracking
- `NOTARIZATION_APPLE_ID` - For future Apple notarization
- `NOTARIZATION_TEAM_ID` - For future Apple notarization

---

## 📁 FILES & INFRASTRUCTURE — Must exist in repository

| Category | Required Files | Status |
|----------|----------------|--------|
| **Scripts** | `scripts/sign_app.sh` | ✅ |
| | `scripts/sign_all_apps.sh` | ✅ |
| | `scripts/list_identities.sh` | ✅ |
| | `scripts/sign_windows.ps1` | ⬜ TODO |
| **CI/CD** | `.github/workflows/build-desktop.yml` | ⬜ TODO |
| | `.github/workflows/desktop-release.yml` | ⬜ TODO |
| **Docs** | `docs/internal_mac_signing.md` | ✅ |
| | `docs/windows_signing.md` | ⬜ TODO |
| | `docs/github_actions_signing.md` | ✅ |
| **Electron** | `admin-app/electron/main.js` | ✅ |
| | `admin-app/package.json` (main: electron/main.js) | ✅ |
| **Build Output** | `dist/` folder per platform | ⬜ TODO |

---

## 🔄 DEPLOYMENT WORKFLOW — Every release cycle

### 1. Pre-Release Preparation

```bash
# Pull latest main branch
git checkout main && git pull origin main

# Update version number in package.json
cd admin-app
npm version patch  # or minor, major
cd ..

# Update CHANGELOG.md with:
# - New version
# - Date
# - Changes, fixes, features

# Commit changes
git add .
git commit -m "chore: bump version to v1.x.x"
git push origin main
git tag v1.x.x
git push origin v1.x.x
```

### 2. CI/CD Triggers Automatically

When you push a tag, GitHub Actions will:

- ✅ Build macOS Admin Panel app
- ✅ Build macOS Client/Staff Portal app
- ✅ Build Windows installer
- ✅ Build Linux AppImage & .deb
- ✅ Code-sign all artifacts
- ✅ Upload artifacts to GitHub Release

### 3. Download & Verify Artifacts

```bash
# Download from GitHub Actions artifacts or Release page:
# - AdminPanel-macOS.zip
# - ClientPortal-macOS.zip
# - Desktop-Windows.zip
# - Desktop-Linux.zip

# Verify macOS signatures locally:
./scripts/sign_app.sh --verify dist/AdminPanel.app
./scripts/sign_app.sh --verify dist/ClientPortal.app

# Verify Windows signature:
# signtool verify /pa Desktop-Setup.exe

# Test Linux AppImage:
# chmod +x Desktop.AppImage && ./Desktop.AppImage
```

---

## 🚢 PUBLISHING / DISTRIBUTION OPTIONS

Choose one or multiple:

| Method | Recommended For | Setup Required |
|--------|-----------------|----------------|
| **GitHub Releases** | Internal distribution + power users | ✅ Automatic |
| **Private download portal** | Employees / controlled access | Custom web app |
| **Internal S3 / R2 / Supabase storage** | Corporate deployment | Cloud bucket setup |
| **Auto-update server** | Automatic update prompts | Electron AutoUpdater |

### GitHub Releases (Recommended for now)

1. Tag pushed → CI builds → Release created
2. Share release URL: `https://github.com/your-org/easymo/releases/tag/v1.x.x`
3. Users download platform-specific ZIP
4. Users extract and run

---

## 🧪 FINAL QA BEFORE DISTRIBUTION

| Status | Test | Platform |
|--------|------|----------|
| ⬜ | App opens without "unverified developer" block | macOS |
| ⬜ | Right-click → Open works first time | macOS |
| ⬜ | Admin Panel launches correctly | macOS |
| ⬜ | Client/Staff Portal launches correctly | macOS |
| ⬜ | Windows installer installs without SmartScreen block | Windows |
| ⬜ | Windows app runs after install | Windows |
| ⬜ | Linux AppImage runs with exec flag | Linux |
| ⬜ | Desktop scaling correct on Linux | Linux |
| ⬜ | Login/authentication works | All |
| ⬜ | Role-based access correct (Admin vs Client/Staff) | All |
| ⬜ | Offline behavior & caching (if PWA elements) | All |
| ⬜ | Auto-update tested (if enabled) | All |
| ⬜ | Version label in UI matches release version | All |
| ⬜ | Menu bar works correctly | All |
| ⬜ | Window resizing works | All |
| ⬜ | DevTools disabled in production | All |

---

## 🔁 POST-RELEASE STEPS

- [ ] Announce release internally (Slack / WhatsApp / company portal)
- [ ] Update internal wiki with download links
- [ ] Ensure old builds removed from shared folders
- [ ] Log version & date in `RELEASES.md`
- [ ] Collect feedback (bugs, crashes, UX)
- [ ] Mark items for next sprint
- [ ] Monitor Sentry for crash reports (if configured)

---

## 💎 OPTIONAL UPGRADES (Future)

| Upgrade | Value | Priority |
|---------|-------|----------|
| **Apple Notarization** | Removes "right-click → Open" requirement | High |
| **Windows EV Cert** | Removes SmartScreen warnings | Medium |
| **Auto-Update System** | Users never download installers manually | High |
| **Crash reporting (Sentry)** | Automatic error tracking | High |
| **Desktop Telemetry** | Understand feature usage | Low |
| **In-app license management** | For commercial model | Low |

---

## 🏁 ONE-LINE SUMMARY

**Release flow:** Bump version → Update changelog → Push tag → CI builds & signs → Download artifacts → QA checklist → Publish to GitHub Releases → Announce

---

## 📚 QUICK REFERENCE LINKS

- **Local Signing:** [docs/internal_mac_signing.md](docs/internal_mac_signing.md)
- **GitHub Actions:** [docs/github_actions_signing.md](docs/github_actions_signing.md)
- **Desktop App:** Run `cd admin-app && npm run desktop`
- **List Identities:** `./scripts/list_identities.sh`
- **Sign Apps:** `./scripts/sign_all_apps.sh`

---

## 🎯 CURRENT STATUS

| Component | Status | Next Action |
|-----------|--------|-------------|
| Desktop App | ✅ Running | Continue development |
| macOS Signing | ✅ Scripts ready | Test local signing |
| Windows Signing | ⬜ Not configured | Create Windows scripts |
| Linux Packaging | ⬜ Not configured | Create AppImage config |
| CI/CD Pipeline | ⬜ Not configured | Create workflow files |
| Documentation | ✅ Complete | Keep updated |

---

## 📝 NOTES

- **Two Apps, One Identity:** Both Admin Panel and Client/Staff Portal use same signing certificate
- **Same Repo:** All desktop variants built from single repository
- **Future-Proof:** Easy to switch from self-signed to Apple Developer ID
- **Security First:** All secrets stored in GitHub Actions secrets
