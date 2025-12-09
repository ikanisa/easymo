> **⚠️ DEPRECATION NOTICE**: This document has been consolidated into [docs/ANDROID.md](docs/ANDROID.md). Please refer to the consolidated guide for up-to-date information.

---

# Android Build Fixes for Capacitor 7

## Problem Summary

The Android build was failing with multiple dependency conflicts and compilation
errors when using Capacitor 7.4.4 with Android SDK 35.

## Root Causes

### 1. Java Version Mismatch

- **Issue**: Capacitor 7 requires Java 21, but the build was using Java 17
- **Error**: `error: invalid source release: 21`
- **Fix**: Updated `app/build.gradle` to use Java 21

### 2. Dependency Version Conflicts

- **Issue**: `failOnVersionConflict()` was too strict, causing AndroidX
  dependency conflicts
- **Errors**:
  - `androidx.test:monitor` version conflict (1.7.1 vs 1.7.0)
  - `androidx.activity:activity` version conflict (1.9.2 vs 1.7.0 vs 1.5.1)
  - Multiple other AndroidX conflicts
- **Fix**: Removed `failOnVersionConflict()` and added force resolutions for
  conflicting dependencies

### 3. Missing Maven Repositories

- **Issue**: Google Maven and Maven Central not declared in app-level
  `build.gradle`
- **Error**: `Could not find com.capacitorjs:capacitor-bom:5.7.4`
- **Fix**: Added `google()` and `mavenCentral()` to `repositories` block

### 4. Kotlin Compilation Errors

Multiple custom plugins had compilation errors:

#### EnhancedNotificationsPlugin.kt

- **Error**: Duplicate companion object definitions
- **Fix**: Merged two companion objects into one
- **Error**: Missing override modifiers for `checkPermissions` and
  `requestPermissions`
- **Fix**: Added `override` keyword
- **Error**: Missing imports for `JSONArray` and `PermissionCallback`
- **Fix**: Added missing imports

#### SmsIngestPlugin.kt

- **Error**: Missing override modifiers for permission methods
- **Fix**: Added `override` to `checkPermissions`, `requestPermissions`, and
  `hasPermission`
- **Error**: Unresolved `PermissionCallback` annotation
- **Fix**: Added `import com.getcapacitor.annotation.PermissionCallback`
- **Error**: Type mismatch with `getInt()` and `getLong()` returning nullable
  types
- **Fix**: Changed to use Elvis operator (`?.` and `?: defaultValue`)

#### ChallengeSigner.kt

- **Error**: Unresolved reference to `JSONArray`
- **Fix**: Added `import org.json.JSONArray`

## Files Modified

### 1. `/apps/admin/android/build.gradle`

```gradle
// REMOVED: failOnVersionConflict()
// ADDED: Force resolutions for AndroidX dependencies
subprojects {
    configurations.all { config ->
        config.resolutionStrategy {
            force 'androidx.test:monitor:1.7.1'
            force 'androidx.concurrent:concurrent-futures:1.1.0'
            // ... other force resolutions
        }
    }
}
```

### 2. `/apps/admin/android/dependencies-constraints.gradle`

```gradle
// UPDATED: Added missing AndroidX dependencies
force 'androidx.core:core:1.15.0'  // Updated from 1.13.0
force 'androidx.webkit:webkit:1.12.1'
force 'androidx.exifinterface:exifinterface:1.3.7'
// ... other dependencies
```

### 3. `/apps/admin/android/variables.gradle`

```gradle
// ADDED: Missing dependency versions
androidxExifInterfaceVersion = '1.3.7'
firebaseMessagingVersion = '24.1.0'
googleMaterialVersion = '1.12.0'
```

### 4. `/apps/admin/android/app/build.gradle`

```gradle
// UPDATED: Java version from 17 to 21
compileOptions {
    sourceCompatibility JavaVersion.VERSION_21
    targetCompatibility JavaVersion.VERSION_21
}
kotlinOptions {
    jvmTarget = "21"
}

// ADDED: Maven repositories
repositories {
    google()
    mavenCentral()
    flatDir {
        dirs '../capacitor-cordova-android-plugins/src/main/libs', 'libs'
    }
}
```

### 5. `/apps/admin/android/app/src/main/java/rw/ibimina/staff/plugins/EnhancedNotificationsPlugin.kt`

```kotlin
// ADDED: Missing imports
import com.getcapacitor.annotation.PermissionCallback
import org.json.JSONArray

// MERGED: Two companion objects into one
private companion object {
    const val CHANNEL_ID_DEFAULT = "ibimina_default"
    // ... other constants
    const val REQUEST_CODE_NOTIFICATIONS = 10001
}

// ADDED: Override modifiers
@PluginMethod
override fun checkPermissions(call: PluginCall) { ... }

@PluginMethod
override fun requestPermissions(call: PluginCall) { ... }
```

### 6. `/apps/admin/android/app/src/main/java/rw/ibimina/staff/plugins/SmsIngestPlugin.kt`

```kotlin
// ADDED: Missing import
import com.getcapacitor.annotation.PermissionCallback

// ADDED: Override modifiers
@PluginMethod
override fun checkPermissions(call: PluginCall) { ... }

@PluginMethod
override fun requestPermissions(call: PluginCall) { ... }

override fun hasPermission(permission: String): Boolean { ... }

// FIXED: Type mismatches
val limit = call.getInt("limit") ?: 50  // Was: call.getInt("limit", 50)
val sinceTimestamp = call.getLong("since") ?: getLastSyncTime()  // Was: call.getLong("since", getLastSyncTime())
```

### 7. `/apps/admin/android/app/src/main/java/rw/ibimina/staff/plugins/auth/ChallengeSigner.kt`

```kotlin
// ADDED: Missing import
import org.json.JSONArray
```

### 8. `/apps/admin/build-android.sh` (NEW)

```bash
#!/bin/bash
# Helper script to build Android app with correct Java version
export JAVA_HOME=/Library/Java/JavaVirtualMachines/openjdk-21.jdk/Contents/Home
export PATH="$JAVA_HOME/bin:$PATH"

cd "$(dirname "$0")/android"
./gradlew clean
./gradlew assembleDebug
```

## Build Requirements

### Prerequisites

1. **Java 21** (required for Capacitor 7)
   - Location: `/Library/Java/JavaVirtualMachines/openjdk-21.jdk/`
   - Set `JAVA_HOME` before building

2. **Android SDK 35** (API 35 - Android 15 "Vanilla Ice Cream")
   - Already installed at
     `/Users/jeanbosco/Library/Android/sdk/platforms/android-35`

3. **Gradle 8.6+**
   - Already configured via wrapper

### Build Commands

#### Option 1: Using build script

```bash
cd /Users/jeanbosco/workspace/ibimina/apps/admin
./build-android.sh
```

#### Option 2: Manual build

```bash
export JAVA_HOME=/Library/Java/JavaVirtualMachines/openjdk-21.jdk/Contents/Home
cd /Users/jeanbosco/workspace/ibimina/apps/admin/android
./gradlew clean assembleDebug
```

#### Option 3: From monorepo root (add to package.json)

```bash
# Add to apps/admin/package.json:
"scripts": {
  "android:build": "./build-android.sh",
  "android:clean": "cd android && ./gradlew clean"
}

# Then run:
pnpm --filter @ibimina/admin android:build
```

## Build Output

**APK Location**:
`/apps/admin/android/app/build/outputs/apk/debug/app-debug.apk`  
**APK Size**: 7.5MB  
**Build Time**: ~1 minute 37 seconds (after clean)

## Warnings (Non-blocking)

The build produces several warnings but completes successfully:

1. **Deprecated APIs**: `pluginRequestPermissions` and
   `handleRequestPermissionsResult` are deprecated
   - These are Capacitor internal APIs; will be updated in future Capacitor
     releases

2. **WorkManager Policy**: `REPLACE` policy is deprecated in favor of `UPDATE`
   - Used in SmsIngestPlugin background sync
   - Non-critical, can be updated later

3. **Unused Variables**: Minor code quality warnings
   - `exp` variable in ChallengeSigner
   - `userId` parameter in DeviceKeyManager

## Testing

After build, verify the APK:

```bash
# Check APK exists
ls -lh apps/admin/android/app/build/outputs/apk/debug/app-debug.apk

# Install on connected device/emulator
cd apps/admin/android
./gradlew installDebug

# Or use adb directly
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

## CI/CD Integration

To use in CI pipelines:

```yaml
# GitHub Actions example
- name: Set up JDK 21
  uses: actions/setup-java@v3
  with:
    distribution: "temurin"
    java-version: "21"

- name: Build Android APK
  working-directory: apps/admin/android
  run: ./gradlew assembleDebug
```

## Future Improvements

1. **Update Deprecations**: Replace deprecated Capacitor permission APIs when
   new versions are released
2. **Optimize Dependencies**: Review and minimize AndroidX dependency footprint
3. **Code Quality**: Fix unused variable warnings
4. **Build Optimization**: Consider enabling R8 minification for release builds
5. **Split APKs**: Generate separate APKs per ABI to reduce download size

## References

- [Capacitor 7 Android Requirements](https://capacitorjs.com/docs/android)
- [Android Gradle Plugin 8.4 Release Notes](https://developer.android.com/build/releases/gradle-plugin)
- [AndroidX Library Versions](https://developer.android.com/jetpack/androidx/versions)
