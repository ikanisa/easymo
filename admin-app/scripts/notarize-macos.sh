#!/usr/bin/env bash
# macOS Notarization Script
# Automates the notarization process for macOS builds

set -e

DMG_PATH="$1"

if [ -z "$DMG_PATH" ]; then
    echo "❌ Usage: $0 <path-to-dmg>"
    exit 1
fi

if [ ! -f "$DMG_PATH" ]; then
    echo "❌ Error: DMG file not found: $DMG_PATH"
    exit 1
fi

# Check required environment variables
if [ -z "$APPLE_ID" ] || [ -z "$APPLE_ID_PASSWORD" ] || [ -z "$APPLE_TEAM_ID" ]; then
    echo "❌ Error: Required environment variables not set"
    echo "   Required: APPLE_ID, APPLE_ID_PASSWORD, APPLE_TEAM_ID"
    exit 1
fi

echo "🍎 EasyMO Admin - macOS Notarization"
echo "===================================="
echo ""
echo "📦 DMG: $DMG_PATH"
echo "👤 Apple ID: $APPLE_ID"
echo "🏢 Team ID: $APPLE_TEAM_ID"
echo ""

# Submit for notarization
echo "📤 Submitting for notarization..."
SUBMISSION_ID=$(xcrun notarytool submit "$DMG_PATH" \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_ID_PASSWORD" \
  --team-id "$APPLE_TEAM_ID" \
  --wait \
  --output-format json | jq -r '.id')

if [ -z "$SUBMISSION_ID" ] || [ "$SUBMISSION_ID" = "null" ]; then
    echo "❌ Notarization submission failed"
    exit 1
fi

echo "✅ Submission ID: $SUBMISSION_ID"
echo ""

# Check status
echo "🔍 Checking notarization status..."
STATUS=$(xcrun notarytool info "$SUBMISSION_ID" \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_ID_PASSWORD" \
  --team-id "$APPLE_TEAM_ID" \
  --output-format json | jq -r '.status')

if [ "$STATUS" != "Accepted" ]; then
    echo "❌ Notarization failed with status: $STATUS"
    echo ""
    echo "📋 Fetching log..."
    xcrun notarytool log "$SUBMISSION_ID" \
      --apple-id "$APPLE_ID" \
      --password "$APPLE_ID_PASSWORD" \
      --team-id "$APPLE_TEAM_ID"
    exit 1
fi

echo "✅ Notarization accepted"
echo ""

# Staple the notarization ticket
echo "📎 Stapling notarization ticket..."
xcrun stapler staple "$DMG_PATH"

echo "✅ Stapling complete"
echo ""

# Verify
echo "🔍 Verifying notarization..."
xcrun stapler validate "$DMG_PATH"
spctl -a -vvv -t install "$DMG_PATH"

echo ""
echo "✅ macOS notarization complete!"
echo "   DMG is ready for distribution: $DMG_PATH"
