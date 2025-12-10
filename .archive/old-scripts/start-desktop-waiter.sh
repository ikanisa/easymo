#!/bin/bash

# Waiter AI - Desktop App Quick Start
# This script sets up and launches the desktop application

set -e

echo "🍽️  Waiter AI - Desktop App Quick Start"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Rust is installed
if ! command -v cargo &> /dev/null; then
    echo -e "${YELLOW}⚠️  Rust not found. Installing...${NC}"
    echo ""
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
    echo -e "${GREEN}✅ Rust installed${NC}"
    echo ""
else
    echo -e "${GREEN}✅ Rust found: $(rustc --version)${NC}"
    echo ""
fi

# Change to waiter-pwa directory
cd "$(dirname "$0")/waiter-pwa" || exit 1

echo -e "${YELLOW}📁 Working directory: $(pwd)${NC}"
echo ""

# Check environment variables
echo -e "${YELLOW}🔍 Checking environment variables...${NC}"
if [ ! -f .env.local ]; then
    echo -e "${RED}⚠️  .env.local not found!${NC}"
    echo "Please create .env.local with required variables:"
    echo "  NEXT_PUBLIC_SUPABASE_URL=..."
    echo "  NEXT_PUBLIC_SUPABASE_ANON_KEY=..."
    echo "  NEXT_PUBLIC_RESTAURANT_ID=..."
    exit 1
fi
echo -e "${GREEN}✅ Environment file found${NC}"
echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    pnpm install
    echo -e "${GREEN}✅ Dependencies installed${NC}"
    echo ""
fi

# Ask user what to do
echo "What would you like to do?"
echo "  1) Run in development mode (hot-reload, for testing)"
echo "  2) Build production desktop app (creates installers)"
echo ""
read -p "Enter choice [1-2]: " choice

case $choice in
    1)
        echo ""
        echo -e "${YELLOW}🚀 Starting desktop app in development mode...${NC}"
        echo ""
        echo "This will:"
        echo "  1. Start Next.js dev server on port 3001"
        echo "  2. Launch Tauri desktop window"
        echo "  3. Enable hot-reload for changes"
        echo ""
        echo "Press Ctrl+C to stop"
        echo ""
        pnpm desktop:dev
        ;;
    2)
        echo ""
        echo -e "${YELLOW}🔨 Building production desktop app...${NC}"
        echo ""
        echo "This will take 10-15 minutes on first build..."
        echo ""
        pnpm desktop:build
        echo ""
        echo -e "${GREEN}✅ Build complete!${NC}"
        echo ""
        echo "Installers created in:"
        echo "  macOS:   src-tauri/target/release/bundle/macos/"
        echo "  Windows: src-tauri/target/release/bundle/msi/"
        echo "  Linux:   src-tauri/target/release/bundle/deb/"
        echo ""
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}🎉 Done!${NC}"
echo ""
echo "📚 Documentation:"
echo "  - WAITER_AI_DESKTOP_DEPLOYMENT.md"
echo "  - https://v2.tauri.app/"
