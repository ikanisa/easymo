# macOS Code Signing - GitHub Actions Setup

This guide explains how to set up automated code signing in GitHub Actions CI/CD.

## Quick Setup (5 minutes)

### 1. Export Certificate for CI

On your Mac with the signing certificate:

```bash
# Export certificate as base64
security find-identity -v -p codesigning
security export -t identities \
  -f pkcs12 \
  -P "your-strong-password" \
  -o InhouseDevSigning.p12 \
  "Inhouse Dev Signing"

# Convert to base64
base64 -i InhouseDevSigning.p12 -o certificate.txt

# Copy the contents of certificate.txt
cat certificate.txt
```

### 2. Add Secrets to GitHub

Go to your repository: **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add these three secrets:

| Secret Name | Value |
|-------------|-------|
| `MACOS_CERTIFICATE_BASE64` | Contents of `certificate.txt` |
| `MACOS_CERTIFICATE_PASSWORD` | Password you used when exporting |
| `KEYCHAIN_PASSWORD` | Any random 32-character password |

**Security:** Delete `InhouseDevSigning.p12` and `certificate.txt` after adding secrets!

```bash
rm InhouseDevSigning.p12 certificate.txt
```

### 3. Enable Workflow

The workflow file is already in `.github/workflows/macos-signing.yml`.

It will automatically run when:
- ✅ You push a version tag (e.g., `v1.0.0`)
- ✅ You manually trigger it (Actions tab → macOS Code Signing → Run workflow)
- ✅ You modify signing scripts in a PR (validation only)

---

## Manual Trigger

1. Go to **Actions** tab in GitHub
2. Select **macOS Code Signing** workflow
3. Click **Run workflow**
4. Check **sign_apps** checkbox
5. Click **Run workflow** button

The workflow will:
- ✅ Build both apps (Admin Panel + Client Portal)
- ✅ Sign them with your certificate
- ✅ Verify signatures
- ✅ Upload signed apps as artifacts
- ✅ Create DMG installers

---

## Download Signed Apps

After workflow completes:

1. Go to workflow run
2. Scroll to **Artifacts** section
3. Download:
   - `admin-panel-signed` (signed .app)
   - `client-portal-signed` (signed .app)
   - `dmg-installers` (ready-to-distribute DMG files)

---

## Workflow Jobs

### Job 1: validate-scripts
Runs on every PR that touches signing scripts:
- Checks script permissions
- Validates bash syntax
- Runs test suite

### Job 2: sign-apps
Runs on tags or manual trigger:
- Imports signing certificate
- Builds both apps
- Signs with `scripts/sign_all_apps.sh`
- Verifies signatures
- Creates DMG files
- Uploads artifacts

### Job 3: notarize (Optional)
**Disabled by default.** Enable when you have Apple Developer ID:
- Submits apps to Apple for notarization
- Staples notarization ticket to DMG

---

## Upgrading to Apple Developer ID

When you get an Apple Developer ID certificate:

### 1. Export Developer ID Certificate

```bash
# In Xcode: Preferences → Accounts → Manage Certificates
# Download "Developer ID Application" certificate

# Export it
security find-identity -v -p codesigning
security export -t identities \
  -f pkcs12 \
  -P "your-password" \
  -o DeveloperID.p12 \
  "Developer ID Application: Your Company (TEAMID)"

# Convert to base64
base64 -i DeveloperID.p12 -o certificate.txt
```

### 2. Update GitHub Secrets

Update `MACOS_CERTIFICATE_BASE64` with the new certificate.

### 3. Update Workflow

In `.github/workflows/macos-signing.yml`, change line 89:

```yaml
- name: Check certificate
  run: ./scripts/check_certificate.sh "Developer ID Application: Your Company (TEAMID)"
```

And line 93:
```yaml
env:
  SIGNING_IDENTITY: "Developer ID Application: Your Company (TEAMID)"
```

### 4. Enable Notarization

In `.github/workflows/macos-signing.yml`, change line 165:

```yaml
if: false  # Change to: if: true
```

Add new secrets:
- `APPLE_ID` - Your Apple ID email
- `APPLE_APP_SPECIFIC_PASSWORD` - Generate at appleid.apple.com
- `APPLE_TEAM_ID` - Your Apple Developer Team ID

---

## Local Testing

Test the workflow locally before pushing:

```bash
# Test script validation
./scripts/test_signing_workflow.sh

# Test signing (with real apps)
./scripts/sign_all_apps.sh

# Verify signatures
./scripts/verify_apps.sh
```

---

## Troubleshooting

### "No identity found" in CI

**Problem:** Certificate wasn't imported correctly.

**Solution:**
1. Verify secrets are set correctly
2. Check certificate password matches
3. Ensure base64 encoding is clean (no line breaks)

### "App bundle not found"

**Problem:** Build step didn't create the app at expected path.

**Solution:**
1. Update app paths in workflow (lines 78, 84)
2. Match paths in `scripts/sign_all_apps.sh`

### "Signature verification failed"

**Problem:** Certificate is invalid or expired.

**Solution:**
1. Check certificate validity: `security find-identity -v`
2. Re-export certificate
3. Update GitHub secret

### Workflow doesn't trigger

**Problem:** Push didn't match trigger conditions.

**Solution:**
- Use `git push --tags` for tag triggers
- Use workflow_dispatch for manual runs
- Check `paths:` filters match your changes

---

## Advanced: Release Automation

Combine with release workflow:

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build-and-sign:
    uses: ./.github/workflows/macos-signing.yml
    secrets: inherit
  
  create-release:
    needs: build-and-sign
    runs-on: ubuntu-latest
    steps:
      - name: Download artifacts
        uses: actions/download-artifact@v4
      
      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          files: |
            dmg-installers/*.dmg
          draft: false
          prerelease: false
```

Now every version tag automatically:
1. Builds apps
2. Signs them
3. Creates DMG files
4. Publishes GitHub Release with installers

---

## Security Best Practices

✅ **DO:**
- Store certificates in GitHub Secrets (encrypted)
- Use app-specific passwords for Apple ID
- Rotate certificates every 2-3 years
- Delete local .p12 files after uploading to GitHub
- Limit repository access to trusted team members

❌ **DON'T:**
- Commit .p12 files to git
- Share certificate passwords in Slack/email
- Use production certificates in public repos
- Reuse passwords across services

---

## Summary

✅ **Automated signing on every release**  
✅ **Secure certificate storage in GitHub Secrets**  
✅ **DMG creation for easy distribution**  
✅ **Notarization ready for Apple Developer ID**  
✅ **Full validation in PRs**  

Your CI/CD pipeline now handles code signing automatically! 🚀
