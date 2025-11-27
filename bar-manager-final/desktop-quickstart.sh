#!/bin/bash

# EasyMO Admin Desktop - Quick Start
# This script sets up the desktop development environment

set -e

echo "🚀 EasyMO Admin Desktop - Quick Start"
echo "======================================"
echo ""

# Check for Rust
if ! command -v rustc &> /dev/null; then
    echo "❌ Rust not found!"
    echo ""
    echo "Install Rust from: https://rustup.rs/"
    echo "Or run: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    echo ""
    exit 1
fi

echo "✅ Rust $(rustc --version)"

# Check for Node/pnpm
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm not found!"
    echo ""
    echo "Install pnpm: npm install -g pnpm@10.18.3"
    echo ""
    exit 1
fi

echo "✅ pnpm $(pnpm --version)"

# Check platform-specific dependencies
case "$(uname -s)" in
    Darwin)
        echo "✅ macOS detected"
        if ! xcode-select -p &> /dev/null; then
            echo "⚠️  Xcode Command Line Tools not found"
            echo "Installing..."
            xcode-select --install
        fi
        ;;
    Linux)
        echo "✅ Linux detected"
        echo "Checking for required packages..."
        
        MISSING_PKGS=()
        for pkg in libwebkit2gtk-4.1-dev build-essential libssl-dev; do
            if ! dpkg -l | grep -q "^ii  $pkg"; then
                MISSING_PKGS+=("$pkg")
            fi
        done
        
        if [ ${#MISSING_PKGS[@]} -gt 0 ]; then
            echo "⚠️  Missing packages: ${MISSING_PKGS[*]}"
            echo "Install with: sudo apt install -y ${MISSING_PKGS[*]}"
            read -p "Install now? (y/n) " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                sudo apt install -y "${MISSING_PKGS[@]}"
            else
                echo "Please install missing packages before continuing"
                exit 1
            fi
        fi
        ;;
    MINGW*|MSYS*|CYGWIN*)
        echo "✅ Windows detected"
        echo "⚠️  Make sure you have Visual Studio Build Tools installed"
        echo "   Download from: https://visualstudio.microsoft.com/downloads/"
        ;;
    *)
        echo "⚠️  Unknown platform: $(uname -s)"
        ;;
esac

echo ""
echo "📦 Installing dependencies..."
cd admin-app
pnpm install --frozen-lockfile

echo ""
echo "🔨 Building shared packages..."
cd ..
pnpm --filter @va/shared build
pnpm --filter @easymo/commons build

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Start development server:"
echo "     cd admin-app && npm run tauri:dev"
echo ""
echo "  2. Build desktop app:"
echo "     cd admin-app && npm run tauri:build"
echo ""
echo "  3. Read the documentation:"
echo "     cat admin-app/DESKTOP_README.md"
echo ""
echo "Happy coding! 🎉"
