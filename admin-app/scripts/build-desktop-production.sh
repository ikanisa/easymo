#!/bin/bash
# EasyMO Admin Desktop - Production Build Script
# Usage: ./scripts/build-desktop-production.sh [mac|win|all]

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 EasyMO Admin Desktop - Production Build${NC}"
echo "=============================================="

# Determine platform
PLATFORM=${1:-all}

# Validate platform
if [[ ! "$PLATFORM" =~ ^(mac|win|all)$ ]]; then
    echo -e "${RED}Error: Invalid platform '$PLATFORM'${NC}"
    echo "Usage: $0 [mac|win|all]"
    exit 1
fi

# Check prerequisites
echo ""
echo -e "${YELLOW}📋 Checking prerequisites...${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js 20+${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js $(node --version)${NC}"

# Check pnpm
if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}❌ pnpm not found. Installing...${NC}"
    npm install -g pnpm@10.18.3
fi
echo -e "${GREEN}✓ pnpm $(pnpm --version)${NC}"

# Check Rust
if ! command -v rustc &> /dev/null; then
    echo -e "${RED}❌ Rust not found. Please install from https://rustup.rs${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Rust $(rustc --version)${NC}"

# Check Tauri CLI
if ! command -v cargo tauri &> /dev/null; then
    echo -e "${YELLOW}⚠️  Tauri CLI not found in cargo. Will use npm.${NC}"
fi

# Build shared packages
echo ""
echo -e "${YELLOW}📦 Building shared packages...${NC}"
cd ..
pnpm --filter @va/shared build
pnpm --filter @easymo/commons build
cd admin-app

# Install dependencies
echo ""
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
pnpm install --frozen-lockfile

# Build for macOS
if [[ "$PLATFORM" == "mac" || "$PLATFORM" == "all" ]]; then
    if [[ "$OSTYPE" != "darwin"* ]]; then
        echo -e "${YELLOW}⚠️  Skipping macOS build (not on macOS)${NC}"
    else
        echo ""
        echo -e "${YELLOW}🍎 Building macOS version...${NC}"
        echo "This may take 5-8 minutes..."
        
        # Detect architecture
        ARCH=$(uname -m)
        if [[ "$ARCH" == "arm64" ]]; then
            echo "Detected Apple Silicon (M1/M2/M3)"
            npm run tauri:build:universal
        else
            echo "Detected Intel Mac"
            npm run tauri:build:mac
        fi
        
        echo -e "${GREEN}✓ macOS build complete${NC}"
        echo "Output: src-tauri/target/release/bundle/dmg/"
        ls -lh src-tauri/target/release/bundle/dmg/*.dmg
    fi
fi

# Build for Windows
if [[ "$PLATFORM" == "win" || "$PLATFORM" == "all" ]]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo -e "${YELLOW}⚠️  Skipping Windows build (not on Windows)${NC}"
        echo "To build for Windows, run this script on a Windows machine:"
        echo "  ./scripts/build-desktop-production.sh win"
    else
        echo ""
        echo -e "${YELLOW}🪟 Building Windows version...${NC}"
        echo "This may take 4-6 minutes..."
        
        npm run tauri:build:win
        
        echo -e "${GREEN}✓ Windows build complete${NC}"
        echo "Output: src-tauri/target/release/bundle/msi/"
        ls -lh src-tauri/target/release/bundle/msi/*.msi 2>/dev/null || true
    fi
fi

# Generate checksums
echo ""
echo -e "${YELLOW}🔐 Generating checksums...${NC}"

CHECKSUM_FILE="src-tauri/target/release/bundle/checksums.txt"
> "$CHECKSUM_FILE"  # Clear file

if [[ -d "src-tauri/target/release/bundle/dmg" ]]; then
    cd src-tauri/target/release/bundle/dmg
    shasum -a 256 *.dmg >> ../../../../checksums.txt 2>/dev/null || true
    cd ../../../../..
fi

if [[ -d "src-tauri/target/release/bundle/msi" ]]; then
    cd src-tauri/target/release/bundle/msi
    shasum -a 256 *.msi >> ../../../../checksums.txt 2>/dev/null || true
    cd ../../../../..
fi

if [[ -f "$CHECKSUM_FILE" && -s "$CHECKSUM_FILE" ]]; then
    echo -e "${GREEN}✓ Checksums saved to $CHECKSUM_FILE${NC}"
    cat "$CHECKSUM_FILE"
fi

# Summary
echo ""
echo -e "${GREEN}✅ BUILD COMPLETE${NC}"
echo "=============================================="
echo ""
echo "📦 Build Artifacts:"

if [[ -d "src-tauri/target/release/bundle/dmg" ]]; then
    echo ""
    echo "macOS:"
    find src-tauri/target/release/bundle/dmg -name "*.dmg" -exec ls -lh {} \;
fi

if [[ -d "src-tauri/target/release/bundle/msi" ]]; then
    echo ""
    echo "Windows:"
    find src-tauri/target/release/bundle/msi -name "*.msi" -exec ls -lh {} \;
fi

echo ""
echo -e "${YELLOW}📝 Next Steps:${NC}"
echo "1. Test the builds on clean machines"
echo "2. Upload to your distribution server"
echo "3. Send installation instructions to team"
echo ""
echo "📚 See DESKTOP_INHOUSE_DEPLOYMENT_GUIDE.md for full instructions"
