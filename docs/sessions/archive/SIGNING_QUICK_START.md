# macOS Code Signing - Quick Start

**Goal:** Sign both macOS apps (Admin Panel + Client/Staff Portal) for internal distribution.

## 🚀 One-Time Setup (5 minutes)

### 1. Create Certificate

Open **Keychain Access** → Menu: **Certificate Assistant** → **Create a Certificate**

- **Name:** `Inhouse Dev Signing`
- **Identity Type:** Self Signed Root
- **Certificate Type:** Code Signing
- **Let me override defaults:** ✓ (check)
- Click **Continue** → Accept defaults → **Create**

### 2. Trust Certificate

In Keychain Access:

- Find `Inhouse Dev Signing`
- Double-click → **Trust** section
- Set **Code Signing** to **Always Trust**
- Close (enter password)

### 3. Verify Setup

```bash
./scripts/check_certificate.sh
```

Should show: ✓ Certificate found

---

## 📦 Sign Apps (every build)

### Update Paths (first time only)

Edit `scripts/sign_all_apps.sh` lines 28-29:

```bash
ADMIN_APP_PATH="./path/to/AdminPanel.app"
CLIENT_APP_PATH="./path/to/ClientPortal.app"
```

### Sign

```bash
./scripts/sign_all_apps.sh
```

### Verify

```bash
./scripts/verify_apps.sh
```

---

## 📤 Distribute to Team

### 1. Export Certificate

Keychain Access:

- Right-click `Inhouse Dev Signing`
- **Export "Inhouse Dev Signing"...**
- Save as `InhouseDevSigning.p12`
- Set password (remember it!)

### 2. Share Securely

Send `InhouseDevSigning.p12` + password via:

- Slack DM
- 1Password
- Encrypted email

**NEVER commit .p12 to git!**

### 3. Team Members Import

On each Mac:

1. Double-click `InhouseDevSigning.p12`
2. Enter password
3. Open Keychain Access
4. Find certificate → Double-click
5. Trust → **Code Signing** → **Always Trust**

### 4. First App Launch

If macOS shows warning:

1. **Right-click** app → **Open**
2. Click **Open** in dialog
3. Never needed again

---

## 🔧 Common Commands

```bash
# List signing identities
./scripts/list_identities.sh

# Check certificate exists
./scripts/check_certificate.sh

# Sign one app
./scripts/sign_app.sh ./dist/mac/AdminPanel.app "Inhouse Dev Signing"

# Sign both apps
./scripts/sign_all_apps.sh

# Verify signatures
./scripts/verify_apps.sh
```

---

## 🆙 Upgrade to Apple Developer ID (later)

1. Join Apple Developer Program ($99/year)
2. Get Developer ID certificate in Xcode
3. Update `scripts/sign_all_apps.sh`:

```bash
DEFAULT_IDENTITY="Developer ID Application: Your Company (TEAMID)"
```

4. Sign + notarize (see full docs)

**Benefit:** No right-click needed, works on any Mac instantly.

---

## 📚 Full Documentation

See **`docs/internal_mac_signing.md`** for:

- Detailed certificate creation steps
- Troubleshooting guide
- Security best practices
- Notarization instructions

---

## ✅ Checklist

- [ ] Certificate created (`Inhouse Dev Signing`)
- [ ] Certificate trusted (Always Trust)
- [ ] App paths updated in `sign_all_apps.sh`
- [ ] Both apps signed successfully
- [ ] Signatures verified
- [ ] Certificate exported as .p12
- [ ] Team members have .p12 + password
- [ ] Apps tested on teammate's Mac

**You're done!** 🎉
