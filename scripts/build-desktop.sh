#!/bin/bash
# Desktop App Build & Distribution Script
# Builds EasyMO Admin desktop app for all platforms

set -e

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║          🖥️  EasyMO Admin Desktop Build Script                ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Change to admin-app directory
cd "$(dirname "$0")/../admin-app" || exit 1

# Check if Rust is installed
if ! command -v rustc &> /dev/null; then
    echo -e "${RED}❌ Rust is not installed${NC}"
    echo ""
    echo "Please install Rust:"
    echo "  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    exit 1
fi

echo -e "${GREEN}✅ Rust installed:${NC} $(rustc --version)"

# Check if dependencies are installed
echo ""
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
pnpm install --frozen-lockfile

echo ""
echo -e "${YELLOW}🔨 Building shared packages...${NC}"
cd ..
pnpm --filter @va/shared build
pnpm --filter @easymo/commons build
pnpm --filter @easymo/ui build
cd admin-app

# Function to build for specific platform
build_platform() {
    local platform=$1
    local target=$2
    local name=$3
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${GREEN}🚀 Building for ${name}...${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    if [ "$target" = "current" ]; then
        npm run tauri:build
    else
        npm run tauri:build:${platform}
    fi
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ ${name} build successful${NC}"
    else
        echo -e "${RED}❌ ${name} build failed${NC}"
        return 1
    fi
}

# Parse arguments
BUILD_ALL=false
BUILD_MAC=false
BUILD_WIN=false
BUILD_LINUX=false

if [ $# -eq 0 ]; then
    BUILD_ALL=true
fi

while [ $# -gt 0 ]; do
    case "$1" in
        --all)
            BUILD_ALL=true
            ;;
        --mac)
            BUILD_MAC=true
            ;;
        --win)
            BUILD_WIN=true
            ;;
        --linux)
            BUILD_LINUX=true
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --all      Build for all platforms (default)"
            echo "  --mac      Build for macOS only"
            echo "  --win      Build for Windows only"
            echo "  --linux    Build for Linux only"
            echo "  --help     Show this help message"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
    shift
done

# Build based on flags
if [ "$BUILD_ALL" = true ]; then
    echo ""
    echo -e "${YELLOW}🌍 Building for all platforms...${NC}"
    build_platform "mac" "x86_64-apple-darwin" "macOS Intel"
    build_platform "mac-arm" "aarch64-apple-darwin" "macOS Apple Silicon"
    build_platform "win" "x86_64-pc-windows-msvc" "Windows x64"
    # Linux build (current platform only)
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        build_platform "current" "current" "Linux"
    fi
else
    if [ "$BUILD_MAC" = true ]; then
        build_platform "mac" "x86_64-apple-darwin" "macOS Intel"
        build_platform "mac-arm" "aarch64-apple-darwin" "macOS Apple Silicon"
    fi
    
    if [ "$BUILD_WIN" = true ]; then
        build_platform "win" "x86_64-pc-windows-msvc" "Windows x64"
    fi
    
    if [ "$BUILD_LINUX" = true ]; then
        build_platform "current" "current" "Linux"
    fi
fi

# List built files
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}📦 Build Artifacts:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

BUNDLE_DIR="src-tauri/target/release/bundle"

if [ -d "$BUNDLE_DIR" ]; then
    # macOS
    if [ -d "$BUNDLE_DIR/dmg" ]; then
        echo -e "${GREEN}macOS DMG:${NC}"
        ls -lh "$BUNDLE_DIR/dmg"/*.dmg 2>/dev/null || echo "  (none)"
        echo ""
    fi
    
    # Windows
    if [ -d "$BUNDLE_DIR/msi" ]; then
        echo -e "${GREEN}Windows MSI:${NC}"
        ls -lh "$BUNDLE_DIR/msi"/*.msi 2>/dev/null || echo "  (none)"
        echo ""
    fi
    
    if [ -d "$BUNDLE_DIR/nsis" ]; then
        echo -e "${GREEN}Windows NSIS:${NC}"
        ls -lh "$BUNDLE_DIR/nsis"/*-setup.exe 2>/dev/null || echo "  (none)"
        echo ""
    fi
    
    # Linux
    if [ -d "$BUNDLE_DIR/deb" ]; then
        echo -e "${GREEN}Linux DEB:${NC}"
        ls -lh "$BUNDLE_DIR/deb"/*.deb 2>/dev/null || echo "  (none)"
        echo ""
    fi
    
    if [ -d "$BUNDLE_DIR/appimage" ]; then
        echo -e "${GREEN}Linux AppImage:${NC}"
        ls -lh "$BUNDLE_DIR/appimage"/*.AppImage 2>/dev/null || echo "  (none)"
        echo ""
    fi
else
    echo -e "${YELLOW}⚠️  No build artifacts found${NC}"
fi

# Calculate sizes
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}📊 Build Summary:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -d "$BUNDLE_DIR" ]; then
    TOTAL_SIZE=$(du -sh "$BUNDLE_DIR" | cut -f1)
    FILE_COUNT=$(find "$BUNDLE_DIR" -type f \( -name "*.dmg" -o -name "*.msi" -o -name "*.exe" -o -name "*.deb" -o -name "*.AppImage" \) | wc -l | tr -d ' ')
    
    echo "Total Size: $TOTAL_SIZE"
    echo "Installers: $FILE_COUNT"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ Build Complete!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "  1. Test installers on target platforms"
echo "  2. Sign installers (macOS: codesign, Windows: signtool)"
echo "  3. Upload to release server or GitHub Releases"
echo "  4. Update version manifest for auto-updater"
echo ""
echo "Distribution options:"
echo "  • Direct download: Upload to file server"
echo "  • GitHub Releases: gh release create v1.0.0 ..."
echo "  • App stores: Submit to macOS App Store, Microsoft Store"
echo ""
