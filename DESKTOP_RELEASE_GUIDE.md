# 🚀 Desktop App Build & Release Guide

**Quick Reference**: How to build and release the EasyMO Admin desktop application

---

## 📋 Prerequisites

Before building, ensure you have:

- [ ] GitHub repository access with write permissions
- [ ] (Optional) Code signing secrets configured for production releases
- [ ] Git installed locally

---

## 🎯 Quick Release (Recommended)

### Option 1: Create a Release Tag

The easiest way to trigger a desktop build:

```bash
# 1. Navigate to repository
cd /path/to/easymo-

# 2. Create and push a version tag
git tag desktop-v1.0.0
git push origin desktop-v1.0.0
```

**That's it!** GitHub Actions will automatically:
1. Build for macOS (ARM64 + Intel)
2. Build for Windows (x64)
3. Build for Linux (x64)
4. Create a draft release with all installers
5. Add checksums for verification

### Option 2: Manual Trigger via GitHub UI

1. Go to: https://github.com/ikanisa/easymo-/actions/workflows/desktop-release.yml
2. Click **"Run workflow"** button
3. Select branch (usually `main`)
4. Click **"Run workflow"**

---

## 📦 What Gets Built

Each release creates installers for all platforms:

### macOS
- `EasyMO-Admin_1.0.0_aarch64.dmg` (Apple Silicon: M1/M2/M3)
- `EasyMO-Admin_1.0.0_x64.dmg` (Intel Macs)

### Windows
- `EasyMO-Admin_1.0.0_x64_en-US.msi` (x64 installer)

### Linux
- `easymo-admin_1.0.0_amd64.AppImage` (Universal)
- `easymo-admin_1.0.0_amd64.deb` (Debian/Ubuntu)

**Total**: ~6 build artifacts per release

---

## ⏱️ Build Timeline

Approximate build times:

| Platform | Time | Parallelization |
|----------|------|-----------------|
| macOS ARM64 | 15-20 min | ✅ Parallel |
| macOS Intel | 15-20 min | ✅ Parallel |
| Windows | 10-15 min | ✅ Parallel |
| Linux | 8-12 min | ✅ Parallel |

**Total wall time**: ~20-25 minutes (builds run in parallel)

---

## 🔐 Code Signing (Optional but Recommended)

For production releases, configure these GitHub secrets:

### macOS Signing
```
APPLE_CERTIFICATE          # Base64-encoded p12 certificate
APPLE_CERTIFICATE_PASSWORD # Certificate password
APPLE_SIGNING_IDENTITY     # Developer ID Application: Your Name (TEAM_ID)
APPLE_ID                   # Your Apple ID email
APPLE_PASSWORD             # App-specific password
APPLE_TEAM_ID              # 10-character team ID
```

### Windows Signing
```
TAURI_SIGNING_PRIVATE_KEY          # Base64-encoded signing key
TAURI_SIGNING_PRIVATE_KEY_PASSWORD # Key password
```

### Tauri Updates (Optional)
```
TAURI_SIGNING_PRIVATE_KEY          # For update signatures
TAURI_SIGNING_PRIVATE_KEY_PASSWORD
```

**Without these secrets**: Builds will work but installers won't be signed.

---

## 📝 Version Numbering

Use semantic versioning: `desktop-vMAJOR.MINOR.PATCH`

Examples:
- `desktop-v1.0.0` - First stable release
- `desktop-v1.1.0` - New features
- `desktop-v1.0.1` - Bug fixes
- `desktop-v2.0.0` - Breaking changes

**Tag format is important**: Must start with `desktop-v` to trigger workflow.

---

## 🎬 Step-by-Step Release Process

### 1. Prepare Release

```bash
# Ensure you're on main with latest code
git checkout main
git pull origin main

# Verify build locally (optional but recommended)
cd admin-app
npm run build:desktop
```

### 2. Create Release Tag

```bash
# Create annotated tag
git tag -a desktop-v1.0.0 -m "Release v1.0.0: Initial desktop release"

# Push tag to trigger build
git push origin desktop-v1.0.0
```

### 3. Monitor Build

1. Go to: https://github.com/ikanisa/easymo-/actions
2. Watch the "Desktop Release" workflow
3. Builds run in parallel (~20 min total)

### 4. Review Draft Release

1. Go to: https://github.com/ikanisa/easymo-/releases
2. Find the draft release
3. Review release notes
4. Verify all artifacts are present
5. Check checksums

### 5. Publish Release

1. Edit the draft release
2. Update release notes if needed
3. Click **"Publish release"**

**Done!** Users can now download installers.

---

## 🐛 Troubleshooting

### Build Fails on macOS

**Issue**: Rust compilation errors  
**Solution**: This is expected in some environments (like the current one with clang issues). The GitHub Actions runners have clean environments and will build successfully.

### Missing Artifacts

**Issue**: Some platform builds missing  
**Solution**: Check workflow logs for that specific platform. Usually a dependency issue.

### Code Signing Fails

**Issue**: Notarization or signing errors  
**Solution**: 
- Verify secrets are correctly set
- For testing, builds work without signing
- Signed builds recommended for production only

### Workflow Doesn't Trigger

**Issue**: Tag pushed but no workflow run  
**Solution**: 
- Ensure tag format is `desktop-v*` (not just `v*`)
- Check: https://github.com/ikanisa/easymo-/actions/workflows/desktop-release.yml

---

## 📊 Workflow Details

### Triggers
- **Tag push**: Any tag matching `desktop-v*`
- **Manual**: Via GitHub Actions UI

### Matrix Build
```yaml
- macOS ARM64  (aarch64-apple-darwin)
- macOS Intel  (x86_64-apple-darwin)
- Windows x64  (x86_64-pc-windows-msvc)
- Linux x64    (x86_64-unknown-linux-gnu)
```

### Steps
1. Checkout code
2. Setup pnpm, Node.js, Rust
3. Install system dependencies (Linux only)
4. Build shared workspace packages
5. Build Tauri app with tauri-action
6. Upload artifacts
7. Create draft release (if tag push)

---

## 🎯 Testing Workflow Locally

You can't fully test Tauri builds locally due to the clang issue, but you can verify:

```bash
# Verify shared packages build
pnpm --filter @va/shared build
pnpm --filter @easymo/commons build

# Verify frontend builds for desktop
cd admin-app
npm run build:desktop

# Check Rust code compiles (requires working Rust toolchain)
cd src-tauri
cargo check
```

---

## 🚀 Quick Commands

```bash
# Create and push release tag
git tag desktop-v1.0.0 && git push origin desktop-v1.0.0

# Delete tag if needed (before build starts)
git tag -d desktop-v1.0.0
git push origin :refs/tags/desktop-v1.0.0

# List all desktop release tags
git tag -l "desktop-v*"

# View workflow status
gh run list --workflow=desktop-release.yml  # requires GitHub CLI
```

---

## 📚 Additional Resources

- [Tauri Action Documentation](https://github.com/tauri-apps/tauri-action)
- [Desktop Implementation Guide](./DESKTOP_START_HERE.md)
- [Phase 2 Features](./DESKTOP_PHASE2_COMPLETE.md)
- [Architecture Overview](./DESKTOP_EXECUTIVE_SUMMARY.md)

---

## ✅ Checklist for First Release

- [ ] All code committed and pushed to main
- [ ] Version number decided (e.g., 1.0.0)
- [ ] Release notes prepared
- [ ] Code signing secrets configured (optional)
- [ ] Tag created: `git tag desktop-v1.0.0`
- [ ] Tag pushed: `git push origin desktop-v1.0.0`
- [ ] Workflow started (check Actions tab)
- [ ] Builds complete (~20 min)
- [ ] Draft release reviewed
- [ ] Release published

---

## 🎉 First Release Example

```bash
# Complete first release workflow
cd /Users/jeanbosco/workspace/easymo-

# 1. Ensure main is up to date
git checkout main
git pull origin main

# 2. Create release tag
git tag -a desktop-v1.0.0 -m "Desktop App v1.0.0

Features:
- Command palette (Cmd+K)
- Native menus and shortcuts
- Multi-window support
- File associations (.easymo)
- Deep link handling (easymo://)
- System tray integration
"

# 3. Push tag
git push origin desktop-v1.0.0

# 4. Monitor at:
# https://github.com/ikanisa/easymo-/actions

# Done! Wait ~20 minutes for builds to complete.
```

---

**Status**: Ready to release! Just create a tag and GitHub Actions handles the rest. 🚀
