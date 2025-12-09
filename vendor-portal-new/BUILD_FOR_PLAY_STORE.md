> **⚠️ DEPRECATION NOTICE**: This document has been consolidated into [docs/ANDROID.md](docs/ANDROID.md). Please refer to the consolidated guide for up-to-date information.

---

# Build AAB for Google Play Store - Quick Guide

## 🚀 Quick Start (5 minutes)

### Prerequisites Check

```bash
# Check all requirements
node -v    # Should be 20+
pnpm -v    # Should be 10+
java -version  # Should be 17+
echo $ANDROID_HOME  # Should point to Android SDK

# If any missing, install first
```

### Set Environment Variables

Create `.env` file in repository root:

```bash
# Required for build
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-role-key

# Security keys (generate if missing)
BACKUP_PEPPER=$(openssl rand -hex 32)
MFA_SESSION_SECRET=$(openssl rand -hex 32)
TRUSTED_COOKIE_SECRET=$(openssl rand -hex 32)
HMAC_SHARED_SECRET=$(openssl rand -hex 32)
KMS_DATA_KEY_BASE64=$(openssl rand -base64 32)

# OpenAI (for SMS parsing)
OPENAI_API_KEY=sk-...your-key

# Environment
APP_ENV=production
NODE_ENV=production
```

Load environment variables:

```bash
# Source .env file
export $(cat .env | xargs)
```

### Build AAB

```bash
cd apps/admin

# Run automated build script
./build-production-aab.sh
```

**That's it!** The script will:

1. ✅ Validate environment
2. ✅ Generate signing keystore (first time only)
3. ✅ Clean previous builds
4. ✅ Install dependencies
5. ✅ Build Next.js app
6. ✅ Sync Capacitor
7. ✅ Build signed AAB

**Output:** `android/app/build/outputs/bundle/release/app-release.aab`

---

## 📋 Manual Build Steps (Alternative)

If you prefer manual control:

### 1. Generate Keystore (First Time Only)

```bash
cd apps/admin/android/app

keytool -genkeypair -v -storetype PKCS12 \
  -keystore ibimina-staff-release.keystore \
  -alias ibimina-staff \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -dname "CN=Ibimina SACCO Staff, OU=IT, O=Ikanisa Rwanda, L=Kigali, C=RW"

# You'll be prompted for password - SAVE IT SECURELY!
```

⚠️ **BACKUP THIS KEYSTORE IMMEDIATELY!** Loss = cannot update app.

### 2. Configure Signing

```bash
# Set environment variables
export ANDROID_KEYSTORE_PATH="$PWD/android/app/ibimina-staff-release.keystore"
export ANDROID_KEYSTORE_PASSWORD="your-secure-password"
export ANDROID_KEY_ALIAS="ibimina-staff"
export ANDROID_KEY_PASSWORD="your-secure-password"
```

### 3. Build Next.js

```bash
cd apps/admin

# Ensure environment variables are set
export NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
# ... other vars

pnpm build
```

### 4. Sync Capacitor

```bash
npx cap sync android
```

### 5. Build AAB

```bash
cd android

# Set version
export ANDROID_VERSION_CODE=100
export ANDROID_VERSION_NAME="1.0.0"

# Build
./gradlew bundleRelease

# Output: app/build/outputs/bundle/release/app-release.aab
```

---

## 🔍 Verification

### Check AAB Signature

```bash
jarsigner -verify -verbose -certs android/app/build/outputs/bundle/release/app-release.aab
```

Should show:

```
jar verified.
```

### Check AAB Contents

```bash
# Install bundletool (once)
# macOS: brew install bundletool
# Linux: snap install bundletool

# Validate AAB
bundletool validate --bundle=android/app/build/outputs/bundle/release/app-release.aab

# Generate device APKs (for testing)
bundletool build-apks \
  --bundle=android/app/build/outputs/bundle/release/app-release.aab \
  --output=test.apks \
  --ks=android/app/ibimina-staff-release.keystore \
  --ks-key-alias=ibimina-staff

# Install on connected device
bundletool install-apks --apks=test.apks
```

---

## 📤 Upload to Google Play Console

### Option 1: Web Interface (Easiest)

1. Go to: https://play.google.com/console
2. Select your app (or create new app)
3. Navigate to: **Testing → Internal testing**
4. Click: **Create new release**
5. Click: **Upload** → Select `app-release.aab`
6. Add release notes:

```
Version 1.0.0 - Initial Internal Release

Features:
• Real-time SMS payment processing (99.4% faster)
• Instant payment approvals (5-8 seconds)
• Biometric device authentication
• NFC TapMoMo contactless payments

Requirements:
• Android 7.0+ (API 26+)
• SACCO staff credentials
```

7. Add testers (email list)
8. Click: **Save** → **Start rollout**

### Option 2: Command Line (Advanced)

```bash
# Install Google Play CLI
npm install -g @google/play-developer-api

# Upload AAB
play-developer-api upload \
  --package-name rw.ibimina.staff \
  --track internal \
  --aab android/app/build/outputs/bundle/release/app-release.aab \
  --release-notes "Version 1.0.0 - Initial release"
```

---

## 🐛 Troubleshooting

### Build Fails: "Keystore not found"

**Solution:** Run the build script again - it will generate the keystore
automatically.

### Build Fails: "Environment variable not set"

**Solution:** Ensure all required env vars are exported:

```bash
# Check if set
echo $NEXT_PUBLIC_SUPABASE_URL

# If empty, export from .env
export $(cat .env | xargs)
```

### Build Fails: "Java version incorrect"

**Solution:** Install Java 17:

```bash
# macOS
brew install openjdk@17
echo 'export PATH="/opt/homebrew/opt/openjdk@17/bin:$PATH"' >> ~/.zshrc

# Ubuntu/Debian
sudo apt install openjdk-17-jdk
```

### Build Fails: "ANDROID_HOME not set"

**Solution:** Set Android SDK path:

```bash
# macOS
export ANDROID_HOME=$HOME/Library/Android/sdk

# Linux
export ANDROID_HOME=$HOME/Android/Sdk

# Add to shell profile (~/.zshrc or ~/.bashrc)
echo 'export ANDROID_HOME=$HOME/Library/Android/sdk' >> ~/.zshrc
echo 'export PATH=$PATH:$ANDROID_HOME/platform-tools' >> ~/.zshrc
```

### AAB Upload Rejected: "Signature mismatch"

**Cause:** Using different keystore than previous upload.

**Solution:** Use the SAME keystore for all updates. Check `KEYSTORE_INFO.txt`.

### Play Console: "SMS permissions require justification"

**Solution:** In Data Safety section, explain:

- App is for internal SACCO staff only
- SMS used for mobile money payment reconciliation
- Only reads MTN/Airtel transaction SMS
- Distributed via Internal Testing (not public)

---

## 📁 File Locations

```
apps/admin/
├── android/
│   ├── app/
│   │   ├── ibimina-staff-release.keystore  ← Signing key (BACKUP!)
│   │   ├── KEYSTORE_INFO.txt               ← Password (KEEP SECURE!)
│   │   └── build/outputs/
│   │       └── bundle/release/
│   │           └── app-release.aab         ← Upload this to Play Store
│   └── build.gradle
├── build-production-aab.sh                  ← Automated build script
└── BUILD_FOR_PLAY_STORE.md                  ← This file
```

---

## ✅ Pre-Upload Checklist

Before uploading to Play Store:

- [ ] Keystore generated and backed up
- [ ] AAB builds successfully
- [ ] AAB signature verified
- [ ] Version code incremented (for updates)
- [ ] Privacy policy deployed (https://admin.ibimina.rw/privacy)
- [ ] Release notes prepared
- [ ] Tester email list ready
- [ ] Data Safety section completed in Play Console

---

## 🔄 Update Process (Future Releases)

```bash
cd apps/admin

# 1. Increment version
export ANDROID_VERSION_CODE=101  # Increment by 1
export ANDROID_VERSION_NAME="1.0.1"

# 2. Make code changes
# ... edit files ...

# 3. Build new AAB
./build-production-aab.sh

# 4. Upload to Play Console
# Testing → Internal testing → Create new release → Upload new AAB

# Staff get automatic update notification!
```

---

## 📞 Support

If you encounter issues:

1. Check this troubleshooting guide
2. Review build logs in terminal
3. Check Capacitor docs: https://capacitorjs.com
4. Check Play Console help:
   https://support.google.com/googleplay/android-developer

---

## 🎯 Quick Reference

```bash
# Build AAB (automated)
cd apps/admin && ./build-production-aab.sh

# Build AAB (manual)
cd apps/admin && \
  pnpm build && \
  npx cap sync android && \
  cd android && \
  ./gradlew bundleRelease

# Output location
apps/admin/android/app/build/outputs/bundle/release/app-release.aab

# Upload to
https://play.google.com/console → Testing → Internal testing
```

---

**Ready to build?** Run `./build-production-aab.sh` and you'll have your AAB in
~5 minutes! 🚀
