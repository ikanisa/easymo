> **⚠️ DEPRECATION NOTICE**: This document has been consolidated into [docs/ANDROID.md](docs/ANDROID.md). Please refer to the consolidated guide for up-to-date information.

---

# Android SMS Ingestion Implementation Guide

## Overview

This document describes the Android SMS ingestion feature for the Ibimina Staff
Console. This feature enables automatic processing of mobile money payment SMS
notifications from MTN MoMo and Airtel Money, streamlining payment
reconciliation for SACCO staff.

## Architecture

### Components

1. **Native Android Layer**
   - `SmsIngestPlugin.kt` - Capacitor plugin for SMS access
   - `SmsSyncWorker.kt` - Background worker for periodic sync
   - Permissions: `READ_SMS`, `RECEIVE_SMS`

2. **TypeScript Bridge**
   - `lib/native/sms-ingest.ts` - JavaScript interface to native plugin
   - Platform detection and fallback handling
   - React hooks for easy integration

3. **UI Components**
   - `app/settings/sms-consent/page.tsx` - Initial consent screen
   - `app/settings/sms-ingestion/page.tsx` - Settings management
   - `app/privacy/page.tsx` - Privacy policy

4. **Backend (Pre-existing)**
   - `supabase/functions/ingest-sms/` - SMS parsing and allocation
   - `supabase/functions/parse-sms/` - Regex and OpenAI parsing
   - Database tables: `sms_inbox`, `payments`

## Security & Privacy

### Data Minimization

- Only reads SMS from whitelisted senders (MTN, Airtel)
- No storage of SMS data on device
- Immediate forwarding to secure backend

### Encryption

- Phone numbers encrypted with AES-256 before storage
- Phone numbers hashed for deduplication
- All transmission over HTTPS with HMAC authentication

### User Control

- Explicit consent required before enabling
- Toggle to enable/disable in settings
- Clear privacy policy and data usage disclosure

### Compliance

- Meets Android SMS permission policies for internal distribution
- No Google Play submission required (sideloading)
- Compliant with financial app exemptions

## Installation & Setup

### Prerequisites

- Node.js 20+
- pnpm 10.19.0
- Android SDK and Android Studio
- Java 17+ (for Android builds)

### 1. Install Dependencies

```bash
cd apps/admin
pnpm add @capacitor/core @capacitor/cli @capacitor/android @capacitor/camera @capacitor/push-notifications @capacitor/device @capacitor/haptics @capacitor/preferences @capacitor/app
```

### 2. Initialize Capacitor (Already Done)

The `capacitor.config.ts` file is already configured:

- App ID: `rw.ibimina.staff`
- App Name: `Ibimina Staff`
- Web directory: `.next`

### 3. Build the Next.js App

```bash
# Set required environment variables
export NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
export NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
# ... other required vars

# Build the app
pnpm build
```

### 4. Sync with Android Project

```bash
npx cap sync android
```

### 5. Open in Android Studio

```bash
npx cap open android
```

### 6. Configure Signing

Edit `android/app/build.gradle`:

```gradle
android {
    signingConfigs {
        release {
            storeFile file(System.getenv("KEYSTORE_FILE") ?: "release.keystore")
            storePassword System.getenv("KEYSTORE_PASSWORD")
            keyAlias System.getenv("KEY_ALIAS")
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

### 7. Generate Release Keystore

```bash
keytool -genkey -v -keystore release.keystore -alias ibimina-staff -keyalg RSA -keysize 2048 -validity 10000
```

Store the keystore securely (e.g., GitHub encrypted secrets).

### 8. Build APK

```bash
cd android
./gradlew assembleRelease

# Output: app/build/outputs/apk/release/app-release.apk
```

## Distribution

### Option 1: Firebase App Distribution (Recommended)

1. Create Firebase project
2. Add Android app with package name `rw.ibimina.staff`
3. Install Firebase CLI: `npm install -g firebase-tools`
4. Deploy:

```bash
firebase appdistribution:distribute app/build/outputs/apk/release/app-release.apk \
  --app YOUR_APP_ID \
  --groups "staff-testers" \
  --release-notes "SMS ingestion feature for automatic payment processing"
```

### Option 2: Direct APK Distribution

1. Upload APK to secure server or cloud storage
2. Share download link with staff via email
3. Provide installation instructions (enable "Unknown sources")

### Option 3: MDM/EMM

Use your organization's Mobile Device Management solution to deploy the APK to
staff devices.

## Usage Flow

### First-Time Setup

1. Staff member installs APK on device
2. Opens app and navigates to Settings > SMS Consent
3. Reviews privacy policy and data usage details
4. Grants SMS permissions (READ_SMS, RECEIVE_SMS)
5. Feature is automatically enabled
6. Background sync starts (default: 15-minute intervals)

### Ongoing Operation

1. Staff member receives mobile money SMS
2. Background worker detects new SMS every 15 minutes
3. Messages from MTN/Airtel are filtered and read
4. SMS data sent to Supabase Edge Function via HTTPS
5. Edge Function parses SMS (regex + OpenAI fallback)
6. Payment is matched to member and allocated
7. Staff sees payment in dashboard

### Disabling

1. Navigate to Settings > SMS Ingestion
2. Toggle switch to disable
3. Background sync stops
4. No more SMS processing

## Testing

### Unit Testing (Plugin)

```bash
# Run Android instrumentation tests
cd android
./gradlew connectedAndroidTest
```

### Manual Testing Checklist

- [ ] Install APK on test device
- [ ] Grant SMS permissions
- [ ] Enable SMS ingestion
- [ ] Send test mobile money SMS to device
- [ ] Verify SMS appears in test read results
- [ ] Wait for background sync or trigger manually
- [ ] Check Supabase backend for ingested SMS
- [ ] Verify payment allocation in database
- [ ] Disable SMS ingestion
- [ ] Verify background sync stops
- [ ] Revoke SMS permissions and verify graceful handling

### Test SMS Messages

Use these sample messages for testing:

```
You have received RWF 5,000 from 0788123456 (John Doe). Ref: GIC.SACCO1.GRP001.MBR123. Balance: RWF 150,000. Txn ID: ABC123XYZ
```

```
Received RWF 10,000 from +250788123456. Ref: GIC.SACCO1.GRP002. ID: XYZ789ABC
```

## Troubleshooting

### Issue: Permissions Denied

**Solution:** Check Android app settings, ensure SMS permissions are granted. On
Android 13+, POST_NOTIFICATIONS may also be required.

### Issue: Background Sync Not Running

**Solution:** Check battery optimization settings. Add app to battery
optimization whitelist. Verify WorkManager constraints (network required).

### Issue: SMS Not Being Read

**Solution:** Verify sender whitelist in `SmsIngestPlugin.kt`. Check logcat for
errors: `adb logcat | grep SmsIngest`.

### Issue: Backend Not Receiving Data

**Solution:** Check network connectivity. Verify HMAC secret configuration.
Check Edge Function logs in Supabase dashboard.

### Issue: Parsing Failures

**Solution:** Check SMS format matches regex patterns in `parse-sms` function.
Verify OpenAI API key is configured. Check Edge Function logs for parsing
errors.

## Development

### Local Development

For local development with hot-reloading:

1. Start Next.js dev server:

```bash
cd apps/admin
pnpm dev
```

2. Update `capacitor.config.ts` to point to localhost:

```typescript
server: {
  url: 'http://10.0.2.2:3100', // Android emulator
  cleartext: true,
}
```

3. Sync and run:

```bash
npx cap sync android
npx cap run android
```

### Debugging

Enable WebView debugging in `MainActivity.java`:

```java
if (BuildConfig.DEBUG) {
    WebView.setWebContentsDebuggingEnabled(true);
}
```

Access Chrome DevTools: `chrome://inspect`

### Logs

View native logs:

```bash
adb logcat | grep -E "SmsIngest|SmsSyncWorker"
```

View Capacitor bridge logs:

```bash
adb logcat | grep Capacitor
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Build Android APK

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: "20"

      - name: Install pnpm
        run: npm install -g pnpm@10.19.0

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build Next.js
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY:
            ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          # ... other env vars
        run: |
          cd apps/admin
          pnpm build

      - name: Sync Capacitor
        run: |
          cd apps/admin
          npx cap sync android

      - name: Setup Java
        uses: actions/setup-java@v3
        with:
          distribution: "temurin"
          java-version: "17"

      - name: Build APK
        env:
          KEYSTORE_FILE: ${{ secrets.KEYSTORE_FILE }}
          KEYSTORE_PASSWORD: ${{ secrets.KEYSTORE_PASSWORD }}
          KEY_ALIAS: ${{ secrets.KEY_ALIAS }}
          KEY_PASSWORD: ${{ secrets.KEY_PASSWORD }}
        run: |
          cd apps/admin/android
          ./gradlew assembleRelease

      - name: Upload APK
        uses: actions/upload-artifact@v3
        with:
          name: ibimina-staff-release
          path: apps/admin/android/app/build/outputs/apk/release/app-release.apk

      - name: Deploy to Firebase App Distribution
        if: github.ref == 'refs/heads/main'
        run: |
          firebase appdistribution:distribute \
            apps/admin/android/app/build/outputs/apk/release/app-release.apk \
            --app ${{ secrets.FIREBASE_APP_ID }} \
            --groups "staff" \
            --release-notes "Build from commit ${{ github.sha }}"
```

## Maintenance

### Updating SMS Sender Whitelist

Edit `SmsIngestPlugin.kt` and `SmsSyncWorker.kt`:

```kotlin
private val ALLOWED_SENDERS = setOf(
    "MTN",
    "AIRTEL",
    "250788383383",  // MTN MoMo
    "250733333333",  // Airtel Money
    "NEW_SENDER"     // Add new sender
)
```

Rebuild and redistribute APK.

### Updating Sync Interval

Default interval can be changed in `SmsIngestPlugin.kt`:

```kotlin
val intervalMinutes = call?.getInt("intervalMinutes", 30) ?: 30  // Changed from 15 to 30
```

Users can also adjust in Settings UI.

### Monitoring

Monitor SMS ingestion health:

- Check Supabase Edge Function logs
- Monitor `sms_inbox` table for `status = 'FAILED'`
- Set up alerts for parse failures
- Track `sms_ingested` metric in analytics

## Support

For issues or questions:

- Check Supabase Edge Function logs
- Review Android logcat output
- Consult the Privacy Policy
- Contact SACCO administrator or Ibimina support team

## License

Proprietary - Ibimina SACCO Management Platform
