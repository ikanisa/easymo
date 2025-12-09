# Ibimina Staff Mobile App (Android)

## ✅ Project Status: Ready to Build

The Android mobile app for staff is **fully configured and ready to build**. The
Capacitor Android project has been set up with all necessary plugins and
configurations.

## 📱 App Configuration

- **App Name**: Ibimina Staff
- **Package ID**: `rw.ibimina.staff`
- **App ID**: `rw.ibimina.staff`
- **Platform**: Android
- **Min SDK**: 22 (Android 5.1 Lollipop)
- **Target SDK**: 34 (Android 14)
- **Current Server**:
  `https://4095a3b5-fbd8-407c-bbf4-c6a12f21341e-00-2ss8fo7up7zir.kirk.replit.dev`

## 🎯 What's Included

### Native Plugins Installed

- ✅ **@capacitor/app** (7.1.0) - App lifecycle events
- ✅ **@capacitor/camera** (7.0.2) - Camera access for ID uploads
- ✅ **@capacitor/device** (7.0.2) - Device information
- ✅ **@capacitor/haptics** (7.0.2) - Haptic feedback
- ✅ **@capacitor/preferences** (7.0.2) - Secure local storage
- ✅ **@capacitor/push-notifications** (7.0.3) - Push notifications

### App Features

- 🔐 Secure HTTPS connection to Admin PWA server
- 🎨 Atlas Blue branding (splash screen & theme)
- 📵 Offline data caching
- 🔔 Push notification support
- 📸 Camera integration for staff workflows
- 💾 Local data persistence
- 🌙 Dark mode support

## 🏗️ Building Options

### Option 1: Local Build (5 minutes)

**Best for**: Immediate APK creation, full control

See [BUILD_APK_INSTRUCTIONS.md](./BUILD_APK_INSTRUCTIONS.md) for detailed steps.

**Quick Commands:**

```bash
cd apps/admin
npx cap sync android
cd android
./gradlew assembleDebug
# APK at: android/app/build/outputs/apk/debug/app-debug.apk
```

**Requirements:**

- Java JDK 17
- Android SDK (or Android Studio)

### Option 2: GitHub Actions (Automated)

**Best for**: CI/CD, team collaboration, release automation

We've created `.github/workflows/build-android-staff-apk.yml` for you.

**To use:**

1. Push code to GitHub
2. Go to Actions tab
3. Run "Build Staff Android APK" workflow
4. Download APK from Artifacts

**Features:**

- ✅ Builds on every push
- ✅ Auto-uploads APK artifacts
- ✅ Creates releases for tags
- ✅ Configurable server URL
- ✅ Both debug & release builds

### Option 3: Cloud Build Service

**Best for**: No local setup needed

Use services like:

- **Codemagic**: https://codemagic.io (Free tier available)
- **Bitrise**: https://bitrise.io (Free tier available)
- **App Center**: https://appcenter.ms (Microsoft)

Connect your repo and they'll build automatically.

## 📂 Project Structure

```
apps/admin/
├── android/                    # Native Android project
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── AndroidManifest.xml
│   │   │   ├── java/          # Native Android code
│   │   │   ├── res/           # App icons, splash screens
│   │   │   └── assets/
│   │   │       └── public/    # Web assets (synced from .next-static)
│   │   └── build.gradle
│   └── gradlew                # Gradle wrapper for building
├── .next-static/              # Web assets for Capacitor
│   └── index.html            # Entry point (redirects to server)
├── capacitor.config.ts       # Capacitor configuration
├── BUILD_APK_INSTRUCTIONS.md # Detailed build guide
└── STAFF_MOBILE_APP_README.md # This file
```

## 🔧 Configuration

### Change Server URL

To point the app to your production server:

1. **Edit `capacitor.config.ts`:**

```typescript
server: {
  url: "https://staff.ibimina.rw",  // Your production URL
}
```

2. **Resync and rebuild:**

```bash
npx cap sync android
cd android && ./gradlew assembleDebug
```

### Update App Name/Icon

1. **App Name**: Edit `android/app/src/main/res/values/strings.xml`
2. **App Icon**: Replace images in `android/app/src/main/res/mipmap-*/`
3. **Splash Screen**: Edit `android/app/src/main/res/drawable-*/splash.png`

### Customize Theme Colors

Edit `android/app/src/main/res/values/styles.xml`:

```xml
<item name="colorPrimary">#0066FF</item>      <!-- Atlas Blue -->
<item name="colorPrimaryDark">#0052CC</item>  <!-- Atlas Blue Dark -->
```

## 🚀 Next Steps

### For Development Testing

1. Build debug APK (see BUILD_APK_INSTRUCTIONS.md)
2. Install on Android device
3. Test staff workflows

### For Production Release

1. Create signing keystore
2. Configure release build in `android/app/build.gradle`
3. Build signed release APK
4. Submit to Google Play Store

See BUILD_APK_INSTRUCTIONS.md for signing instructions.

## 🔐 Security Notes

- ✅ HTTPS enforced for all server connections
- ✅ Cleartext traffic disabled (except for dev builds)
- ✅ Mixed content blocked
- ✅ Certificate pinning ready (configure in capacitor.config.ts)
- ⚠️ Debug APKs are not signed - use only for testing
- ⚠️ Release APKs must be signed before distribution

## 📱 Testing the App

### On Physical Device

1. Enable Developer Options on your Android device
2. Enable USB Debugging
3. Connect via USB
4. Run: `cd apps/admin/android && ./gradlew installDebug`

### On Emulator

1. Start Android Emulator from Android Studio
2. Run: `cd apps/admin/android && ./gradlew installDebug`

### Via Capacitor CLI

```bash
cd apps/admin
npx cap run android
```

## 🐛 Troubleshooting

### "SDK location not found"

Create `android/local.properties`:

```
sdk.dir=/path/to/Android/Sdk
```

### "Permission denied: gradlew"

```bash
chmod +x android/gradlew
```

### "Build failed - dependencies"

```bash
cd android
./gradlew clean build --refresh-dependencies
```

### APK Won't Install

- Check minimum Android version (5.1+)
- Enable "Install from Unknown Sources"
- Uninstall previous version first

## 📞 Support

For build issues:

- Check BUILD_APK_INSTRUCTIONS.md
- See Capacitor docs: https://capacitorjs.com/docs/android
- Check Gradle docs: https://docs.gradle.org

For app functionality:

- Test the Admin PWA first at the server URL
- Check browser console for errors
- Verify server is accessible from mobile network

## 📄 License

© 2025 Ibimina. All rights reserved.
