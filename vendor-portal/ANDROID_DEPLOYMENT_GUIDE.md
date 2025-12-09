> **⚠️ DEPRECATION NOTICE**: This document has been consolidated into [docs/ANDROID.md](docs/ANDROID.md). Please refer to the consolidated guide for up-to-date information.

---

# Android SMS Ingestion - Deployment & Testing Guide

## Quick Start for Staff App Deployment

This guide walks through building, signing, and distributing the Ibimina Staff
Console Android app with SMS ingestion capabilities.

## Prerequisites

### Development Environment

- macOS, Linux, or Windows with WSL2
- Node.js 20+ and pnpm 10.19.0
- Android Studio Ladybug or later
- Java 17+ (OpenJDK recommended)
- Android SDK with API 34 (Android 14)

### Accounts & Services

- Supabase project (already configured)
- Firebase project (optional, for App Distribution)
- Code signing keystore (generated below)

## Step-by-Step Deployment

### 1. Environment Setup

Create a `.env` file in the repository root with required variables:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-role-key

# Security Keys (generate with openssl)
BACKUP_PEPPER=$(openssl rand -hex 32)
MFA_SESSION_SECRET=$(openssl rand -hex 32)
TRUSTED_COOKIE_SECRET=$(openssl rand -hex 32)
HMAC_SHARED_SECRET=$(openssl rand -hex 32)
KMS_DATA_KEY_BASE64=$(openssl rand -base64 32)

# OpenAI for SMS parsing
OPENAI_API_KEY=sk-...your-openai-key

# Environment
APP_ENV=production
NODE_ENV=production
```

### 2. Install Dependencies

```bash
cd /path/to/ibimina
pnpm install --frozen-lockfile
```

### 3. Build Next.js Application

```bash
cd apps/admin
pnpm build
```

Expected output:

```
Route (app)                              Size     First Load JS
...
○  (Static)  prerendered as static content
...
```

Build should complete in 3-5 minutes.

### 4. Sync Capacitor

```bash
npx cap sync android
```

This copies the Next.js build output to the Android project's `assets`
directory.

### 5. Generate Signing Keystore

**⚠️ CRITICAL: Store this keystore securely! Loss means you cannot update the
app.**

```bash
keytool -genkey -v \
  -keystore release.keystore \
  -alias ibimina-staff \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass YOUR_STORE_PASSWORD \
  -keypass YOUR_KEY_PASSWORD \
  -dname "CN=Ibimina SACCO, OU=IT, O=Ikanisa, L=Kigali, ST=Kigali, C=RW"
```

Save these details securely:

- Keystore file: `release.keystore`
- Store password: `YOUR_STORE_PASSWORD`
- Key alias: `ibimina-staff`
- Key password: `YOUR_KEY_PASSWORD`

Move keystore to secure location (e.g., encrypted vault, GitHub secrets).

### 6. Configure Gradle Signing

Edit `apps/admin/android/app/build.gradle`:

```gradle
android {
    ...

    signingConfigs {
        release {
            storeFile file(System.getenv("KEYSTORE_FILE") ?: "../release.keystore")
            storePassword System.getenv("KEYSTORE_PASSWORD")
            keyAlias System.getenv("KEY_ALIAS") ?: "ibimina-staff"
            keyPassword System.getenv("KEY_PASSWORD")
        }
    }

    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

### 7. Build Release APK

Set signing environment variables and build:

```bash
export KEYSTORE_FILE=/path/to/release.keystore
export KEYSTORE_PASSWORD="YOUR_STORE_PASSWORD"
export KEY_ALIAS="ibimina-staff"
export KEY_PASSWORD="YOUR_KEY_PASSWORD"

cd apps/admin/android
./gradlew assembleRelease
```

Build output location:

```
apps/admin/android/app/build/outputs/apk/release/app-release.apk
```

Build time: 2-5 minutes depending on machine.

### 8. Verify APK

```bash
# Check APK signature
jarsigner -verify -verbose -certs app-release.apk

# Check APK info
aapt dump badging app-release.apk | grep -E "package|versionCode|versionName"
```

Expected output:

```
package: name='rw.ibimina.staff' versionCode='1' versionName='1.0'
```

### 9. Test APK on Device

Install on a test device:

```bash
adb install -r app-release.apk
```

Or transfer APK to device and install manually.

## Distribution Methods

### Method 1: Firebase App Distribution (Recommended)

**Setup:**

```bash
npm install -g firebase-tools
firebase login
firebase apps:create android rw.ibimina.staff
```

**Deploy:**

```bash
firebase appdistribution:distribute \
  app-release.apk \
  --app YOUR_FIREBASE_APP_ID \
  --groups "staff-testers" \
  --release-notes "SMS ingestion feature - automatic payment processing"
```

**Staff receives:**

- Email invitation with download link
- In-app update notifications
- Release notes and changelogs

### Method 2: Direct Download (Simple)

1. Upload APK to secure server or cloud storage
2. Share link via email or internal portal
3. Provide installation instructions:

**Installation Instructions for Staff:**

```
1. Open the download link on your Android device
2. Download the APK file
3. Go to Settings > Security > Install from Unknown Sources
4. Enable for your browser/file manager
5. Open the downloaded APK
6. Tap "Install"
7. Open "Ibimina Staff" app
```

### Method 3: MDM/EMM (Enterprise)

If your organization uses Mobile Device Management:

- Upload APK to your MDM console
- Assign to staff device group
- Deploy silently or with user notification

## Post-Deployment Configuration

### Backend Configuration

Ensure Supabase Edge Functions are deployed:

```bash
cd supabase
supabase functions deploy ingest-sms
supabase functions deploy parse-sms
```

Verify environment variables in Supabase dashboard:

- `OPENAI_API_KEY`
- `HMAC_SHARED_SECRET`
- `KMS_DATA_KEY_BASE64`

### Staff Onboarding

1. **Initial Setup Flow:**
   - Staff installs APK
   - Opens app, logs in with email/password
   - Navigates to Settings > SMS Consent
   - Reviews privacy policy
   - Grants SMS permissions
   - Feature automatically enabled

2. **Test Payment:**
   - Send test mobile money SMS to staff device
   - Verify SMS appears in Settings > SMS Ingestion > Test Read
   - Check Supabase dashboard for ingested SMS
   - Verify payment allocation in database

## Testing Checklist

### Pre-Release Testing

- [ ] Build APK successfully with release configuration
- [ ] Verify APK signature
- [ ] Install on physical Android device (test)
- [ ] Grant SMS permissions
- [ ] Enable SMS ingestion in settings
- [ ] Send test MTN MoMo SMS
- [ ] Send test Airtel Money SMS
- [ ] Verify SMS captured in app
- [ ] Verify backend received SMS data
- [ ] Verify payment parsed correctly
- [ ] Verify payment allocated to member
- [ ] Disable SMS ingestion
- [ ] Verify background sync stops
- [ ] Test permission revocation handling
- [ ] Test app restart (session persistence)

### Compatibility Testing

Test on variety of devices:

- [ ] Samsung Galaxy (common in Rwanda)
- [ ] Tecno/Itel (low-end devices)
- [ ] Google Pixel (reference device)
- [ ] Android 10 (API 29)
- [ ] Android 12 (API 31)
- [ ] Android 13+ (POST_NOTIFICATIONS required)
- [ ] Android 14 (API 34, target SDK)

### Security Testing

- [ ] Verify HTTPS only (no cleartext traffic)
- [ ] Verify HMAC authentication on API requests
- [ ] Verify phone numbers encrypted in database
- [ ] Verify no personal SMS accessed (only MTN/Airtel)
- [ ] Verify no SMS stored on device
- [ ] Verify proper permission prompts
- [ ] Verify graceful permission denial handling

## Monitoring & Maintenance

### Key Metrics to Monitor

1. **SMS Ingestion Health:**
   - Check `sms_inbox` table for `status = 'FAILED'`
   - Monitor parse failures (fallback to OpenAI)
   - Track duplicate detection rate

2. **Edge Function Performance:**
   - Response times (should be < 5 seconds)
   - Error rates (aim for < 1%)
   - OpenAI API latency

3. **Payment Allocation:**
   - Successful auto-allocations
   - Unmatched payments (manual review needed)
   - Reference code match accuracy

### Troubleshooting

**Problem:** SMS not being captured

**Solutions:**

- Check battery optimization (whitelist app)
- Verify SMS permissions granted
- Check sender whitelist in plugin code
- Review Android logcat: `adb logcat | grep SmsIngest`

**Problem:** Backend not receiving SMS

**Solutions:**

- Verify network connectivity
- Check HMAC secret configuration
- Review Edge Function logs in Supabase
- Verify firewall/proxy settings

**Problem:** Parsing failures

**Solutions:**

- Review SMS format (may need regex update)
- Check OpenAI API key validity
- Increase OpenAI timeout
- Add new regex pattern for provider

## Updating the App

### Version Bump

Edit `apps/admin/android/app/build.gradle`:

```gradle
defaultConfig {
    ...
    versionCode 2  // Increment by 1
    versionName "1.1"  // Semantic versioning
}
```

### Release Process

1. Update version numbers
2. Build new release APK
3. Test on devices
4. Distribute via Firebase/MDM
5. Notify staff of update
6. Monitor rollout for issues

## Security Considerations

### Keystore Management

- **Never commit keystore to Git**
- Store in encrypted vault or secrets manager
- Use different keystores for debug/release
- Document keystore passwords securely
- Keep backup of keystore in multiple secure locations

### Distribution Security

- Use Firebase App Distribution or MDM (not public links)
- Verify APK signature before distribution
- Use internal email/portal for distribution
- Track which staff have which version

### Runtime Security

- All API calls use HTTPS + HMAC
- Phone numbers encrypted before storage
- Sensitive data redacted from logs
- No service keys in client

## Compliance & Legal

### Privacy Requirements

- Explicit user consent before SMS access
- Clear privacy policy
- Data minimization (only mobile money SMS)
- Right to disable at any time
- Data retention policy disclosure

### Android Policies

- SMS permissions justified (financial app exemption)
- Internal distribution only (no Google Play)
- Proper permission request flows
- Runtime permission handling
- Background work policies compliant

## Support

For issues during deployment:

1. Check build logs for errors
2. Review Android logcat output
3. Consult Supabase Edge Function logs
4. Contact Ibimina technical support

---

**Last Updated:** October 31, 2025  
**Version:** 1.0  
**Maintained by:** Ibimina Development Team
