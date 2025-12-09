#!/bin/bash
set -e

###############################################################################
# Ibimina Staff App - Production AAB Builder for Google Play
###############################################################################
# This script builds a signed Android App Bundle (AAB) ready for Play Store
# upload. It handles keystore generation, environment validation, building,
# and signing.
###############################################################################

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "═══════════════════════════════════════════════════════════════"
echo "  Ibimina Staff App - Production AAB Builder"
echo "═══════════════════════════════════════════════════════════════"
echo -e "${NC}"

# Configuration
APP_VERSION="1.0.0"
VERSION_CODE="100"
KEYSTORE_PATH="./android/app/ibimina-staff-release.keystore"
KEY_ALIAS="ibimina-staff"
APP_DIR="$(pwd)"
ANDROID_DIR="$APP_DIR/android"
OUTPUT_DIR="$ANDROID_DIR/app/build/outputs"

###############################################################################
# Step 1: Environment Validation
###############################################################################
echo -e "${BLUE}[1/7] Validating environment...${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js not found. Install Node.js 20+${NC}"
    exit 1
fi
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo -e "${RED}✗ Node.js 20+ required (found v$NODE_VERSION)${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js $(node -v)${NC}"

# Check pnpm
if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}✗ pnpm not found. Run: npm install -g pnpm@10.19.0${NC}"
    exit 1
fi
echo -e "${GREEN}✓ pnpm $(pnpm -v)${NC}"

# Check Java
if ! command -v java &> /dev/null; then
    echo -e "${RED}✗ Java not found. Install OpenJDK 17+${NC}"
    exit 1
fi
JAVA_VERSION=$(java -version 2>&1 | head -n 1 | cut -d'"' -f2 | cut -d'.' -f1)
if [ "$JAVA_VERSION" -lt 17 ]; then
    echo -e "${RED}✗ Java 17+ required (found $JAVA_VERSION)${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Java $(java -version 2>&1 | head -n 1 | cut -d'"' -f2)${NC}"

# Check Android SDK
if [ -z "$ANDROID_HOME" ]; then
    echo -e "${RED}✗ ANDROID_HOME not set${NC}"
    echo -e "${YELLOW}Set it in your shell profile:${NC}"
    echo "  export ANDROID_HOME=\$HOME/Library/Android/sdk  # macOS"
    echo "  export ANDROID_HOME=\$HOME/Android/Sdk         # Linux"
    exit 1
fi
echo -e "${GREEN}✓ ANDROID_HOME: $ANDROID_HOME${NC}"

# Check required environment variables
REQUIRED_VARS=(
    "NEXT_PUBLIC_SUPABASE_URL"
    "NEXT_PUBLIC_SUPABASE_ANON_KEY"
    "SUPABASE_SERVICE_ROLE_KEY"
)

MISSING_VARS=()
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    echo -e "${RED}✗ Missing required environment variables:${NC}"
    for var in "${MISSING_VARS[@]}"; do
        echo "  - $var"
    done
    echo ""
    echo -e "${YELLOW}Set them in your environment or create .env file${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Required environment variables set${NC}"

###############################################################################
# Step 2: Keystore Setup
###############################################################################
echo ""
echo -e "${BLUE}[2/7] Checking keystore...${NC}"

if [ ! -f "$KEYSTORE_PATH" ]; then
    echo -e "${YELLOW}⚠ Keystore not found. Generating new keystore...${NC}"
    
    # Generate secure password
    KEYSTORE_PASSWORD=$(openssl rand -base64 32 | tr -d '/+=')
    
    echo ""
    echo -e "${YELLOW}════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}  CRITICAL: SAVE THIS PASSWORD SECURELY!${NC}"
    echo -e "${YELLOW}════════════════════════════════════════════════════════${NC}"
    echo ""
    echo "  Keystore Password: $KEYSTORE_PASSWORD"
    echo "  Key Alias: $KEY_ALIAS"
    echo ""
    echo -e "${RED}⚠ If you lose this password, you can NEVER update the app!${NC}"
    echo -e "${YELLOW}Save it in: 1Password, LastPass, or encrypted file${NC}"
    echo ""
    read -p "Press Enter when you've saved the password securely..."
    
    # Generate keystore
    keytool -genkeypair -v -storetype PKCS12 \
        -keystore "$KEYSTORE_PATH" \
        -alias "$KEY_ALIAS" \
        -keyalg RSA \
        -keysize 2048 \
        -validity 10000 \
        -storepass "$KEYSTORE_PASSWORD" \
        -keypass "$KEYSTORE_PASSWORD" \
        -dname "CN=Ibimina SACCO Staff, OU=IT, O=Ikanisa Rwanda, L=Kigali, C=RW" \
        2>&1 | grep -v "^$"
    
    echo -e "${GREEN}✓ Keystore generated: $KEYSTORE_PATH${NC}"
    
    # Save password to secure file (read-only by user)
    KEYSTORE_INFO_FILE="$ANDROID_DIR/app/KEYSTORE_INFO.txt"
    cat > "$KEYSTORE_INFO_FILE" <<EOF
# Ibimina Staff App - Keystore Information
# Generated: $(date)
# 
# ⚠️ KEEP THIS FILE SECURE - DO NOT COMMIT TO GIT
#
# Keystore Path: $KEYSTORE_PATH
# Key Alias: $KEY_ALIAS
# Keystore Password: $KEYSTORE_PASSWORD
# Key Password: $KEYSTORE_PASSWORD (same as keystore)
#
# Backup locations:
# 1. [ ] 1Password/LastPass
# 2. [ ] Encrypted USB drive
# 3. [ ] Secure cloud storage
EOF
    chmod 600 "$KEYSTORE_INFO_FILE"
    echo -e "${GREEN}✓ Keystore info saved to: $KEYSTORE_INFO_FILE${NC}"
    
    # Export for build
    export ANDROID_KEYSTORE_PATH="$KEYSTORE_PATH"
    export ANDROID_KEYSTORE_PASSWORD="$KEYSTORE_PASSWORD"
    export ANDROID_KEY_ALIAS="$KEY_ALIAS"
    export ANDROID_KEY_PASSWORD="$KEYSTORE_PASSWORD"
else
    echo -e "${GREEN}✓ Keystore found: $KEYSTORE_PATH${NC}"
    
    # Check if keystore password is set
    if [ -z "$ANDROID_KEYSTORE_PASSWORD" ]; then
        echo ""
        echo -e "${YELLOW}Enter keystore password:${NC}"
        read -s ANDROID_KEYSTORE_PASSWORD
        export ANDROID_KEYSTORE_PASSWORD
        export ANDROID_KEY_PASSWORD="$ANDROID_KEYSTORE_PASSWORD"
        export ANDROID_KEYSTORE_PATH="$KEYSTORE_PATH"
        export ANDROID_KEY_ALIAS="$KEY_ALIAS"
    fi
fi

###############################################################################
# Step 3: Clean Previous Builds
###############################################################################
echo ""
echo -e "${BLUE}[3/7] Cleaning previous builds...${NC}"

rm -rf .next
rm -rf android/app/build
rm -rf android/app/src/main/assets/public

echo -e "${GREEN}✓ Clean complete${NC}"

###############################################################################
# Step 4: Install Dependencies
###############################################################################
echo ""
echo -e "${BLUE}[4/7] Installing dependencies...${NC}"

pnpm install --frozen-lockfile --silent

echo -e "${GREEN}✓ Dependencies installed${NC}"

###############################################################################
# Step 5: Build Next.js App
###############################################################################
echo ""
echo -e "${BLUE}[5/7] Building Next.js application...${NC}"

export NODE_ENV=production
export APP_ENV=production

pnpm build

if [ ! -d ".next" ]; then
    echo -e "${RED}✗ Next.js build failed - .next directory not found${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Next.js build complete${NC}"

###############################################################################
# Step 6: Sync Capacitor
###############################################################################
echo ""
echo -e "${BLUE}[6/7] Syncing Capacitor...${NC}"

npx cap sync android

echo -e "${GREEN}✓ Capacitor sync complete${NC}"

###############################################################################
# Step 7: Build Android App Bundle (AAB)
###############################################################################
echo ""
echo -e "${BLUE}[7/7] Building signed AAB for Google Play...${NC}"

cd android

# Set version
export ANDROID_VERSION_CODE="$VERSION_CODE"
export ANDROID_VERSION_NAME="$APP_VERSION"

# Build AAB
./gradlew clean bundleRelease --no-daemon

cd ..

# Verify output
AAB_PATH="$OUTPUT_DIR/bundle/release/app-release.aab"
if [ ! -f "$AAB_PATH" ]; then
    echo -e "${RED}✗ AAB build failed - file not found${NC}"
    exit 1
fi

AAB_SIZE=$(du -h "$AAB_PATH" | cut -f1)
echo -e "${GREEN}✓ AAB built successfully: $AAB_SIZE${NC}"

###############################################################################
# Verification
###############################################################################
echo ""
echo -e "${BLUE}Verifying AAB signature...${NC}"

if command -v bundletool &> /dev/null; then
    bundletool validate --bundle="$AAB_PATH"
    echo -e "${GREEN}✓ AAB validation passed${NC}"
else
    echo -e "${YELLOW}⚠ bundletool not found - skipping validation${NC}"
    echo -e "${YELLOW}  Install: brew install bundletool (macOS)${NC}"
fi

###############################################################################
# Success Summary
###############################################################################
echo ""
echo -e "${GREEN}"
echo "═══════════════════════════════════════════════════════════════"
echo "  ✓ BUILD SUCCESSFUL!"
echo "═══════════════════════════════════════════════════════════════"
echo -e "${NC}"
echo ""
echo "📦 Output Files:"
echo "   AAB (for Play Store): $AAB_PATH ($AAB_SIZE)"
echo ""
echo "📊 Build Info:"
echo "   Version: $APP_VERSION ($VERSION_CODE)"
echo "   Package: rw.ibimina.staff"
echo "   Signed: Yes (with $KEY_ALIAS)"
echo ""
echo "🚀 Next Steps:"
echo "   1. Go to: https://play.google.com/console"
echo "   2. Select: Testing → Internal testing"
echo "   3. Click: Create new release"
echo "   4. Upload: $AAB_PATH"
echo "   5. Add release notes and testers"
echo "   6. Save and rollout"
echo ""
echo -e "${YELLOW}⚠ Important:${NC}"
echo "   - Keep keystore backed up: $KEYSTORE_PATH"
echo "   - Keystore info saved to: $ANDROID_DIR/app/KEYSTORE_INFO.txt"
echo "   - Never commit keystore to git!"
echo ""
