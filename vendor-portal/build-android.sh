#!/bin/bash
set -e

# Use Java 21 for Capacitor 7
export JAVA_HOME=/Library/Java/JavaVirtualMachines/openjdk-21.jdk/Contents/Home
export PATH="$JAVA_HOME/bin:$PATH"

echo "Using Java: $(java -version 2>&1 | head -1)"

cd "$(dirname "$0")/android"

echo "Cleaning previous build..."
./gradlew clean

echo "Building debug APK..."
./gradlew assembleDebug

echo ""
echo "Build complete!"
ls -lh app/build/outputs/apk/debug/*.apk
