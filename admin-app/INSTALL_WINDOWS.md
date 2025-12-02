# EasyMO Admin - Windows Installation Guide

**For Internal Use Only**

---

## ⚙️ System Requirements

- Windows 10 (64-bit) or Windows 11
- 100 MB free disk space
- Internet connection

---

## 📥 Installation Steps

### Step 1: Download

1. Go to your company's internal releases page
2. Download **EasyMO Admin** for Windows (.msi file)
3. File will be saved to your Downloads folder

### Step 2: Install

> **⚠️ IMPORTANT:** Because this is an internal app, Windows SmartScreen will show a warning. This is normal and expected.

1. **Double-click** the downloaded MSI file
2. Windows SmartScreen will show: *"Windows protected your PC"*
3. Click **"More info"**
4. Click **"Run anyway"**
5. The installer will start
6. Click **"Next"**
7. Accept the license agreement
8. Choose installation location (default is fine)
9. Click **"Install"**
10. Click **"Finish"**

![Installation Steps](https://via.placeholder.com/600x400?text=Installation+Steps)

### Step 3: First Launch

1. Find **"EasyMO Admin"** in your Start Menu
2. Click to launch
3. App will open - no additional warnings! 🎉

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
| `Ctrl + K` | Open command palette |
| `Ctrl + W` | Close window |
| `Ctrl + M` | Minimize to tray |
| `Alt + F4` | Quit application |

---

## 🆘 Troubleshooting

### "This app has been blocked for your protection"

If you can't click "Run anyway":

1. **Right-click** the MSI file
2. Select **"Properties"**
3. Check **"Unblock"** at the bottom
4. Click **"Apply"**
5. Try installation again

### Installation fails

Try running as Administrator:

1. **Right-click** the MSI file
2. Select **"Run as administrator"**
3. Follow installation steps

### App won't launch

1. Check **Windows Event Viewer**:
   - Press `Win + X`
   - Select "Event Viewer"
   - Navigate to: Windows Logs → Application
   - Look for errors from "EasyMO Admin"

2. **Reinstall:**
   - Uninstall via Settings → Apps
   - Download fresh copy
   - Install again

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
2. Run the new installer (will upgrade automatically)
3. Restart the app

---

## 🗑️ Uninstalling

If you need to remove the app:

1. Quit EasyMO Admin
2. Open **Settings → Apps**
3. Find **"EasyMO Admin"**
4. Click **"Uninstall"**

To remove all app data:
```powershell
Remove-Item -Recurse -Force "$env:APPDATA\com.easymo.admin"
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\com.easymo.admin"
```

---

## 🏢 IT Team: Silent Installation

For mass deployment via Group Policy:

```powershell
msiexec /i "EasyMO Admin_1.0.0_x64_en-US.msi" /quiet /norestart
```

---

**Questions?** Contact #desktop-app-support on Slack
