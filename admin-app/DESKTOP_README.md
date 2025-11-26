# EasyMO Admin Desktop - Implementation Guide

## 🎯 Overview

This guide documents the conversion of the EasyMO Admin PWA into a world-class native desktop application using Tauri 2.0.

**Technology Stack:**
- **Frontend**: Next.js 15.1.6 (static export)
- **Desktop Runtime**: Tauri 2.0
- **Backend**: Rust (native performance)
- **Size**: ~15MB installer (vs 100MB+ for Electron)

## 📁 Project Structure

```
admin-app/
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── lib.rs          # Main entry, tray, shortcuts
│   │   ├── main.rs         # Binary entry point
│   │   └── commands.rs     # IPC commands
│   ├── Cargo.toml          # Rust dependencies
│   └── tauri.conf.json     # Tauri configuration
├── lib/
│   └── platform.ts         # Platform abstraction layer
├── next.config.desktop.mjs # Desktop-specific Next.js config
└── scripts/
    └── build-desktop.js    # Desktop build script
```

## ✅ Implemented Features (Phase 1)

### Native Desktop Features

- ✅ **System Tray Integration**
  - Minimize to tray
  - Tray menu (Show/Hide/Quit)
  - Click to restore window

- ✅ **Native Notifications**
  - OS-level notifications
  - Fallback to Web Notification API
  - Cross-platform support

- ✅ **Global Shortcuts**
  - Cmd+K (macOS) / Ctrl+K (Windows/Linux)
  - Triggers command palette
  - System-wide hotkey registration

- ✅ **Auto-Start Support**
  - Launch on login (optional)
  - Platform-specific launchers

- ✅ **File System Access**
  - Native save/open dialogs
  - Scoped file access
  - Export/import functionality

### Platform Utilities

The `lib/platform.ts` module provides:

```typescript
// Check environment
isDesktop()  // true in Tauri, false in web
isPWA()      // true in PWA mode

// Native notifications
showNotification(title, body, options)

// Window management
minimizeToTray()
showWindow()

// File dialogs
saveFile(defaultPath, filters)
openFile(options)

// Auto-start
isAutostartEnabled()
setAutostart(enabled)

// External links
openExternal(url)

// Platform info
getPlatformInfo()
```

## 🚀 Getting Started

### Prerequisites

1. **Rust** (latest stable)
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

2. **Platform-specific dependencies:**

   **macOS:**
   ```bash
   xcode-select --install
   ```

   **Windows:**
   - Microsoft Visual Studio C++ Build Tools
   - WebView2 (included in Windows 11, auto-installed on Windows 10)

   **Linux (Ubuntu/Debian):**
   ```bash
   sudo apt install -y libwebkit2gtk-4.1-dev \
     build-essential curl wget file \
     libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
   ```

### Development

1. **Install dependencies:**
   ```bash
   cd admin-app
   npm ci
   ```

2. **Run in development mode:**
   ```bash
   npm run tauri:dev
   ```

   This will:
   - Start Next.js dev server on :3000
   - Launch Tauri window with hot reload
   - Enable Rust debugging

3. **Build for production:**
   ```bash
   npm run tauri:build
   ```

   Outputs installers in `src-tauri/target/release/bundle/`:
   - **macOS**: `.dmg`, `.app`
   - **Windows**: `.msi`, `.exe`
   - **Linux**: `.deb`, `.AppImage`

## 🔧 Configuration

### Tauri Configuration (`src-tauri/tauri.conf.json`)

Key settings:

```json
{
  "identifier": "dev.easymo.admin",
  "productName": "EasyMO Admin",
  "version": "1.0.0",
  "app": {
    "windows": [{
      "width": 1400,
      "height": 900,
      "minWidth": 1024,
      "minHeight": 768
    }],
    "security": {
      "csp": {
        "connect-src": "https://*.supabase.co wss://*.supabase.co"
      }
    }
  }
}
```

### Next.js Desktop Config (`next.config.desktop.mjs`)

Enables static export for Tauri:

```javascript
{
  output: 'export',
  distDir: 'out',
  trailingSlash: true,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_IS_DESKTOP: 'true' }
}
```

## 🎨 Using Desktop Features in Components

### Example: Native Notifications

```typescript
import { showNotification } from '@/lib/platform';

async function handleNotify() {
  await showNotification(
    'New Message',
    'You have a new WhatsApp message',
    { icon: '/icons/icon-192.png' }
  );
}
```

### Example: File Operations

```typescript
import { saveFile, openFile } from '@/lib/platform';

async function exportData() {
  const filePath = await saveFile('export.json', [
    { name: 'JSON', extensions: ['json'] }
  ]);
  
  if (filePath) {
    // Save data to filePath
  }
}
```

### Example: Platform Detection

```typescript
import { isDesktop, isPWA } from '@/lib/platform';

export default function Header() {
  const desktop = isDesktop();
  
  return (
    <div>
      {desktop && <MinimizeToTrayButton />}
      {!desktop && <InstallPWAButton />}
    </div>
  );
}
```

## 📦 Distribution

### Code Signing

**macOS:**
```bash
export APPLE_CERTIFICATE_PASSWORD="your-password"
export APPLE_ID="your-apple-id"
export APPLE_TEAM_ID="your-team-id"
npm run tauri:build
```

**Windows:**
Set in `tauri.conf.json`:
```json
{
  "bundle": {
    "windows": {
      "certificateThumbprint": "YOUR_THUMBPRINT",
      "timestampUrl": "http://timestamp.digicert.com"
    }
  }
}
```

### Auto-Updates

Configure in `tauri.conf.json`:

```json
{
  "plugins": {
    "updater": {
      "endpoints": [
        "https://releases.easymo.dev/desktop/{{target}}/{{current_version}}"
      ],
      "pubkey": "YOUR_PUBLIC_KEY"
    }
  }
}
```

Generate keys:
```bash
npm run tauri signer generate -- -w ~/.tauri/easymo.key
```

## 🧪 Testing

### Unit Tests
```bash
npm test
```

### E2E Tests (Desktop)
```bash
npm run test:desktop
```

### Manual Testing Checklist

- [ ] App launches successfully
- [ ] Tray icon appears and works
- [ ] Cmd+K shortcut triggers command palette
- [ ] Native notifications display
- [ ] File dialogs work
- [ ] Auto-start toggle works
- [ ] Window minimize/restore
- [ ] External links open in browser
- [ ] Updates check and install

## 🚧 Roadmap

### Phase 2: Advanced Features (Week 3-4)
- [ ] Multi-window support
- [ ] Hardware access (USB, Bluetooth)
- [ ] Deep OS integration (Spotlight, Alfred)
- [ ] Touch Bar support (macOS)
- [ ] Widget support

### Phase 3: Data & Sync (Week 5-6)
- [ ] SQLite integration
- [ ] Offline-first with sync
- [ ] Conflict resolution
- [ ] Secure credential storage

### Phase 4: Polish (Week 7-8)
- [ ] Performance optimization
- [ ] Accessibility audit
- [ ] Security hardening
- [ ] Beta testing

## 📊 Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| Bundle Size | ~15MB | TBD |
| Memory Usage | <200MB | TBD |
| Startup Time | <2s | TBD |
| First Paint | <1.5s | TBD |

## 🐛 Troubleshooting

### Build fails on macOS
```bash
# Install Xcode Command Line Tools
xcode-select --install

# Update Rust
rustup update
```

### Build fails on Windows
```bash
# Install Visual Studio Build Tools
# Download from: https://visualstudio.microsoft.com/downloads/
```

### Tauri commands not working
Check that commands are registered in `lib.rs`:
```rust
.invoke_handler(tauri::generate_handler![
    commands::your_command_here,
])
```

## 📚 Resources

- [Tauri Documentation](https://v2.tauri.app/)
- [Next.js Static Export](https://nextjs.org/docs/app/building-your-application/deploying/static-exports)
- [Tauri Plugins](https://v2.tauri.app/plugin/)
- [Code Signing Guide](https://v2.tauri.app/distribution/sign/)

## 🤝 Contributing

See main [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

## 📄 License

Same as parent project (see root LICENSE file).

---

**Status**: ✅ Phase 1 Complete - Desktop foundation ready for development!
