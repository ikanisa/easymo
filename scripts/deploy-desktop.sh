#!/bin/bash
# EasyMO Desktop App Build Script
# Builds Admin Panel and Client Portal desktop apps
# Internal use only

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "🖥️  EasyMO Desktop Build"
echo "========================"

# Check for Rust
if ! command -v cargo &> /dev/null; then
    echo "❌ Rust not found. Install via: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    exit 1
fi

# Determine target
TARGET="${2:-}"
case "$TARGET" in
    mac)
        TAURI_TARGET="x86_64-apple-darwin"
        ;;
    mac-arm)
        TAURI_TARGET="aarch64-apple-darwin"
        ;;
    win)
        TAURI_TARGET="x86_64-pc-windows-msvc"
        ;;
    *)
        # Auto-detect
        if [[ "$(uname -m)" == "arm64" ]]; then
            TAURI_TARGET="aarch64-apple-darwin"
        elif [[ "$(uname)" == "Darwin" ]]; then
            TAURI_TARGET="x86_64-apple-darwin"
        else
            TAURI_TARGET=""
        fi
        ;;
esac

build_admin() {
    echo ""
    echo "📦 Building Admin Panel Desktop..."
    cd "$ROOT_DIR/admin-app"
    pnpm install
    
    if [ -n "$TAURI_TARGET" ]; then
        pnpm tauri build --target "$TAURI_TARGET"
    else
        pnpm tauri:build
    fi
    
    echo "✅ Admin Panel built!"
    echo "   Output: admin-app/src-tauri/target/release/bundle/"
}

build_client() {
    echo ""
    echo "📦 Building Client Portal Desktop..."
    cd "$ROOT_DIR/client-pwa"
    pnpm install
    
    if [ -n "$TAURI_TARGET" ]; then
        TAURI_ENV_PLATFORM=1 pnpm tauri build --target "$TAURI_TARGET"
    else
        TAURI_ENV_PLATFORM=1 pnpm tauri:build
    fi
    
    echo "✅ Client Portal built!"
    echo "   Output: client-pwa/src-tauri/target/release/bundle/"
}

case "${1:-all}" in
    admin)
        build_admin
        ;;
    client)
        build_client
        ;;
    all)
        build_admin
        build_client
        ;;
    *)
        echo "Usage: $0 [admin|client|all] [mac|mac-arm|win]"
        echo ""
        echo "Apps:"
        echo "  admin  - Build Admin Panel only"
        echo "  client - Build Client Portal only"
        echo "  all    - Build both (default)"
        echo ""
        echo "Targets:"
        echo "  mac     - macOS Intel"
        echo "  mac-arm - macOS Apple Silicon"
        echo "  win     - Windows x64"
        echo "  (auto)  - Auto-detect current platform"
        exit 1
        ;;
esac

echo ""
echo "🎉 Desktop build complete!"
