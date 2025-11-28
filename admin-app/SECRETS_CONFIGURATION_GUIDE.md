# 🔐 Secrets & Certificates Configuration Guide

**Status:** ⚠️ PLACEHOLDERS - Fill after certificate procurement  
**Required Before:** Production release  
**Estimated Time:** 1-2 hours (after certificates received)

---

## Overview

This guide provides placeholder values and step-by-step instructions for configuring all required secrets after certificates are obtained.

---

## 📋 Required Secrets (9 total)

### Tauri Signing (Auto-Updates) - ✅ READY

| Secret Name | Status | Value |
|------------|--------|-------|
| `TAURI_SIGNING_PRIVATE_KEY` | ✅ Generated | From `~/.tauri/easymo-admin.key` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | ✅ Generated | Current: `easymo-admin-2025` |

**Action:** Run `admin-app/scripts/setup-tauri-secrets.sh` to configure

---

### Windows Code Signing - ⏳ PENDING

| Secret Name | Status | Placeholder Value |
|------------|--------|-------------------|
| `WINDOWS_CERTIFICATE` | ⏳ Waiting | `WINDOWS_CERT_BASE64_PLACEHOLDER` |
| `WINDOWS_CERT_PASSWORD` | ⏳ Waiting | `YOUR_CERT_PASSWORD_HERE` |

**Status:** Waiting for DigiCert/Sectigo certificate delivery

**When Certificate Arrives:**

```bash
# Convert PFX to base64
base64 -i certificate.pfx -o certificate.b64

# Set GitHub secret
gh secret set WINDOWS_CERTIFICATE < certificate.b64

# Set password
gh secret set WINDOWS_CERT_PASSWORD
# Enter password when prompted
```

**If Using EV Token (Hardware):**
- Cannot use directly in CI/CD
- Options:
  1. Use GitHub self-hosted runner with token attached
  2. Use cloud HSM (Azure Key Vault)
  3. For testing: Use standard OV certificate instead

---

### Apple Code Signing & Notarization - ⏳ PENDING

| Secret Name | Status | Placeholder Value |
|------------|--------|-------------------|
| `APPLE_CERTIFICATE` | ⏳ Waiting | `APPLE_CERT_BASE64_PLACEHOLDER` |
| `APPLE_CERT_PASSWORD` | ⏳ Waiting | `YOUR_P12_PASSWORD_HERE` |
| `APPLE_ID` | ⏳ Waiting | `your-apple-dev-email@example.com` |
| `APPLE_TEAM_ID` | ⏳ Waiting | `YOUR_TEAM_ID_HERE` |
| `APPLE_APP_PASSWORD` | ⏳ Waiting | `xxxx-xxxx-xxxx-xxxx` |

**Status:** Waiting for Apple Developer enrollment

**When Certificate is Ready:**

```bash
# Export certificate from Keychain (on macOS)
# 1. Open Keychain Access
# 2. Find "Developer ID Application: EasyMO Platform"
# 3. Right-click → Export
# 4. Save as apple-certificate.p12
# 5. Enter password

# Convert to base64
base64 -i apple-certificate.p12 -o apple-certificate.b64

# Set GitHub secrets
gh secret set APPLE_CERTIFICATE < apple-certificate.b64

gh secret set APPLE_CERT_PASSWORD
# Enter the P12 password

gh secret set APPLE_ID
# Enter your Apple Developer email

gh secret set APPLE_TEAM_ID
# Find at https://developer.apple.com/account
# Format: ABC123XYZ

gh secret set APPLE_APP_PASSWORD
# Generate at https://appleid.apple.com/account/manage
# App-Specific Passwords → Generate
# Format: xxxx-xxxx-xxxx-xxxx
```

---

### Update Server (CDN) - ⏳ PENDING

| Secret Name | Status | Placeholder Value |
|------------|--------|-------------------|
| `CLOUDFLARE_R2_TOKEN` | ⏳ Waiting | `CLOUDFLARE_TOKEN_PLACEHOLDER` |
| `CLOUDFLARE_ACCOUNT_ID` | ⏳ Waiting | `CLOUDFLARE_ACCOUNT_PLACEHOLDER` |

**Alternative (AWS S3):**
| Secret Name | Placeholder Value |
|------------|-------------------|
| `AWS_ACCESS_KEY_ID` | `AWS_KEY_PLACEHOLDER` |
| `AWS_SECRET_ACCESS_KEY` | `AWS_SECRET_PLACEHOLDER` |
| `AWS_REGION` | `us-east-1` |

**When Update Server is Ready:**

**Option A: Cloudflare R2** (Recommended)
```bash
# Get API token
# 1. Cloudflare Dashboard → API Tokens
# 2. Create Token → Edit Cloudflare Workers
# 3. Permissions: Account.Cloudflare R2 Storage - Edit
# 4. Copy token

gh secret set CLOUDFLARE_R2_TOKEN
# Paste token

gh secret set CLOUDFLARE_ACCOUNT_ID
# Find in Cloudflare Dashboard → Workers & Pages → Account ID
```

**Option B: AWS S3**
```bash
# Create IAM user with S3 permissions
aws iam create-user --user-name easymo-releases
aws iam attach-user-policy --user-name easymo-releases --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess
aws iam create-access-key --user-name easymo-releases

# Copy access key ID and secret access key

gh secret set AWS_ACCESS_KEY_ID
gh secret set AWS_SECRET_ACCESS_KEY
gh secret set AWS_REGION
```

---

## 🧪 Testing Secrets Configuration

### Verify All Secrets Set

```bash
# List secrets (shows names only, not values)
gh secret list

# Expected output:
# TAURI_SIGNING_PRIVATE_KEY                    Updated 2025-11-28
# TAURI_SIGNING_PRIVATE_KEY_PASSWORD           Updated 2025-11-28
# WINDOWS_CERTIFICATE                           Updated 2025-12-XX
# WINDOWS_CERT_PASSWORD                         Updated 2025-12-XX
# APPLE_CERTIFICATE                             Updated 2025-12-XX
# APPLE_CERT_PASSWORD                           Updated 2025-12-XX
# APPLE_ID                                      Updated 2025-12-XX
# APPLE_TEAM_ID                                 Updated 2025-12-XX
# APPLE_APP_PASSWORD                            Updated 2025-12-XX
# CLOUDFLARE_R2_TOKEN                           Updated 2025-12-XX
# CLOUDFLARE_ACCOUNT_ID                         Updated 2025-12-XX
```

### Test Workflow with Secrets

```bash
# Trigger test build
git tag desktop-v1.0.0-test
git push origin desktop-v1.0.0-test

# Watch workflow
gh run watch

# Check for errors
gh run view --log
```

---

## 📝 Configuration Checklist

### Before Production Release

- [ ] **Tauri Signing**
  - [ ] Private key exists at `~/.tauri/easymo-admin.key`
  - [ ] Public key in `src-tauri/tauri.conf.json`
  - [ ] GitHub secrets configured
  - [ ] Password changed from default

- [ ] **Windows Signing**
  - [ ] Certificate purchased
  - [ ] Certificate received (PFX or token)
  - [ ] Tested signing locally
  - [ ] GitHub secrets configured
  - [ ] Timestamp server configured

- [ ] **macOS Signing**
  - [ ] Apple Developer account active
  - [ ] Developer ID certificate created
  - [ ] Certificate exported and tested
  - [ ] Notarization credentials configured
  - [ ] GitHub secrets configured
  - [ ] Signing identity in `tauri.conf.json`

- [ ] **Update Server**
  - [ ] Domain configured (`releases.easymo.dev`)
  - [ ] CDN setup (R2 or S3)
  - [ ] GitHub secrets configured
  - [ ] Test upload successful
  - [ ] Manifest accessible

---

## 🚨 Security Best Practices

### Secret Management

1. **Never commit secrets to git**
   - Check `.gitignore` includes certificate files
   - Never paste secrets in code comments
   - Never log secret values

2. **Rotate secrets regularly**
   - Change passwords every 90 days
   - Regenerate API tokens annually
   - Update certificates before expiry

3. **Limit access**
   - Only admins should set secrets
   - Use GitHub organization secrets for shared values
   - Audit secret access regularly

4. **Backup critical secrets**
   - Store certificate files securely offline
   - Document recovery procedures
   - Have backup signing keys

### Certificate Security

1. **Private keys**
   - Store in secure location (password manager, vault)
   - Never share via email or chat
   - Encrypt backups

2. **Passwords**
   - Use strong, unique passwords (20+ characters)
   - Don't reuse passwords
   - Store in password manager

3. **Hardware tokens** (EV certificates)
   - Keep in secure location when not in use
   - Have backup token if possible
   - Document token usage procedures

---

## 🔄 Secret Rotation Schedule

| Secret | Rotation Frequency | Next Rotation |
|--------|-------------------|---------------|
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Every 90 days | Feb 28, 2026 |
| `WINDOWS_CERT_PASSWORD` | With cert renewal | Dec 2026 |
| `APPLE_CERT_PASSWORD` | Every 90 days | Feb 28, 2026 |
| `APPLE_APP_PASSWORD` | Every 90 days | Feb 28, 2026 |
| `CLOUDFLARE_R2_TOKEN` | Every 90 days | Feb 28, 2026 |

---

## 📞 Support

### Certificate Issues
- **Windows:** DigiCert/Sectigo support
- **macOS:** Apple Developer Support (1-800-633-2152)

### GitHub Secrets
- **Documentation:** https://docs.github.com/en/actions/security-guides/encrypted-secrets
- **Troubleshooting:** Check workflow logs for "Secret not found" errors

### Cloudflare R2
- **Documentation:** https://developers.cloudflare.com/r2/
- **Support:** https://community.cloudflare.com/

---

## ✅ Quick Validation

```bash
# Run this after configuring all secrets
./scripts/validate-secrets.sh
```

If all secrets are configured correctly, you should see:
```
✅ All 11 secrets configured
✅ Tauri signing ready
✅ Windows signing ready
✅ macOS signing ready
✅ Update server ready

Ready for production release!
```

---

**Last Updated:** 2025-11-28  
**Status:** ⏳ Placeholders - Complete after certificates received  
**Next Action:** Purchase certificates → Configure secrets → Test build
