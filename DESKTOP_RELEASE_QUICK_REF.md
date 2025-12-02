# 🚀 DESKTOP RELEASE - QUICK REFERENCE

**EasyMO Desktop Apps - One-Page Cheat Sheet**

---

## ⚡ FASTEST PATH TO RELEASE

```bash
# 1. Prep (5 min)
git checkout main && git pull
pnpm version 1.4.2 --no-git-tag-version
# Update CHANGELOG.md manually

# 2. Release (1 min)
git add . && git commit -m "chore: release v1.4.2"
git tag -a v1.4.2 -m "Release v1.4.2"
git push origin main --tags

# 3. Wait for CI (10-15 min)
# → GitHub Actions builds & signs all platforms

# 4. Download (2 min)
# → GitHub → Actions → Download artifacts

# 5. QA (10 min)
./scripts/verify_apps.sh  # macOS
# Test Windows + Linux

# 6. Publish (5 min)
# → GitHub Releases → Upload .dmg/.exe/.AppImage

# 7. Announce (2 min)
# → Slack: "v1.4.2 is live!"
```

**Total time:** ~35 minutes

---

## 🎯 CRITICAL CHECKLIST

**Before pushing tag:**
- ☐ Version numbers updated (package.json)
- ☐ CHANGELOG.md updated
- ☐ Tests passing locally

**After CI completes:**
- ☐ All platforms built ✓
- ☐ Signatures valid ✓
- ☐ Apps launch without crash ✓

**Before announcing:**
- ☐ QA checklist 100% complete
- ☐ GitHub Release published
- ☐ Download links tested

---

## 🔑 REQUIRED SECRETS (One-Time Setup)

**GitHub Settings → Secrets:**

**macOS (Already Set ✅):**
- `MACOS_CERTIFICATE_BASE64`
- `MACOS_CERTIFICATE_PASSWORD`
- `KEYCHAIN_PASSWORD`

**Windows (TODO):**
- `WIN_CERTIFICATE_BASE64`
- `WIN_CERTIFICATE_PASSWORD`
- `WIN_CERT_SUBJECT_NAME`

---

## 📦 ARTIFACTS TO DOWNLOAD

**macOS:**
- `admin-panel-signed.zip`
- `client-portal-signed.zip`
- `dmg-installers.zip`

**Windows:**
- `windows-installers.zip`

**Linux:**
- `linux-packages.zip`

---

## ✅ QA MUST-PASS

| Test | Command/Action |
|------|----------------|
| **macOS signature** | `./scripts/verify_apps.sh` |
| **macOS launches** | `open AdminPanel.app` |
| **Windows signature** | `signtool verify /pa App.exe` |
| **Windows launches** | Run from Start Menu |
| **Linux runs** | `chmod +x *.AppImage && ./App.AppImage` |
| **Version correct** | Check About dialog |
| **Login works** | Test authentication |

---

## 🚢 PUBLISH OPTIONS

**Option 1: GitHub Releases (Recommended)**
- Go to Releases → Draft new release
- Tag: v1.4.2
- Upload all artifacts
- Publish

**Option 2: Download Portal**
- Upload to Supabase Storage / S3
- Update portal with new version
- Test download links

**Option 3: Network Share**
- `cp -r artifacts/ /SharedDrive/EasyMO/v1.4.2/`
- Notify team

---

## 📢 ANNOUNCEMENT TEMPLATE

```
🎉 EasyMO Desktop v1.4.2 is live!

✨ New: [Feature X]
🐛 Fixed: [Bug Y]

📥 Download:
• macOS: [link]
• Windows: [link]
• Linux: [link]

📖 Changelog: [link]
```

---

## 🛠️ QUICK FIXES

**"App is damaged" (macOS):**
```bash
xattr -cr AdminPanel.app
```

**SmartScreen block (Windows):**
- Click "More info" → "Run anyway"

**CI build failed:**
```bash
# Check logs, fix issue, then:
git tag -d v1.4.2
git push origin :refs/tags/v1.4.2
# Fix, then re-tag
```

---

## 📞 HELP

**Build issues:** #devops Slack  
**Signing issues:** security@easymo.com  
**User bugs:** #support Slack  

**Full docs:** `docs/DEPLOYMENT_CHECKLIST.md`

---

**Version:** 1.0.0  
**Updated:** 2025-12-02
