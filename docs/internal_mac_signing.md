# Internal macOS Code Signing Guide

## Overview

This repository contains **two macOS desktop applications** for internal use:

1. **Admin Panel** - Management interface for administrators
2. **Client/Staff Portal** - Portal for clients and staff members

Both apps are signed with the **same internal code-signing certificate** to ensure they run smoothly on internal Macs without constant Gatekeeper warnings.

**App Bundle Locations:**
- Admin Panel: `./dist/mac/AdminPanel.app`
- Client/Staff Portal: `./dist/mac/ClientPortal.app`

---

## Why Code Signing?

macOS **Gatekeeper** blocks unsigned or untrusted apps by default. Code signing:
- Proves the app comes from a trusted source (you)
- Prevents "App is damaged" warnings on internal machines
- Allows smooth distribution within your organization

We use a **self-signed certificate** for internal distribution. Later, you can upgrade to an **Apple Developer ID** certificate for wider distribution.

---

## Part 1: Creating the Self-Signed Certificate

### Steps (on your main development Mac):

1. **Open Keychain Access**
   - Applications → Utilities → Keychain Access

2. **Create a new certificate**
   - Menu: Keychain Access → Certificate Assistant → Create a Certificate...

3. **Configure the certificate:**
   - **Name:** `Inhouse Dev Signing` (or your company name)
   - **Identity Type:** Self Signed Root
   - **Certificate Type:** Code Signing
   - **Let me override defaults:** ✓ (check this box)
   - Click **Continue**

4. **Certificate Information:**
   - **Serial Number:** 1 (default is fine)
   - **Validity Period:** 3650 days (10 years)
   - Click **Continue** through the remaining screens (defaults are fine)

5. **Keychain:** Select **login** keychain
   - Click **Create**

6. **Trust the certificate:**
   - In Keychain Access, find your new certificate (`Inhouse Dev Signing`)
   - Double-click it → Expand **Trust** section
   - Set **Code Signing** to **Always Trust**
   - Close the window (enter your password to save)

### Result:
You now have a trusted code-signing certificate in your login keychain.

---

## Part 2: Exporting the Certificate for Distribution

Internal team members need the same certificate to trust your apps.

### Export as .p12:

1. In Keychain Access, find `Inhouse Dev Signing`
2. Right-click → **Export "Inhouse Dev Signing"...**
3. Save as: `InhouseDevSigning.p12`
4. **Password:** Choose a strong password (share securely with team)
5. Enter your Mac login password to export

### Distribute:
- Share `InhouseDevSigning.p12` + password via secure internal channel (Slack DM, 1Password, etc.)
- **Do NOT** commit the .p12 to version control

---

## Part 3: Importing Certificate on Internal Macs

Each internal user needs to:

1. **Double-click** `InhouseDevSigning.p12`
2. **Keychain:** Select **login** keychain
3. Enter the .p12 **password**
4. Click **Add**
5. **Trust the certificate:**
   - Find `Inhouse Dev Signing` in Keychain Access
   - Double-click → Trust section
   - Set **Code Signing** to **Always Trust**
   - Enter Mac password to save

---

## Part 4: Signing the Apps

### List Available Identities

First, verify your certificate is available:

```bash
./scripts/list_identities.sh
```

You should see `Inhouse Dev Signing` in the output.

### Sign a Single App

To sign one app manually:

```bash
./scripts/sign_app.sh ./dist/mac/AdminPanel.app "Inhouse Dev Signing"
```

### Sign Both Apps

To sign all apps at once (recommended):

```bash
./scripts/sign_all_apps.sh
```

This will:
- Sign the Admin Panel
- Sign the Client/Staff Portal
- Verify both signatures
- Check Gatekeeper status

### Custom Identity

To use a different identity (e.g., Apple Developer ID):

```bash
SIGNING_IDENTITY="Developer ID Application: Your Company (TEAMID)" ./scripts/sign_all_apps.sh
```

---

## Part 5: Interpreting Results

### Successful Signing

After running `sign_all_apps.sh`, you should see:

```
✓ Signing succeeded
✓ Signature verification succeeded
✓ Gatekeeper assessment: ACCEPTED (or ad-hoc for self-signed)
SUCCESS: [App Name] is signed
```

### Verification Commands

You can manually verify any app:

```bash
# Verify signature integrity
codesign --verify --deep --strict --verbose=2 ./dist/mac/AdminPanel.app

# Check Gatekeeper status
spctl --assess --verbose=4 --type execute ./dist/mac/AdminPanel.app
```

**Expected outputs:**
- `--verify`: Should complete with no errors
- `spctl --assess`: 
  - Self-signed: "rejected" or "adhoc" (normal for internal certs)
  - Developer ID: "accepted" (requires Apple certificate)

---

## Part 6: Running the Apps (Internal Users)

### First Launch (Self-Signed Certificate)

Even with the certificate trusted, macOS may show a warning the **first time**:

> "AdminPanel.app cannot be opened because the developer cannot be verified."

**Solution:**

1. **Right-click** (or Ctrl-click) the app
2. Select **Open**
3. Click **Open** in the dialog

This only needs to be done **once per app**. After that, double-clicking works normally.

### Subsequent Launches

Just double-click the app like normal. No warnings.

---

## Part 7: Upgrading to Apple Developer ID (Future)

If you later want to distribute outside your organization or avoid first-launch warnings:

### Steps:

1. **Enroll in Apple Developer Program** ($99/year)
   - https://developer.apple.com/programs/

2. **Create a Developer ID Application certificate:**
   - Xcode → Preferences → Accounts → Manage Certificates
   - Click **+** → Developer ID Application

3. **Update scripts:**
   - In `scripts/sign_all_apps.sh`, change:
     ```bash
     DEFAULT_IDENTITY="Inhouse Dev Signing"
     ```
     to:
     ```bash
     DEFAULT_IDENTITY="Developer ID Application: Your Company Name (TEAMID)"
     ```
   - Or set environment variable:
     ```bash
     export SIGNING_IDENTITY="Developer ID Application: Your Company Name (TEAMID)"
     ```

4. **Sign apps:**
   ```bash
   ./scripts/sign_all_apps.sh
   ```

5. **Notarize** (optional but recommended for Developer ID):
   - Submit app to Apple for automated malware scan
   - See: https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution

### Benefits of Developer ID:
- Users don't need to import your certificate
- No "Right-click → Open" workaround needed
- Apps work immediately on any Mac
- Can notarize for additional trust

---

## Quick Reference

### Commands

```bash
# List signing identities
./scripts/list_identities.sh

# Sign one app
./scripts/sign_app.sh ./dist/mac/AdminPanel.app "Inhouse Dev Signing"

# Sign all apps
./scripts/sign_all_apps.sh

# Verify a signature
codesign --verify --deep --strict --verbose=2 ./dist/mac/AdminPanel.app

# Check Gatekeeper status
spctl --assess --verbose=4 --type execute ./dist/mac/AdminPanel.app
```

### Files

- `scripts/list_identities.sh` - List available code-signing identities
- `scripts/sign_app.sh` - Sign a single .app bundle
- `scripts/sign_all_apps.sh` - Sign both apps at once
- `docs/internal_mac_signing.md` - This documentation

### App Paths (Update in `sign_all_apps.sh`)

```bash
ADMIN_APP_PATH="./dist/mac/AdminPanel.app"
CLIENT_APP_PATH="./dist/mac/ClientPortal.app"
```

---

## Troubleshooting

### "No identity found"
- Run `./scripts/list_identities.sh` to see available identities
- Verify certificate is in login keychain (Keychain Access)
- Ensure certificate is marked "Always Trust" for Code Signing

### "Signature verification failed"
- App bundle may be corrupted
- Try cleaning build directory and rebuilding
- Ensure all files in .app bundle have correct permissions

### "Gatekeeper rejected"
- Normal for self-signed certificates
- Internal users must right-click → Open on first launch
- Upgrade to Developer ID certificate to avoid this

### "Certificate not trusted on other Macs"
- Ensure .p12 was imported correctly
- Verify certificate is marked "Always Trust" in Keychain Access
- Check it's in the **login** keychain (not System)

---

## Security Notes

- **Never commit** .p12 files to version control
- **Protect** the .p12 password (treat like a password)
- **Rotate** certificates every few years
- **Revoke** certificate if compromised (create new one)
- **Limit** .p12 distribution to trusted team members only

---

## Summary

✅ **One certificate** signs **two apps**  
✅ **Same repo**, streamlined workflow  
✅ **Scriptable** and **repeatable**  
✅ **Easy upgrade** path to Apple Developer ID  
✅ **Internal distribution** without App Store hassle  

Your internal users will thank you for smooth app launches! 🚀
