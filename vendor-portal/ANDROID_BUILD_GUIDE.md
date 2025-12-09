> **⚠️ DEPRECATION NOTICE**: This document has been consolidated into [docs/ANDROID.md](docs/ANDROID.md). Please refer to the consolidated guide for up-to-date information.

---

# Capacitor Android Build - Quick Reference

## ✅ FIXED: All dependency conflicts resolved

### Key Changes Made

1. **Java Version:** 21 → 17 (required for Capacitor 7)
2. **AndroidX Versions:** Downgraded to SDK 34 compatible versions
3. **Capacitor Config:** Using JS file instead of TS
4. **Gradle Strategy:** Added force resolutions for consistent dependencies

---

## Build Commands

### Development Build

```bash
cd /Users/jeanbosco/workspace/ibimina/apps/admin

# Sync Capacitor
npx cap sync android

# Build debug APK
cd android && ./gradlew assembleDebug
```

### Clean Rebuild

```bash
cd /Users/jeanbosco/workspace/ibimina/apps/admin/android
./gradlew clean
cd .. && npx cap sync android
cd android && ./gradlew assembleDebug
```

### Install on Device

```bash
# Connect device or start emulator, then:
cd /Users/jeanbosco/workspace/ibimina/apps/admin/android
./gradlew installDebug
```

### Open in Android Studio

```bash
cd /Users/jeanbosco/workspace/ibimina/apps/admin
npx cap open android
```

---

## Build Output

**Location:** `apps/admin/android/app/build/outputs/apk/debug/app-debug.apk`  
**Size:** ~158 MB (debug with symbols)

---

## Current Configuration

### Versions (variables.gradle)

```gradle
compileSdkVersion = 34
targetSdkVersion = 34
minSdkVersion = 23

androidxAppCompatVersion = '1.6.1'
androidxCoreVersion = '1.12.0'
androidxActivityVersion = '1.8.2'
androidxFragmentVersion = '1.6.2'
androidxWebkitVersion = '1.9.0'
firebaseMessagingVersion = '23.4.1'
kotlinVersion = '1.9.24'
```

### Java Configuration

```gradle
sourceCompatibility = JavaVersion.VERSION_17
targetCompatibility = JavaVersion.VERSION_17
jvmTarget = '17'
```

---

## Troubleshooting

### "Could not resolve dependencies"

```bash
cd apps/admin/android
./gradlew clean
./gradlew --refresh-dependencies assembleDebug
```

### "Duplicate class found"

```bash
# Check dependency tree
./gradlew :app:dependencies --configuration debugRuntimeClasspath
```

### "Invalid source release: 21"

- Already fixed: Using Java 17 now
- Verify: Check `app/build.gradle` has `JavaVersion.VERSION_17`

### Capacitor sync fails

```bash
# Use JS config instead of TS
cd apps/admin
[ ! -f capacitor.config.js ] && echo "module.exports = require('./capacitor.config.ts.bak')" > capacitor.config.js
npx cap sync android
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Set up JDK 17
  uses: actions/setup-java@v4
  with:
    java-version: "17"
    distribution: "temurin"

- name: Build Android
  run: |
    cd apps/admin
    npx cap sync android
    cd android
    ./gradlew assembleDebug

- name: Upload APK
  uses: actions/upload-artifact@v4
  with:
    name: app-debug
    path: apps/admin/android/app/build/outputs/apk/debug/app-debug.apk
```

---

## Success Indicators

✅ `BUILD SUCCESSFUL in Xs`  
✅ APK generated at `app/build/outputs/apk/debug/app-debug.apk`  
✅ No "Could not resolve" errors  
✅ No "Duplicate class" errors  
✅ No "Invalid source release" errors

---

## Next Steps

1. **Test on device:** `./gradlew installDebug`
2. **Setup signing:** Configure release keys for Play Store
3. **Optimize build:** Enable R8, reduce APK size
4. **Add CI/CD:** Automate builds on GitHub Actions

**Status:** 🎉 **READY FOR DEVELOPMENT**

---

Last Updated: Nov 3, 2025  
Build Status: ✅ Passing  
Capacitor Version: 7.4.4  
Target SDK: 34
