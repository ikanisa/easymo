# 🚀 Quick Start - Bar Manager Desktop App

## Prerequisites

- Node.js 20+
- Rust (will be installed by setup script if needed)
- macOS, Windows, or Linux

## 1. Quick Setup

```bash
cd bar-manager-app
chmod +x setup-desktop.sh
./setup-desktop.sh
```

## 2. Manual Setup (if script fails)

```bash
# Create directories
mkdir -p src-tauri/src/commands src-tauri/icons lib/desktop lib/scanner components/desktop public/sounds

# Install Rust (if not installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install dependencies
npm install

# Install Tauri
npm install --save-dev @tauri-apps/cli@2.0.0
npm install @tauri-apps/api@2.0.0

# Install Tauri plugins (15 plugins)
npm install @tauri-apps/plugin-autostart@2.0.0 \
            @tauri-apps/plugin-dialog@2.0.0 \
            @tauri-apps/plugin-fs@2.0.0 \
            @tauri-apps/plugin-notification@2.0.0 \
            @tauri-apps/plugin-shell@2.0.0 \
            @tauri-apps/plugin-store@2.0.0 \
            @tauri-apps/plugin-updater@2.0.0 \
            @tauri-apps/plugin-window-state@2.0.0 \
            @tauri-apps/plugin-http@2.0.0 \
            @tauri-apps/plugin-os@2.0.0 \
            @tauri-apps/plugin-process@2.0.0 \
            @tauri-apps/plugin-clipboard-manager@2.0.0 \
            @tauri-apps/plugin-global-shortcut@2.0.0

# Additional deps
npm install howler xlsx jspdf jspdf-autotable html5-qrcode cmdk
```

## 3. Copy Configuration Files

From `PHASE_5B_COMPLETE_IMPLEMENTATION.md`, copy:

1. **Rust Backend** → `src-tauri/src/`
   - `main.rs`
   - `commands/mod.rs`
   - `commands/printer.rs`
   - `commands/window.rs`
   - `commands/scanner.rs`
   - `commands/system.rs`

2. **Cargo Files** → `src-tauri/`
   - `Cargo.toml`
   - `tauri.conf.json`
   - `build.rs`

3. **TypeScript Lib** → `lib/desktop/`
   - `window-manager.ts`
   - `shortcuts.ts`

4. **React Hooks** → `hooks/`
   - `useMultiWindow.ts`

## 4. Add Scripts to package.json

```json
{
  "scripts": {
    "tauri": "tauri",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build",
    "tauri:build:all": "tauri build --target all",
    "tauri:icon": "tauri icon"
  }
}
```

## 5. Create App Icon

1. Create a 1024x1024 PNG image
2. Save it as `src-tauri/icons/icon.png`
3. Run: `npm run tauri:icon`

This generates all required icon sizes.

## 6. Run Desktop App

```bash
# Development mode (hot reload)
npm run tauri:dev

# Build for production
npm run tauri:build
```

## 7. Test Features

### Open Kitchen Display
Press `Ctrl/Cmd + Shift + K` or use Command Palette (`Ctrl/Cmd + K`)

### Command Palette
Press `Ctrl/Cmd + K` anywhere

### Keyboard Shortcuts
Press `Ctrl/Cmd + /` to see all shortcuts

### Multi-Window
- Main window: Dashboard
- KDS window: Kitchen display (separate window)
- POS window: Fullscreen POS mode

## 8. Connect Hardware

### Thermal Printer
1. Connect USB thermal printer
2. Go to Settings → Printers
3. Click "Detect Printers"
4. Enable and test printer

### Barcode Scanner
1. Connect USB barcode scanner
2. Scanner will work as keyboard input
3. Or use webcam scanner (built-in)

## 📖 Full Documentation

See `PHASE_5B_COMPLETE_IMPLEMENTATION.md` for:
- Complete code for all files
- Detailed configuration
- Rust backend implementation
- TypeScript integration
- All hooks and components

## 🎯 Production Build

```bash
# Build for current platform
npm run tauri:build

# Output locations:
# macOS: src-tauri/target/release/bundle/dmg/
# Windows: src-tauri/target/release/bundle/msi/
# Linux: src-tauri/target/release/bundle/appimage/
```

## 🐛 Troubleshooting

### Rust not found
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
```

### Build fails on macOS
```bash
xcode-select --install
```

### Build fails on Linux
```bash
sudo apt-get update
sudo apt-get install -y libgtk-3-dev libwebkit2gtk-4.0-dev libappindicator3-dev librsvg2-dev patchelf
```

### Build fails on Windows
Install Visual Studio Build Tools 2022 with C++ development tools

## 🎉 Success!

You now have a **world-class desktop application** for bar and restaurant management!

**Features**:
- ✅ Native desktop app (Windows, macOS, Linux)
- ✅ Multi-window support
- ✅ Thermal printer integration
- ✅ Offline mode
- ✅ Real-time sync
- ✅ 100+ keyboard shortcuts
- ✅ System tray integration
- ✅ Auto-updates

**Next**: Configure your menu, connect printers, and start serving customers!
