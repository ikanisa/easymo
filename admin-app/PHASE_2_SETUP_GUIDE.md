# Phase 2 Setup Guide: Code Signing Certificates

**Status:** ⚠️ Requires Manual Action  
**Timeline:** 1-2 weeks (external dependencies)  
**Date:** 2025-11-28

---

## ✅ COMPLETED (Automated Setup)

### 2.3 Tauri Signing Keys ✅
**Status:** COMPLETE  
**Generated:** 2025-11-28

The Tauri signing keypair has been generated and configured:

- **Private Key:** `~/.tauri/easymo-admin.key` (password-protected)
- **Public Key:** `~/.tauri/easymo-admin.key.pub`
- **Password:** `easymo-admin-2025` ⚠️ CHANGE THIS IN PRODUCTION

**Public Key (added to tauri.conf.json):**
```
dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDJFQkM2NDY1RTlGODNEMDYKUldRR1BmanBaV1M4TGltR3JvUG9lcjdKakp3aGNEQ05JMTJEUFJzUjQ2SGZHR2hvUzNWaS9lKzQK
```

**Files Updated:**
- ✅ `src-tauri/tauri.conf.json` - Added public key
- ✅ `src-tauri/Cargo.toml` - Enabled `tauri-plugin-updater = "2"`
- ✅ `src-tauri/src/lib.rs` - Uncommented updater plugin
- ✅ `src-tauri/Entitlements.plist` - Created for macOS

**⚠️ SECURITY WARNING:**
The private key is stored locally at `~/.tauri/easymo-admin.key`. 
**DO NOT commit this to git!**

---

## 📋 PENDING: Manual Certificate Setup

### 2.1 Windows Code Signing Certificate ❌ NOT STARTED
**Priority:** 🔴 CRITICAL  
**Timeline:** 5-7 business days  
**Cost:** $300-500/year  
**Owner:** DevOps + Finance Team

#### What You Need to Do

**Step 1: Choose Certificate Type**

| Type | Cost | Delivery | SmartScreen Reputation | Recommendation |
|------|------|----------|------------------------|----------------|
| Standard OV | $300/yr | 3-5 days | Slow (takes months) | Budget option |
| **EV Code Signing** | **$500/yr** | **5-7 days + token** | **Instant** | **✅ RECOMMENDED** |

**Recommendation:** EV Certificate
- Windows SmartScreen gives instant "green" reputation
- No "Unknown Publisher" warning on first install
- Worth the extra $200/year

**Step 2: Choose Certificate Provider**

Recommended providers:
1. **DigiCert** (most popular)
   - URL: https://www.digicert.com/signing/code-signing-certificates
   - Price: ~$500/year (EV), ~$300/year (OV)
   - Support: Excellent

2. **Sectigo** (cheaper alternative)
   - URL: https://sectigo.com/ssl-certificates-tls/code-signing
   - Price: ~$400/year (EV), ~$250/year (OV)
   - Support: Good

**Step 3: Gather Required Documents**

Before starting application, prepare:

**For Company:**
- Articles of Incorporation
- EIN (Employer Identification Number)
- Business registration documents
- Proof of business address (utility bill, bank statement)
- Business phone number (must be published in public directory)

**For Authorized Signer (you):**
- Government-issued photo ID (Driver's License or Passport)
- Proof of employment/authorization at company
- Phone number for verification call

**Step 4: Start Application**

1. Visit chosen provider's website
2. Select "Code Signing Certificate" → "EV Code Signing"
3. Fill out application form:
   - Company name (must match legal documents)
   - DUNS number (get from Dun & Bradstreet if needed)
   - Your contact information
   - Authorized signer details

4. Submit application and pay
5. Wait for validation call/email (usually within 24 hours)

**Step 5: Validation Process (Days 2-5)**

The CA (Certificate Authority) will:
- Call your published business phone number to verify
- Verify your business in public databases (DUNS, Secretary of State)
- Verify authorized signer identity (video call or notary)
- Check all documents submitted

**Your Tasks:**
- ✅ Respond to all emails promptly
- ✅ Answer verification phone calls
- ✅ Complete any additional verification requested
- ✅ Be available for video verification call (EV only)

**Step 6: Receive Certificate (Days 6-7)**

**For EV Certificate:**
- You'll receive a USB hardware token by mail (SafeNet or YubiKey)
- Certificate is pre-installed on the token
- Token ships via expedited mail (track it!)
- **Keep this token SECURE** - it's your signing identity

**For Standard OV Certificate:**
- You'll receive an email with download link
- Download certificate as PFX/P12 file
- Create a strong password for the certificate

**Step 7: Configure for Development (Local)**

**For EV Token:**
```bash
# Windows: Install SafeNet drivers (provided with token)
# Token shows up as removable drive
# Certificate automatically available in Windows Certificate Store

# Test signing
signtool sign /tr http://timestamp.digicert.com /td sha256 /fd sha256 test.exe
```

**For PFX File:**
```bash
# Import to Windows Certificate Store
certutil -user -p "YourPassword" -importPFX certificate.pfx

# Or sign directly with PFX
signtool sign /f certificate.pfx /p "YourPassword" /tr http://timestamp.digicert.com /td sha256 /fd sha256 test.exe
```

**Step 8: Configure for CI/CD (GitHub Actions)**

**For EV Token:**
- ❌ Cannot use directly in CI/CD (hardware token required)
- ✅ Solution: Use GitHub self-hosted runner with token attached
- OR: Use cloud HSM service (Azure Key Vault, AWS CloudHSM)

**For PFX File:**
```bash
# Convert PFX to base64
base64 -i certificate.pfx -o certificate.b64

# Add to GitHub Secrets
gh secret set WINDOWS_CERTIFICATE < certificate.b64
gh secret set WINDOWS_CERT_PASSWORD
# Enter your certificate password when prompted
```

---

### 2.2 macOS Code Signing & Notarization ❌ NOT STARTED
**Priority:** 🔴 CRITICAL  
**Timeline:** 1-2 days  
**Cost:** $99/year  
**Owner:** DevOps Team (requires macOS machine)

#### What You Need to Do

**Step 1: Enroll in Apple Developer Program**

1. Visit https://developer.apple.com/programs/enroll/
2. Sign in with your Apple ID (or create one)
3. Click "Start Your Enrollment"
4. Choose "Enroll as Organization" (recommended) or "Individual"
   - Organization: Requires D-U-N-S number (free from Dun & Bradstreet)
   - Individual: Uses your personal Apple ID

5. Fill out enrollment form:
   - Legal entity name
   - Address
   - Contact information
   - D-U-N-S number (for organization)

6. Pay $99 annual fee (credit card)
7. Wait for approval (usually 24-48 hours)
   - Apple may call to verify
   - Check email for approval notification

**Step 2: Create Certificates (Requires macOS)**

⚠️ **This step MUST be done on a macOS machine**

1. Open Keychain Access (Applications → Utilities)
2. Keychain Access → Certificate Assistant → Request a Certificate from a Certificate Authority
3. Fill out form:
   - User Email: your@email.com
   - Common Name: EasyMO Platform
   - Select "Saved to disk"
   - Click Continue
4. Save as `CertificateSigningRequest.certSigningRequest`

5. Visit https://developer.apple.com/account/resources/certificates/add
6. Select "Developer ID Application"
7. Click Continue
8. Upload the CSR file you just created
9. Click Continue → Download

10. Double-click downloaded certificate to install in Keychain
11. Verify in Keychain Access → "My Certificates"
    - Should see "Developer ID Application: EasyMO Platform (TEAM_ID)"

**Step 3: Setup Notarization Credentials**

1. Visit https://appleid.apple.com/account/manage
2. Sign in with your Apple Developer account
3. Under "Security" → "App-Specific Passwords"
4. Click "Generate Password"
5. Enter label: "Tauri Notarization"
6. Copy the generated password (save it securely!)

7. On your macOS machine, run:
```bash
xcrun notarytool store-credentials "easymo-notary" \
  --apple-id "your-apple-dev-email@example.com" \
  --team-id "YOUR_TEAM_ID" \
  --password "xxxx-xxxx-xxxx-xxxx"
```
   - Replace `your-apple-dev-email@example.com` with your Apple Developer email
   - Replace `YOUR_TEAM_ID` with your Team ID (found at https://developer.apple.com/account)
   - Replace `xxxx-xxxx-xxxx-xxxx` with the app-specific password you generated

8. Test notarization setup:
```bash
xcrun notarytool history --keychain-profile "easymo-notary"
# Should connect and show empty history (no errors)
```

**Step 4: Export Certificate for CI/CD**

On your macOS machine:

1. Open Keychain Access
2. Find "Developer ID Application: EasyMO Platform"
3. Right-click → Export "Developer ID Application: EasyMO Platform"
4. Save as: `apple-certificate.p12`
5. Enter a strong password (you'll need this for CI/CD)

6. Convert to base64:
```bash
base64 -i apple-certificate.p12 -o apple-certificate.b64
```

7. Add to GitHub Secrets:
```bash
gh secret set APPLE_CERTIFICATE < apple-certificate.b64
gh secret set APPLE_CERT_PASSWORD
# Enter the password you set in step 5

gh secret set APPLE_ID
# Enter your Apple Developer email

gh secret set APPLE_TEAM_ID
# Enter your Team ID

gh secret set APPLE_APP_PASSWORD
# Enter the app-specific password from Step 3
```

**Step 5: Update Tauri Config**

Edit `admin-app/src-tauri/tauri.conf.json`:

```json
{
  "bundle": {
    "macOS": {
      "minimumSystemVersion": "10.15",
      "entitlements": "Entitlements.plist",
      "signingIdentity": "Developer ID Application: EasyMO Platform (YOUR_TEAM_ID)"
    }
  }
}
```

Replace `YOUR_TEAM_ID` with your actual Team ID.

---

## 🔐 GitHub Secrets Summary

Once both certificates are obtained, you should have these secrets configured:

### Tauri Signing (Auto-Updates)
```bash
TAURI_SIGNING_PRIVATE_KEY          # Content of ~/.tauri/easymo-admin.key
TAURI_SIGNING_PRIVATE_KEY_PASSWORD # Password: easymo-admin-2025 (CHANGE THIS!)
```

### Windows Code Signing
```bash
WINDOWS_CERTIFICATE          # Base64 encoded PFX file
WINDOWS_CERT_PASSWORD        # Certificate password
```

### Apple Code Signing & Notarization
```bash
APPLE_CERTIFICATE           # Base64 encoded P12 file
APPLE_CERT_PASSWORD         # P12 file password
APPLE_ID                    # Apple Developer email
APPLE_TEAM_ID               # Your Team ID (e.g., "ABC123XYZ")
APPLE_APP_PASSWORD          # App-specific password for notarization
```

### Setting Secrets
```bash
# Interactive (prompts for value)
gh secret set SECRET_NAME

# From file
gh secret set SECRET_NAME < file.txt

# From command output
echo "secret-value" | gh secret set SECRET_NAME
```

### Verify Secrets Set
```bash
gh secret list
# Should show all 7 secrets above
```

---

## ✅ Verification Checklist

Before proceeding to Phase 3, verify:

### Tauri Signing Keys
- [x] Private key exists at `~/.tauri/easymo-admin.key`
- [x] Public key added to `tauri.conf.json`
- [x] Updater plugin enabled in `Cargo.toml`
- [x] Updater plugin enabled in `lib.rs`
- [ ] GitHub secrets configured:
  - [ ] `TAURI_SIGNING_PRIVATE_KEY`
  - [ ] `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

### Windows Code Signing
- [ ] Certificate purchased (EV recommended)
- [ ] Certificate received (token or PFX)
- [ ] Certificate tested locally
- [ ] GitHub secrets configured:
  - [ ] `WINDOWS_CERTIFICATE`
  - [ ] `WINDOWS_CERT_PASSWORD`

### macOS Code Signing
- [ ] Apple Developer account active ($99 paid)
- [ ] Developer ID Application certificate created
- [ ] Notarization credentials configured
- [ ] Certificate exported and tested
- [ ] `tauri.conf.json` updated with signing identity
- [ ] GitHub secrets configured:
  - [ ] `APPLE_CERTIFICATE`
  - [ ] `APPLE_CERT_PASSWORD`
  - [ ] `APPLE_ID`
  - [ ] `APPLE_TEAM_ID`
  - [ ] `APPLE_APP_PASSWORD`

---

## 📞 Support & Resources

### Windows Code Signing
- DigiCert Support: https://www.digicert.com/support
- Sectigo Support: https://sectigo.com/support
- Microsoft SignTool Docs: https://learn.microsoft.com/en-us/windows/win32/seccrypto/signtool

### macOS Code Signing
- Apple Developer Support: https://developer.apple.com/support/
- Notarization Guide: https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution
- Code Signing Guide: https://developer.apple.com/library/archive/documentation/Security/Conceptual/CodeSigningGuide/

### Tauri
- Tauri Updater Docs: https://v2.tauri.app/plugin/updater/
- Tauri Signing Docs: https://v2.tauri.app/distribute/sign/

---

## 🚦 Status: Phase 2

| Task | Status | Owner | Blocker |
|------|--------|-------|---------|
| 2.1 Windows Certificate | ❌ Not Started | DevOps + Finance | Need to purchase |
| 2.2 macOS Certificate | ❌ Not Started | DevOps (macOS required) | Need to enroll |
| 2.3 Tauri Signing Keys | ✅ **COMPLETE** | - | - |

**Next Action:** Purchase Windows certificate & Enroll in Apple Developer Program (can do in parallel)

**Estimated Completion:** December 6-13, 2025 (depending on certificate delivery)

---

**Created:** 2025-11-28  
**Last Updated:** 2025-11-28  
**Phase 2 Progress:** 33% (1/3 complete)
