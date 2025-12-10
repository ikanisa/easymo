#!/bin/bash

# 🚀 Bar Manager Desktop App - Quick Setup Script
# This script sets up the complete desktop application

echo "🎯 Bar Manager Desktop App - Setup Starting..."
echo ""

# Colors
GREEN='\033[0.32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Create directories
echo -e "${BLUE}📁 Creating directory structure...${NC}"
mkdir -p src-tauri/src/commands
mkdir -p src-tauri/icons
mkdir -p lib/desktop
mkdir -p lib/scanner
mkdir -p components/desktop
mkdir -p public/sounds
echo -e "${GREEN}✓ Directories created${NC}"
echo ""

# Step 2: Check if Rust is installed
echo -e "${BLUE}🦀 Checking Rust installation...${NC}"
if ! command -v rustc &> /dev/null; then
    echo -e "${YELLOW}⚠ Rust not found. Installing...${NC}"
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
else
    echo -e "${GREEN}✓ Rust is installed${NC}"
fi
echo ""

# Step 3: Install Tauri dependencies
echo -e "${BLUE}📦 Installing Tauri dependencies...${NC}"
npm install --save-dev @tauri-apps/cli@2.0.0
npm install @tauri-apps/api@2.0.0
npm install @tauri-apps/plugin-autostart@2.0.0
npm install @tauri-apps/plugin-dialog@2.0.0
npm install @tauri-apps/plugin-fs@2.0.0
npm install @tauri-apps/plugin-notification@2.0.0
npm install @tauri-apps/plugin-shell@2.0.0
npm install @tauri-apps/plugin-store@2.0.0
npm install @tauri-apps/plugin-updater@2.0.0
npm install @tauri-apps/plugin-window-state@2.0.0
npm install @tauri-apps/plugin-http@2.0.0
npm install @tauri-apps/plugin-os@2.0.0
npm install @tauri-apps/plugin-process@2.0.0
npm install @tauri-apps/plugin-clipboard-manager@2.0.0
npm install @tauri-apps/plugin-global-shortcut@2.0.0
echo -e "${GREEN}✓ Tauri dependencies installed${NC}"
echo ""

# Step 4: Install additional dependencies
echo -e "${BLUE}📦 Installing additional dependencies...${NC}"
npm install howler@2.2.4
npm install xlsx@0.18.5
npm install jspdf@2.5.1
npm install jspdf-autotable@3.8.2
npm install html5-qrcode@2.3.8
npm install cmdk@1.0.0
echo -e "${GREEN}✓ Additional dependencies installed${NC}"
echo ""

# Step 5: Update package.json scripts
echo -e "${BLUE}📝 Updating package.json scripts...${NC}"
# This would normally use a tool like jq, but we'll skip for simplicity
echo -e "${YELLOW}⚠ Please manually add these scripts to package.json:${NC}"
echo '  "tauri": "tauri",'
echo '  "tauri:dev": "tauri dev",'
echo '  "tauri:build": "tauri build",'
echo '  "tauri:build:all": "tauri build --target all",'
echo '  "tauri:icon": "tauri icon"'
echo ""

# Step 6: Initialize Tauri (if not already done)
echo -e "${BLUE}🔧 Initializing Tauri...${NC}"
if [ ! -d "src-tauri" ]; then
    npm run tauri init -- \
        --app-name "Bar Manager" \
        --window-title "Bar Manager - Dashboard" \
        --dist-dir "../out" \
        --dev-url "http://localhost:3001" \
        --before-dev-command "npm run dev" \
        --before-build-command "npm run build"
else
    echo -e "${YELLOW}⚠ Tauri already initialized${NC}"
fi
echo ""

# Step 7: Create placeholder icon
echo -e "${BLUE}🎨 Creating placeholder icon...${NC}"
echo "Create a 1024x1024 PNG icon at src-tauri/icons/icon.png"
echo "Then run: npm run tauri:icon"
echo ""

# Done
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo ""
echo -e "${BLUE}📖 Next Steps:${NC}"
echo "1. Copy the Rust code from PHASE_5B_COMPLETE_IMPLEMENTATION.md to src-tauri/src/"
echo "2. Copy the TypeScript code from the same file to lib/desktop/"
echo "3. Create an icon at src-tauri/icons/icon.png (1024x1024)"
echo "4. Run: npm run tauri:dev"
echo ""
echo -e "${GREEN}🚀 You're ready to build a world-class desktop app!${NC}"
