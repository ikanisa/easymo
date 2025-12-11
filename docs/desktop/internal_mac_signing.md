# macOS Code Signing Guide - Internal Distribution

This guide explains how to code-sign the **EasyMO Desktop Applications** for internal distribution
on macOS.

## Applications

This repository contains **two** macOS desktop applications:

1. **Admin Panel** (`AdminPanel.app`)
   - Full administrative dashboard
   - User management, analytics, configuration
   - Build path: `admin-app/dist/mac/AdminPanel.app`

2. **Client/Staff Portal** (`ClientPortal.app`)
   - Customer and staff interface
   - Simplified functionality
   - Build path: `admin-app/dist/mac/ClientPortal.app`

**Both applications are signed with the same certificate** for consistency and ease of distribution.

---

## Overview

### What is Code Signing?

Code signing on macOS:

- Proves the application comes from a trusted source
- Prevents unauthorized modifications
- Required for distribution (even internal)
- Reduces Gatekeeper warnings

### Internal vs. Apple Distribution

| Type                            | Certificate  | Distribution       | Gatekeeper                  |
| ------------------------------- | ------------ | ------------------ | --------------------------- |
| **Internal** (Current)          | Self-signed  | Internal team only | Requires right-click → Open |
| **Apple Developer ID** (Future) | Apple-issued | Public or internal | No warnings                 |

This guide covers **internal distribution** using a self-signed certificate. You can upgrade to an
Apple Developer ID certificate later by simply changing the signing identity name.

---

## Step 1: Create Self-Signed Certificate

### On Your Main Development Mac:

1. **Open Keychain Access**
   - Applications → Utilities → Keychain Access

2. **Create Certificate**
   - Keychain Access → Certificate Assistant → Create a Certificate...

3. **Certificate Configuration:**
   - **Name**: `Inhouse Dev Signing` (or your preferred name)
   - **Identity Type**: Self Signed Root
   - **Certificate Type**: Code Signing
   - **Let me override defaults**: ✅ Check this
   - Click **Continue**

4. **Certificate Information:**
   - **Serial Number**: 1 (default is fine)
   - **Validity Period**: 3650 days (10 years)
   - Click **Continue** through the remaining screens

5. **Key Pair Information:**
   - **Key Size**: 2048 bits
   - **Algorithm**: RSA
   - Click **Continue**

6. **Keychain:**
   - Select: **login**
   - Click **Create**

7. **Trust the Certificate:**
   - Find your certificate in Keychain Access (login keychain)
   - Double-click the certificate
   - Expand **Trust** section
   - Set "Code Signing" to **Always Trust**
   - Close window (enter your password when prompted)

---

## Step 2: Export Certificate for Distribution

To use this certificate on other Macs (CI/CD, team members):

### Export as .p12 file:

1. **In Keychain Access:**
   - Select **login** keychain
   - Select **My Certificates** category
   - Find `Inhouse Dev Signing`
   - Right-click → Export "Inhouse Dev Signing..."

2. **Save Settings:**
   - **File Format**: Personal Information Exchange (.p12)
   - **Save As**: `InhouseDevSigning.p12`
   - **Location**: Secure location (NOT in git repo)
   - Click **Save**

3. **Set Password:**
   - Enter a strong password
   - **Remember this password** - you'll need it for:
     - Importing on other Macs
     - CI/CD secrets configuration

4. **Store Securely:**
   - Keep the `.p12` file in a secure location
   - Share via secure channel (1Password, encrypted email, etc.)
   - **Never commit to git**

---

## Step 3: Import Certificate on Other Macs

### For Team Members or CI/CD:

1. **Receive the .p12 file** (securely)

2. **Import to Keychain:**
   - Double-click the `.p12` file, OR
   - Keychain Access → File → Import Items...
   - Select the `.p12` file
   - Enter the password you set during export
   - Choose **login** keychain
   - Click **OK**

3. **Trust the Certificate:**
   - Find the imported certificate in login keychain
   - Double-click → Expand **Trust**
   - Set "Code Signing" to **Always Trust**
   - Close (enter password)

4. **Verify:**
   ```bash
   ./scripts/list_identities.sh
   ```
   You should see `Inhouse Dev Signing` in the list.

---

## Step 4: Signing the Applications

### List Available Identities

```bash
./scripts/list_identities.sh
```

This shows all available code-signing identities on your Mac.

### Set Your Signing Identity

```bash
export SIGNING_IDENTITY="Inhouse Dev Signing"
```

Add this to your `~/.zshrc` or `~/.bashrc` to make it permanent.

### Sign a Single App

```bash
./scripts/sign_app.sh ./admin-app/dist/mac/AdminPanel.app "Inhouse Dev Signing"
```

### Sign Both Apps

```bash
./scripts/sign_all_apps.sh
```

This script:

- Signs the Admin Panel app
- Signs the Client/Staff Portal app
- Verifies both signatures
- Checks Gatekeeper assessment

---

## Step 5: Verification

### Verify Signature

```bash
codesign --verify --deep --strict --verbose=2 ./admin-app/dist/mac/AdminPanel.app
```

**Expected output:**

```
./admin-app/dist/mac/AdminPanel.app: valid on disk
./admin-app/dist/mac/AdminPanel.app: satisfies its Designated Requirement
```

### Check Gatekeeper Assessment

```bash
spctl --assess --verbose=4 ./admin-app/dist/mac/AdminPanel.app
```

**For self-signed certificates**, this will show:

```
./admin-app/dist/mac/AdminPanel.app: rejected
source=no usable signature
```

This is **expected** for self-signed certificates. Users will need to bypass Gatekeeper manually.

---

## Step 6: Distribution to Internal Users

### First-Time Launch Instructions

When internal users download and run the apps for the first time, macOS will show a security warning
because the certificate is self-signed.

**Tell users to:**

1. **Download the app** (e.g., `AdminPanel.app`)
2. **Move to Applications folder** (optional but recommended)
3. **Right-click** (or Control-click) on the app
4. **Select "Open"** from the menu
5. **Click "Open"** in the security dialog

**After the first launch**, the app will open normally on subsequent launches.

### Alternative: System Preferences Method

If the right-click method doesn't work:

1. Try to open the app normally (double-click)
2. macOS will show: "AdminPanel.app can't be opened"
3. Go to **System Preferences** → **Security & Privacy** → **General**
4. Click **"Open Anyway"** button
5. Click **"Open"** in the confirmation dialog

---

## Quick Reference

### Sign all apps

```bash
export SIGNING_IDENTITY="Inhouse Dev Signing"
./scripts/sign_all_apps.sh
```

### Verify signature

```bash
codesign --verify --deep --strict --verbose=2 AdminPanel.app
```

### Check identity

```bash
./scripts/list_identities.sh
```

### First-time user instructions

```
Right-click app → Open → Open
```

---

**Last Updated:** 2024-12-02  
**Certificate Type:** Self-Signed (Internal Distribution)  
**Apps Covered:** Admin Panel, Client/Staff Portal
