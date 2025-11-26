#!/bin/bash

# Resize icons using macOS sips tool

set -e

SOURCE="public/icons/icon-192.png"
TARGET_DIR="src-tauri/icons"

mkdir -p "$TARGET_DIR"

echo "🖼️  Resizing icons using sips..."

# Create 32x32
sips -z 32 32 "$SOURCE" --out "$TARGET_DIR/32x32.png" > /dev/null 2>&1
echo "  ✅ 32x32.png"

# Create 128x128  
sips -z 128 128 "$SOURCE" --out "$TARGET_DIR/128x128.png" > /dev/null 2>&1
echo "  ✅ 128x128.png"

echo "✅ Icon resizing complete!"
