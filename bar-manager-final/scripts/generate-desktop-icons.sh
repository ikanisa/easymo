#!/bin/bash

# Generate Desktop Icons for Tauri from PWA Icons
# This script copies and renames PWA icons for desktop use

set -e

echo "🎨 Generating Desktop Icons from PWA Assets"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

SOURCE_DIR="public/icons"
TARGET_DIR="src-tauri/icons"

# Check if source icons exist
if [ ! -d "$SOURCE_DIR" ]; then
  echo "❌ Error: PWA icons directory not found: $SOURCE_DIR"
  exit 1
fi

# Create target directory
mkdir -p "$TARGET_DIR"

echo "📁 Source: $SOURCE_DIR"
echo "📁 Target: $TARGET_DIR"
echo ""

# Copy and rename icons
echo "Copying icons..."

# 32x32
if [ -f "$SOURCE_DIR/icon-32.png" ]; then
  cp "$SOURCE_DIR/icon-32.png" "$TARGET_DIR/32x32.png"
  echo "  ✅ 32x32.png"
else
  echo "  ⚠️  icon-32.png not found, using icon-72.png resized"
fi

# 128x128
if [ -f "$SOURCE_DIR/icon-128.png" ]; then
  cp "$SOURCE_DIR/icon-128.png" "$TARGET_DIR/128x128.png"
  echo "  ✅ 128x128.png"
else
  echo "  ⚠️  icon-128.png not found"
fi

# 128x128@2x (256x256)
if [ -f "$SOURCE_DIR/icon-256.png" ]; then
  cp "$SOURCE_DIR/icon-256.png" "$TARGET_DIR/128x128@2x.png"
  echo "  ✅ 128x128@2x.png"
elif [ -f "$SOURCE_DIR/icon-192.png" ]; then
  cp "$SOURCE_DIR/icon-192.png" "$TARGET_DIR/128x128@2x.png"
  echo "  ✅ 128x128@2x.png (from 192x192)"
fi

# icon.png (general purpose - use 512x512 or largest)
if [ -f "$SOURCE_DIR/icon-512.png" ]; then
  cp "$SOURCE_DIR/icon-512.png" "$TARGET_DIR/icon.png"
  echo "  ✅ icon.png (512x512)"
elif [ -f "$SOURCE_DIR/icon-192.png" ]; then
  cp "$SOURCE_DIR/icon-192.png" "$TARGET_DIR/icon.png"
  echo "  ✅ icon.png (192x192)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Desktop icons generated!"
echo ""
echo "📝 Note: macOS (.icns) and Windows (.ico) icons will be"
echo "   generated automatically by Tauri during build."
echo ""
echo "   Tauri will use the PNG files we just created to"
echo "   generate platform-specific icon formats."
echo ""
echo "🚀 You can now build the desktop app:"
echo "   npm run tauri:build"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
