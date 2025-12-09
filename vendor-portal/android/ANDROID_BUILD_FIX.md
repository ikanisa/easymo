# Android Build Fix - Capacitor 7 Compatibility

## Date: November 3, 2025

## Problem Summary

The Android build was failing due to incompatibility between Capacitor 7.x and
the configured Android SDK versions and AndroidX dependencies.

### Key Errors Fixed:

1. **VANILLA_ICE_CREAM constant not found** - Required Android API 35
2. **Dependency conflicts** - Multiple AndroidX version mismatches
3. **Missing dependencies** - core-splashscreen version mismatch
4. **Gradle version incompatibility** - Old Gradle couldn't handle new AGP

## Changes Made

### 1. Updated `variables.gradle`

```gradle
ext {
    minSdkVersion = 26          // Was: 23 (Capacitor 7 requires 26+)
    compileSdkVersion = 35      // Was: 34 (Required for VANILLA_ICE_CREAM)
    targetSdkVersion = 35       // Was: 34
    androidxCoreVersion = '1.15.0'        // Was: 1.12.0
    androidxAppCompatVersion = '1.7.0'    // Was: 1.6.1
    androidxActivityVersion = '1.9.2'     // Was: 1.8.2
    androidxFragmentVersion = '1.8.4'     // Was: 1.6.2
    androidxWebkitVersion = '1.12.1'      // Was: 1.9.0
    firebaseMessagingVersion = '24.1.0'   // Was: 23.4.1
    googleMaterialVersion = '1.12.0'      // Was: 1.11.0
    coreSplashScreenVersion = '1.0.1'     // Kept (1.2.0 doesn't exist)
}
```

### 2. Updated `build.gradle` - Android Gradle Plugin

```gradle
dependencies {
    classpath 'com.android.tools.build:gradle:8.7.3'  // Was: 8.4.1
}
```

### 3. Updated `build.gradle` - Dependency Resolution Strategy

Added comprehensive `force` directives for all AndroidX dependencies:

```gradle
subprojects {
    configurations.all { config ->
        config.resolutionStrategy {
            force 'androidx.core:core:1.15.0'
            force 'androidx.core:core-splashscreen:1.0.1'  // Critical fix
            force 'androidx.appcompat:appcompat:1.7.0'
            force 'androidx.webkit:webkit:1.12.1'
            force 'androidx.fragment:fragment:1.8.4'
            force 'androidx.activity:activity:1.9.2'
            force 'androidx.coordinatorlayout:coordinatorlayout:1.2.0'
            force 'com.google.android.material:material:1.12.0'
            force 'com.google.firebase:firebase-messaging:24.1.0'
            // ... more dependencies
        }
    }
}
```

### 4. Updated Gradle Wrapper

```properties
distributionUrl=https\://services.gradle.org/distributions/gradle-8.11-bin.zip
# Was: gradle-8.6-bin.zip
```

## Build Success

```bash
cd apps/admin/android
./gradlew clean assembleDebug

# Result:
BUILD SUCCESSFUL in 5m 43s
269 actionable tasks: 239 executed, 27 from cache, 3 up-to-date
```

Output APK: `apps/admin/android/app/build/outputs/apk/debug/app-debug.apk`

## Warnings (Non-blocking)

The following warnings appear but don't prevent build success:

1. **Deprecated API usage** in `EnhancedNotificationsPlugin.kt`:
   - `pluginRequestPermissions` - deprecated in favor of new permission API
   - `handleRequestPermissionsResult` - deprecated

2. **WorkManager policy** in `SmsIngestPlugin.kt`:
   - `REPLACE` policy deprecated - should use `UPDATE` or `CANCEL_AND_REENQUEUE`

3. **Minor Kotlin warnings**:
   - Unused variables and unnecessary casts in auth plugins

## Testing Checklist

- [x] Build succeeds with `./gradlew assembleDebug`
- [ ] Install APK on physical device (API 26+)
- [ ] Test NFC reading functionality
- [ ] Test biometric authentication
- [ ] Test SMS permissions and reading
- [ ] Test camera and photo permissions
- [ ] Test push notifications (requires Firebase setup)
- [ ] Test offline/online sync

## Next Steps

### 1. Update Deprecated Code (Optional - Build works fine)

#### EnhancedNotificationsPlugin.kt

Replace:

```kotlin
pluginRequestPermissions(Array<String>, Int)
handleRequestPermissionsResult(Int, Array<String>, IntArray)
```

With Capacitor's new permission API:

```kotlin
requestPermissionForAlias("notifications", call, "notificationsPermissionCallback")
```

#### SmsIngestPlugin.kt

Replace:

```kotlin
ExistingWorkPolicy.REPLACE
```

With:

```kotlin
ExistingWorkPolicy.UPDATE  // or CANCEL_AND_REENQUEUE if you need old behavior
```

### 2. Test on Physical Devices

Requirements:

- **Minimum**: Android 8.0 (API 26)
- **Target**: Android 15 (API 35)
- **NFC**: Device with NFC hardware
- **Biometric**: Device with fingerprint/face unlock

### 3. Firebase Setup (For Push Notifications)

Ensure `google-services.json` is present:

```bash
ls apps/admin/android/app/google-services.json
```

If missing:

1. Go to Firebase Console
2. Download `google-services.json`
3. Place in `apps/admin/android/app/`

### 4. Build Release APK (When Ready)

```bash
cd apps/admin/android

# Ensure signing keys are configured
export ANDROID_KEYSTORE_PATH=path/to/keystore.jks
export ANDROID_KEYSTORE_PASSWORD=yourKeystorePassword
export ANDROID_KEY_ALIAS=yourKeyAlias
export ANDROID_KEY_PASSWORD=yourKeyPassword

./gradlew assembleRelease
```

## Troubleshooting

### Build Still Fails?

1. **Clean everything**:

   ```bash
   cd apps/admin/android
   rm -rf .gradle build app/build capacitor-*/build
   ./gradlew clean
   ```

2. **Update Capacitor** (if needed):

   ```bash
   cd apps/admin
   pnpm update @capacitor/android @capacitor/core
   npx cap sync android
   ```

3. **Check Java version**:

   ```bash
   java -version  # Should be Java 17
   ```

4. **Android SDK**: Ensure Android SDK 35 is installed via Android Studio SDK
   Manager

### App Crashes on Launch?

Check Logcat:

```bash
adb logcat | grep -E "AndroidRuntime|Capacitor|Ibimina"
```

Common issues:

- Missing permissions in AndroidManifest.xml
- Supabase credentials not configured
- Firebase not initialized (if using push)

## Version Requirements

| Component             | Version | Notes                           |
| --------------------- | ------- | ------------------------------- |
| Capacitor             | 7.4.4+  | Core framework                  |
| Android Gradle Plugin | 8.7.3+  | Build tool                      |
| Gradle                | 8.11+   | Build system                    |
| compileSdk            | 35      | Android API level               |
| targetSdk             | 35      | Target API level                |
| minSdk                | 26      | Minimum supported (Android 8.0) |
| Java                  | 17      | JDK version                     |
| Kotlin                | 1.9.24  | Language version                |

## Resources

- [Capacitor 7 Migration Guide](https://capacitorjs.com/docs/updating/7-0)
- [Android API 35 Release Notes](https://developer.android.com/about/versions/15)
- [AndroidX Version Compatibility](https://developer.android.com/jetpack/androidx/versions)

## Conclusion

✅ **Build is now working** with Capacitor 7 and Android API 35.

The app successfully compiles to a debug APK. Next steps are to test on physical
hardware and address any runtime issues that may appear.

---

**Fixed by**: GitHub Copilot Agent  
**Date**: November 3, 2025  
**Build Time**: ~5-6 minutes (clean build)  
**Output**: `app-debug.apk` (~50-70 MB)
