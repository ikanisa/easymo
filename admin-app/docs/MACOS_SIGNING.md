# macOS Code Signing & Notarization Guide
# ========================================

## Requirements

### 1. Apple Developer Account
- Cost: $99/year
- Sign up at: https://developer.apple.com

### 2. Developer ID Application Certificate
```bash
# Request certificate from Xcode or developer portal
# Download and install to Keychain
```

### 3. App-Specific Password
```bash
# Generate at: https://appleid.apple.com
# Account Settings > Security > App-Specific Passwords
```

## Environment Setup

```bash
# Add to ~/.zshrc or ~/.bash_profile
export APPLE_CERTIFICATE="Developer ID Application: Your Company Name (TEAM_ID)"
export APPLE_ID="your.email@example.com"
export APPLE_ID_PASSWORD="xxxx-xxxx-xxxx-xxxx"  # App-specific password
export APPLE_TEAM_ID="YOUR_TEAM_ID"
```

## Build Process

### Step 1: Sign the App
```bash
# Tauri handles this automatically if certificate is in Keychain
tauri build --target universal-apple-darwin
```

### Step 2: Notarize the App
```bash
# Create DMG
npm run tauri:build:mac

# Submit for notarization
xcrun notarytool submit \
  "target/release/bundle/dmg/EasyMO Admin_1.0.0_universal.dmg" \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_ID_PASSWORD" \
  --team-id "$APPLE_TEAM_ID" \
  --wait

# Check status
xcrun notarytool history --apple-id "$APPLE_ID" --password "$APPLE_ID_PASSWORD" --team-id "$APPLE_TEAM_ID"
```

### Step 3: Staple the Notarization
```bash
# Attach notarization ticket to DMG
xcrun stapler staple "target/release/bundle/dmg/EasyMO Admin_1.0.0_universal.dmg"

# Verify
xcrun stapler validate "target/release/bundle/dmg/EasyMO Admin_1.0.0_universal.dmg"
spctl -a -vvv -t install "target/release/bundle/dmg/EasyMO Admin_1.0.0_universal.dmg"
```

## Automation Script

Create `scripts/notarize-macos.sh`:

```bash
#!/bin/bash
set -e

DMG_PATH="$1"
if [ -z "$DMG_PATH" ]; then
    echo "Usage: $0 <path-to-dmg>"
    exit 1
fi

echo "📦 Submitting for notarization..."
xcrun notarytool submit "$DMG_PATH" \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_ID_PASSWORD" \
  --team-id "$APPLE_TEAM_ID" \
  --wait

echo "📎 Stapling notarization..."
xcrun stapler staple "$DMG_PATH"

echo "✅ Verification..."
spctl -a -vvv -t install "$DMG_PATH"

echo "✅ macOS notarization complete!"
```

## Hardened Runtime

Entitlements are configured in `Entitlements.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <!-- Required for App Sandbox -->
    <key>com.apple.security.app-sandbox</key>
    <true/>
    
    <!-- Network Access -->
    <key>com.apple.security.network.client</key>
    <true/>
    
    <!-- File Access -->
    <key>com.apple.security.files.user-selected.read-write</key>
    <true/>
    <key>com.apple.security.files.downloads.read-write</key>
    <true/>
</dict>
</plist>
```

## GitHub Actions Integration

```yaml
- name: Build and Notarize macOS
  if: matrix.os == 'macos-latest'
  env:
    APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE_BASE64 }}
    APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
    APPLE_ID: ${{ secrets.APPLE_ID }}
    APPLE_ID_PASSWORD: ${{ secrets.APPLE_ID_PASSWORD }}
    APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
  run: |
    # Import certificate
    echo $APPLE_CERTIFICATE | base64 --decode > certificate.p12
    security create-keychain -p actions build.keychain
    security default-keychain -s build.keychain
    security unlock-keychain -p actions build.keychain
    security import certificate.p12 -k build.keychain -P $APPLE_CERTIFICATE_PASSWORD -T /usr/bin/codesign
    security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k actions build.keychain
    
    # Build
    npm run tauri:build:universal
    
    # Notarize
    ./scripts/notarize-macos.sh "target/release/bundle/dmg/EasyMO Admin_1.0.0_universal.dmg"
```

## Troubleshooting

### Issue: "No identity found"
```bash
# List available certificates
security find-identity -v -p codesigning

# Import certificate if missing
security import certificate.p12 -k ~/Library/Keychains/login.keychain-db
```

### Issue: "Notarization failed"
```bash
# Get detailed log
xcrun notarytool log <submission-id> \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_ID_PASSWORD" \
  --team-id "$APPLE_TEAM_ID"
```

### Issue: "Gatekeeper blocks app"
```bash
# Check why app is blocked
spctl -a -vvv -t install "/Applications/EasyMO Admin.app"

# Force assessment
sudo spctl --assess --verbose=4 --type execute "/Applications/EasyMO Admin.app"
```

## Testing

```bash
# Test on fresh macOS install
# 1. Download DMG
# 2. Double-click to mount
# 3. Drag to Applications
# 4. Double-click to launch
# 5. Should open without warnings

# Test Gatekeeper
xattr -d com.apple.quarantine "/Applications/EasyMO Admin.app"
spctl --assess --verbose "/Applications/EasyMO Admin.app"
```
