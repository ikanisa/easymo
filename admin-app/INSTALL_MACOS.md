# EasyMO Admin - macOS Installation Guide

**For Internal Use Only**

---

## ⚙️ System Requirements

- macOS 10.15 (Catalina) or later
- 100 MB free disk space
- Internet connection

---

## 📥 Installation Steps

### Step 1: Download

1. Go to your company's internal releases page
2. Download **EasyMO Admin** for macOS
3. File will be saved to your Downloads folder

### Step 2: Install

> **⚠️ IMPORTANT:** Because this is an internal app, macOS will show a security warning. This is normal and expected.

1. **Right-click** (or Control+Click) the downloaded DMG file
2. Select **"Open"** from the menu
3. macOS will show: *"macOS cannot verify the developer"*
4. Click **"Open"** again in the dialog
5. The DMG will mount
6. **Drag "EasyMO Admin"** to the **Applications folder**

![Installation Steps](https://via.placeholder.com/600x400?text=Installation+Steps)

### Step 3: First Launch

1. Open your **Applications folder**
2. **Right-click "EasyMO Admin.app"**
3. Select **"Open"**
4. Click **"Open"** in the warning dialog
5. The app will launch successfully! 🎉

> **Note:** You only need to right-click the **first time**. After that, you can double-click normally.

---

## 🔑 Login

1. Enter your company email
2. Enter your password
3. Click "Sign In"

If you don't have credentials, contact IT support.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘ + K` | Open command palette |
| `⌘ + W` | Close window |
| `⌘ + M` | Minimize to tray |
| `⌘ + Q` | Quit application |

---

## 🆘 Troubleshooting

### "App is damaged and can't be opened"

This sometimes happens with internal apps. Fix:

1. Open **Terminal** (Applications → Utilities → Terminal)
2. Paste this command:
   ```bash
   xattr -cr "/Applications/EasyMO Admin.app"
   ```
3. Press Enter
4. Try opening the app again

### App doesn't open

1. Go to **System Preferences → Security & Privacy → General**
2. You should see: *"EasyMO Admin was blocked"*
3. Click **"Open Anyway"**
4. Try launching again

### Still having issues?

Contact IT Support:
- **Slack:** #desktop-app-support
- **Email:** desktop-support@easymo.dev
- **Response time:** < 4 hours

---

## 🔄 Updating

When a new version is available, you'll see a notification in the app.

**To update:**
1. Download the new version
2. Install over the existing version (settings are preserved)
3. Restart the app

---

## 🗑️ Uninstalling

If you need to remove the app:

1. Quit EasyMO Admin
2. Move **EasyMO Admin.app** to Trash
3. Empty Trash

To remove all app data:
```bash
rm -rf ~/Library/Application\ Support/com.easymo.admin
rm -rf ~/Library/Caches/com.easymo.admin
```

---

**Questions?** Contact #desktop-app-support on Slack
