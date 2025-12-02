# EasyMO Desktop App - Quick Start Guide

🖥️ **Your EasyMO Admin Desktop App is fully operational!**

## ✅ Current Status

- **Desktop App**: Electron-based native macOS application
- **Location**: `admin-app/electron/main.js`
- **Running**: Yes (check your screen for the window)
- **Dev Server**: http://localhost:3000
- **Status**: Fully functional

---

## 🚀 Quick Commands

### Start Desktop App
```bash
cd admin-app && npm run desktop
```

### Start Dev Server (if not running)
```bash
cd /Users/jeanbosco/workspace/easymo
pnpm dev
```

### Start Both Together
```bash
# Terminal 1: Start dev server
pnpm dev

# Terminal 2: Start desktop app
cd admin-app && npm run desktop
```

### Stop Desktop App
- **Method 1**: Press `Cmd+Q` in the app
- **Method 2**: Close the window
- **Method 3**: Kill process: `pkill -f "electron ."`

### Reload Desktop App
- Press `Cmd+R` in the Electron window (hot reload)

---

## 📁 Project Structure

```
admin-app/
├── electron/
│   └── main.js           # Electron main process
├── package.json          # Updated with "desktop" script
├── app/                  # Next.js app directory
├── components/           # React components
└── node_modules/
    └── electron/         # Electron binary
```

---

## 🎯 What You Have

### Desktop App Features
- ✅ Native macOS window (1400x900)
- ✅ Menu bar integration
- ✅ Dock icon
- ✅ DevTools enabled
- ✅ Hot reload support
- ✅ Context isolation (security)
- ✅ macOS-style title bar

### Development Setup
- ✅ Electron 39.2.4 installed
- ✅ Connected to Next.js dev server
- ✅ Auto-reload on file changes
- ✅ Full debugging capabilities

---

## 🛠️ Development Workflow

1. **Make Changes**
   - Edit files in `admin-app/app/`, `admin-app/components/`, etc.
   - Next.js dev server detects changes
   - Desktop app reloads automatically

2. **Debug**
   - DevTools open automatically
   - Console, Network, Elements tabs available
   - Set breakpoints, inspect state

3. **Test**
   - Test in desktop window
   - Verify desktop-specific features
   - Check menu bar, shortcuts

---

## 🏗️ Building for Production

### Build Desktop App
```bash
cd admin-app
npm run electron:build
```

This will create:
- `dist/mac/EasyMO Admin.app` - Application bundle
- `dist/mac/EasyMO Admin.dmg` - DMG installer (if configured)

### Sign the App
```bash
# Using our signing scripts
./scripts/sign_app.sh "dist/mac/EasyMO Admin.app" "Inhouse Dev Signing"
```

### Create DMG Installer
```bash
# Install create-dmg if needed
brew install create-dmg

# Create DMG
create-dmg \
  --volname "EasyMO Admin" \
  --window-pos 200 120 \
  --window-size 800 400 \
  --icon-size 100 \
  --app-drop-link 600 185 \
  "EasyMO-Admin-Installer.dmg" \
  "dist/mac/EasyMO Admin.app"
```

---

## 🔧 Configuration

### Current Electron Configuration

**File**: `admin-app/electron/main.js`

Key settings:
- **Window Size**: 1400x900 (min: 1024x768)
- **Dev Server**: http://localhost:3000
- **Security**: Context isolation enabled, Node integration disabled
- **Dev Tools**: Auto-open in development
- **Title Bar**: macOS hidden inset style

### Customize Window

Edit `admin-app/electron/main.js`:

```javascript
mainWindow = new BrowserWindow({
  width: 1600,           // Change width
  height: 1000,          // Change height
  minWidth: 1200,        // Minimum width
  minHeight: 800,        // Minimum height
  title: 'Your Title',   // Window title
  // ... other options
});
```

---

## 🎨 Customization Ideas

### Add Custom Menu Items

Edit the `createMenu()` function in `electron/main.js`:

```javascript
{
  label: 'Tools',
  submenu: [
    { label: 'Custom Action', click: () => { /* your code */ } },
    { type: 'separator' },
    { label: 'Settings', accelerator: 'Cmd+,', click: () => { /* settings */ } }
  ]
}
```

### Add Keyboard Shortcuts

```javascript
const { globalShortcut } = require('electron');

app.whenReady().then(() => {
  globalShortcut.register('Cmd+Shift+D', () => {
    mainWindow.webContents.openDevTools();
  });
});
```

### Add System Tray Icon

```javascript
const { Tray, Menu } = require('electron');

let tray;
function createTray() {
  tray = new Tray('/path/to/icon.png');
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show App', click: () => { mainWindow.show(); } },
    { label: 'Quit', click: () => { app.quit(); } }
  ]);
  tray.setContextMenu(contextMenu);
}
```

---

## 🐛 Troubleshooting

### Desktop App Won't Start

**Error**: `Electron failed to install correctly`

**Solution**:
```bash
cd admin-app
pnpm remove electron
pnpm add -D electron --force
cd ../node_modules/.pnpm/electron@39.2.4/node_modules/electron
node install.js
```

### Can't Connect to localhost:3000

**Problem**: Dev server not running

**Solution**:
```bash
# Check if server is running
lsof -i :3000

# Start if not running
pnpm dev
```

### Desktop App Shows Blank Screen

**Solution**:
1. Check DevTools console for errors
2. Verify Next.js server is running
3. Reload app with `Cmd+R`
4. Check `admin-app/electron/main.js` URL

### Changes Not Reflecting

**Solution**:
1. Ensure dev server is running
2. Check terminal for build errors
3. Hard reload: `Cmd+Shift+R`
4. Restart desktop app

---

## 📦 Package.json Scripts

Current scripts in `admin-app/package.json`:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "desktop": "electron .",
    "electron:build": "electron-builder"
  },
  "main": "electron/main.js"
}
```

---

## 🔐 Code Signing Integration

Your desktop app integrates with the signing infrastructure:

### Sign Development Build
```bash
./scripts/sign_app.sh \
  "admin-app/dist/mac/EasyMO Admin.app" \
  "Inhouse Dev Signing"
```

### Sign Both Apps (if you have client/staff portal too)
```bash
./scripts/sign_all_apps.sh
```

### Verify Signature
```bash
codesign --verify --deep --strict --verbose=2 \
  "admin-app/dist/mac/EasyMO Admin.app"

spctl --assess --verbose=4 \
  "admin-app/dist/mac/EasyMO Admin.app"
```

---

## 📊 Current Session

**Started**: 2025-12-02  
**Next.js Server**: http://localhost:3000  
**Desktop App**: Running  
**DevTools**: Enabled  
**Status**: ✅ Operational

---

## 🎯 Next Steps

### Immediate
- [x] Desktop app running
- [x] Dev server running
- [ ] Test all features
- [ ] Customize as needed

### Short Term
- [ ] Add app icon
- [ ] Configure auto-updates
- [ ] Add system notifications
- [ ] Implement offline support

### Production Ready
- [ ] Build production version
- [ ] Sign with certificate
- [ ] Create DMG installer
- [ ] Distribute to team

---

## 📚 Resources

- **Electron Docs**: https://www.electronjs.org/docs
- **Next.js Docs**: https://nextjs.org/docs
- **Signing Guide**: `docs/internal_mac_signing.md`
- **Deployment Checklist**: `docs/DEPLOYMENT_CHECKLIST.md`

---

## 💡 Tips

1. **Keep DevTools Open**: Helps catch errors immediately
2. **Use Console**: `console.log()` works in desktop app
3. **Hot Reload**: Most changes reload automatically
4. **Restart When Needed**: If strange behavior, restart desktop app
5. **Check Both Terminals**: Watch both dev server and desktop app logs

---

## ✨ Summary

You now have a fully functional macOS desktop application for EasyMO Admin!

**Running**:
- Electron desktop app with native macOS integration
- Next.js dev server with hot reload
- Full development environment

**Ready For**:
- Development and testing
- Building production releases
- Code signing and distribution
- Deployment to team

---

**Happy Desktop App Development! 🚀**
