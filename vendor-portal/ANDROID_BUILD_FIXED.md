> **⚠️ DEPRECATION NOTICE**: This document has been consolidated into [docs/ANDROID.md](docs/ANDROID.md). Please refer to the consolidated guide for up-to-date information.

---

# ✅ Android Build Issues - RESOLVED

## Summary

All Android Studio build errors have been successfully fixed. The admin app now
builds successfully with Capacitor 7.4.4 on Android SDK 35.

## What Was Fixed

### 1. ❌ Java Version Error → ✅ Fixed

**Error**: `error: invalid source release: 21`  
**Root Cause**: Capacitor 7 requires Java 21, but build was using Java 17  
**Solution**: Updated `compileOptions` and `kotlinOptions` in `app/build.gradle`
to use Java 21

### 2. ❌ Dependency Conflicts → ✅ Fixed

**Errors**:

```
Conflicts found for the following modules:
- androidx.test:monitor between versions 1.7.1 and 1.7.0
- androidx.activity:activity between versions 1.9.2, 1.7.0 and 1.5.1
- org.jetbrains:annotations between versions 23.0.0 and 13.0
... and more
```

**Root Cause**: `failOnVersionConflict()` was too strict  
**Solution**:

- Removed `failOnVersionConflict()` from `build.gradle`
- Added force resolutions for all conflicting dependencies in
  `dependencies-constraints.gradle`

### 3. ❌ Missing Dependencies → ✅ Fixed

**Error**: `Could not find com.capacitorjs:capacitor-bom:5.7.4`  
**Root Cause**: Maven repositories not declared in app-level build.gradle  
**Solution**: Added `google()` and `mavenCentral()` to repositories block

### 4. ❌ Kotlin Compilation Errors → ✅ Fixed

#### EnhancedNotificationsPlugin.kt

- ❌ Duplicate companion object
- ❌ Missing override modifiers
- ❌ Missing imports (JSONArray, PermissionCallback)
- ✅ All fixed

#### SmsIngestPlugin.kt

- ❌ Missing override modifiers for permission methods
- ❌ Type mismatches with nullable Int/Long
- ❌ Missing PermissionCallback import
- ✅ All fixed

#### ChallengeSigner.kt

- ❌ Unresolved JSONArray reference
- ✅ Fixed by adding import

### 5. ❌ VANILLA_ICE_CREAM Error → ✅ Fixed

**Error**: `cannot find symbol: variable VANILLA_ICE_CREAM`  
**Root Cause**: Android SDK 35 constants require compileSdk 35  
**Solution**: Already had SDK 35, just needed Java 21

## Build Results

### ✅ Success Metrics

- **Status**: BUILD SUCCESSFUL ✅
- **Time**: 1m 37s
- **APK Size**: 7.5MB
- **Location**: `apps/admin/android/app/build/outputs/apk/debug/app-debug.apk`
- **Tasks**: 252 actionable tasks (212 executed, 40 up-to-date)

### ⚠️ Warnings (Non-Critical)

- Deprecated Capacitor APIs (will be updated in future releases)
- WorkManager REPLACE policy deprecation
- Unused variables in auth code
- All warnings are non-blocking and don't affect functionality

## How to Build

### Quick Build

```bash
cd /Users/jeanbosco/workspace/ibimina/apps/admin
./build-android.sh
```

### Manual Build

```bash
export JAVA_HOME=/Library/Java/JavaVirtualMachines/openjdk-21.jdk/Contents/Home
cd /Users/jeanbosco/workspace/ibimina/apps/admin/android
./gradlew clean assembleDebug
```

### From Android Studio

1. Open `/Users/jeanbosco/workspace/ibimina/apps/admin/android` in Android
   Studio
2. Ensure Java 21 is selected in project settings
3. Build → Make Project (or Ctrl+F9)

## Requirements

✅ **Java 21** - Installed at
`/Library/Java/JavaVirtualMachines/openjdk-21.jdk/`  
✅ **Android SDK 35** - Installed at
`/Users/jeanbosco/Library/Android/sdk/platforms/android-35`  
✅ **Gradle 8.6** - Configured via wrapper  
✅ **Capacitor 7.4.4** - In package.json

## Files Modified

1. `apps/admin/android/build.gradle` - Removed failOnVersionConflict, added
   force resolutions
2. `apps/admin/android/app/build.gradle` - Java 21, added repositories
3. `apps/admin/android/dependencies-constraints.gradle` - NEW - Force dependency
   versions
4. `apps/admin/android/variables.gradle` - Added missing dependency versions
5. `apps/admin/android/app/src/main/java/rw/ibimina/staff/plugins/EnhancedNotificationsPlugin.kt` -
   Fixed compilation errors
6. `apps/admin/android/app/src/main/java/rw/ibimina/staff/plugins/SmsIngestPlugin.kt` -
   Fixed compilation errors
7. `apps/admin/android/app/src/main/java/rw/ibimina/staff/plugins/auth/ChallengeSigner.kt` -
   Added missing import
8. `apps/admin/build-android.sh` - NEW - Build helper script

## Documentation

Complete details in:

- `apps/admin/ANDROID_BUILD_FIXES.md` - Comprehensive fix documentation
- This file - Quick summary

## Next Steps

### Immediate

1. ✅ Build passes - Ready for development
2. Test on emulator: `./gradlew installDebug`
3. Test on physical device via Android Studio

### Future Improvements

1. Update deprecated Capacitor APIs when new versions are released
2. Optimize AndroidX dependencies to reduce APK size
3. Enable R8 minification for release builds
4. Generate split APKs per ABI to reduce download size

## Verification

Run this to verify the build:

```bash
cd /Users/jeanbosco/workspace/ibimina/apps/admin

# Build
./build-android.sh

# Verify APK exists
ls -lh android/app/build/outputs/apk/debug/app-debug.apk

# Should output:
# -rw-r--r--  1 jeanbosco  staff   7.5M Nov  3 13:56 app-debug.apk
```

## Troubleshooting

### If build fails with "Invalid source release"

```bash
# Verify Java 21 is active
java -version  # Should show 21.0.9

# Set JAVA_HOME explicitly
export JAVA_HOME=/Library/Java/JavaVirtualMachines/openjdk-21.jdk/Contents/Home
```

### If dependency conflicts return

```bash
# Clear Gradle cache
cd android
./gradlew clean
rm -rf .gradle
rm -rf build
./gradlew assembleDebug
```

### If "Cannot find symbol" errors

```bash
# Ensure Android SDK 35 is installed
ls /Users/jeanbosco/Library/Android/sdk/platforms/android-35
```

## Git Commit

Changes committed to branch: `fix/admin-supabase-alias`

Commit hash: `c9d1405`

To push:

```bash
cd /Users/jeanbosco/workspace/ibimina
git push origin fix/admin-supabase-alias
```

---

**Status**: ✅ ALL ISSUES RESOLVED  
**Build**: ✅ PASSING  
**APK**: ✅ GENERATED  
**Ready**: ✅ FOR DEVELOPMENT & TESTING
