> **⚠️ DEPRECATION NOTICE**: This document has been consolidated into [docs/ANDROID.md](docs/ANDROID.md). Please refer to the consolidated guide for up-to-date information.

---

# Ibimina Staff Console - Android App

## Overview

The Ibimina Staff Console is now available as a native Android app with
automatic SMS ingestion for mobile money payments. This enables staff members to
automate payment reconciliation by reading MTN MoMo and Airtel Money transaction
notifications directly from their devices.

## Features

### 📱 Native Android App

- Full Progressive Web App (PWA) wrapped with Capacitor
- Native performance and offline capabilities
- Camera access for ID verification
- Push notifications for important updates
- Installable on Android devices (5.1+)

### 💸 Automatic SMS Payment Ingestion

- **Selective Access:** Only reads SMS from mobile money providers (MTN, Airtel)
- **Privacy-First:** Personal SMS never accessed
- **Background Sync:** Automatic 15-minute checks for new payments
- **Smart Parsing:** AI-powered extraction of payment details
- **Auto-Allocation:** Payments matched to members automatically

### 🔒 Security & Privacy

- ✅ Phone numbers encrypted with AES-256
- ✅ All communication over HTTPS with HMAC authentication
- ✅ No SMS data stored on device
- ✅ Explicit user consent required
- ✅ Enable/disable toggle in settings
- ✅ Full privacy policy disclosure

## Installation for Staff

### Step 1: Download the App

You will receive a download link via:

- Email invitation (Firebase App Distribution)
- Internal staff portal
- Your IT administrator

### Step 2: Install

1. Tap the download link on your Android device
2. Download the APK file
3. If prompted, allow installation from unknown sources:
   - Go to **Settings → Security**
   - Enable **Install from Unknown Sources** for your browser
4. Open the downloaded APK and tap **Install**
5. Wait for installation to complete

### Step 3: Initial Setup

1. Open **Ibimina Staff** app
2. Log in with your staff credentials (email and password)
3. Navigate to **Settings → SMS Consent**
4. Read the privacy policy carefully
5. Tap **Grant SMS Permission**
6. Allow SMS access when prompted by Android

### Step 4: Verify

1. Send yourself a test mobile money SMS (or wait for a real one)
2. Go to **Settings → SMS Ingestion → Test Read SMS**
3. Verify your mobile money SMS appears in the list
4. Check the dashboard to see if payments are being processed

## Using SMS Ingestion

### Enabling/Disabling

1. Open **Settings → SMS Ingestion**
2. Toggle the switch to enable or disable
3. When enabled, background sync starts automatically

### Checking Status

- **Active:** Green indicator, scanning for payments every 15 minutes
- **Inactive:** Gray indicator, no SMS processing

### Configuring Sync Interval

1. Go to **Settings → SMS Ingestion**
2. Adjust the **Background Sync Interval** slider (5-60 minutes)
3. Tap **Update Interval**

### Testing SMS Reading

1. Go to **Settings → SMS Ingestion**
2. Tap **Test Read SMS**
3. View recently captured mobile money messages
4. Verify only MTN/Airtel messages appear

## Privacy & Data Usage

### What We Access

- **Mobile money SMS only:** MTN MoMo and Airtel Money payment confirmations
- **No personal SMS:** Your personal messages are never accessed

### What We Extract

From mobile money SMS, we extract:

- Transaction amount and ID
- Sender phone number (encrypted)
- Payment reference code
- Transaction timestamp

### Where Data Goes

- SMS text is sent to secure Supabase backend
- Parsed and matched to SACCO members
- Stored with encryption
- Used for payment reconciliation only

### Your Control

- ✅ Enable/disable anytime in Settings
- ✅ Revoke permissions in Android settings
- ✅ No SMS data stored on your device
- ✅ Full transparency in privacy policy

## Troubleshooting

### Problem: SMS not being captured

**Solutions:**

1. Verify SMS permissions are granted (Settings → Apps → Ibimina Staff →
   Permissions)
2. Check battery optimization (Settings → Battery → App optimization)
3. Ensure background sync is enabled in app settings
4. Restart the app

### Problem: Payments not showing in dashboard

**Solutions:**

1. Verify SMS was from MTN or Airtel
2. Check SMS includes proper reference code (e.g., GIC.SACCO1.GRP001.MBR123)
3. Wait for next sync (up to 15 minutes)
4. Check with administrator if payment appears in backend

### Problem: Battery draining fast

**Solutions:**

1. Increase sync interval to 30 or 60 minutes
2. Enable battery optimization for the app
3. Check if other apps are causing drain

### Problem: App crashes or errors

**Solutions:**

1. Clear app cache (Settings → Apps → Ibimina Staff → Clear Cache)
2. Reinstall the app
3. Contact your IT administrator
4. Report the issue with error details

## Support

### Getting Help

- **IT Administrator:** Contact your SACCO IT admin
- **User Guide:** Available in app under Settings → Help
- **Privacy Policy:** Available at Settings → Privacy Policy

### Reporting Issues

When reporting issues, include:

- Device model and Android version
- Description of the problem
- Steps to reproduce
- Screenshots if possible

## System Requirements

### Minimum

- Android 5.1 (API 22) or higher
- 100 MB free storage
- Internet connectivity (Wi-Fi or mobile data)
- SMS capability

### Recommended

- Android 10 or higher
- 500 MB free storage
- Stable Wi-Fi or 4G connection
- Device with 2GB+ RAM

## Updates

### Checking for Updates

The app will notify you when updates are available. You can also check manually:

1. Go to Settings → About
2. Tap **Check for Updates**
3. Download and install if available

### What's New

- **Version 1.0.0 (October 2025)**
  - Initial release
  - SMS ingestion for MTN and Airtel
  - Automatic payment allocation
  - Privacy-first design

## FAQs

**Q: Is this app safe to use?**  
A: Yes. The app only accesses mobile money SMS, encrypts all data, and uses
secure HTTPS connections. Full source code is reviewed by security experts.

**Q: Can other apps on my device access my SMS?**  
A: No. Android permissions are app-specific. Only Ibimina Staff can access SMS
if you grant permission.

**Q: What happens if I disable SMS ingestion?**  
A: Background sync stops, no more SMS are read, and you'll need to enter
payments manually.

**Q: Can I use the web version instead?**  
A: Yes, but SMS ingestion only works on the Android app. Web version requires
manual payment entry.

**Q: Is my personal SMS data sent to the server?**  
A: No. Only mobile money SMS from MTN/Airtel are processed. Personal SMS are
never accessed or transmitted.

**Q: How long are my SMS stored?**  
A: SMS text is processed immediately and not stored on your device. Parsed
payment data is stored on secure servers per SACCO record retention policy
(typically 7 years).

**Q: Can I use this on multiple devices?**  
A: Yes, but SMS ingestion should only be enabled on your primary work device to
avoid duplicate payments.

**Q: What if I lose my device?**  
A: Immediately contact your IT administrator to revoke device access. No SMS are
stored locally, so your personal data remains secure.

## Glossary

- **APK:** Android Package file used to install apps
- **SMS Ingestion:** Automatic reading and processing of SMS messages
- **Background Sync:** Periodic check for new SMS (runs in background)
- **HMAC:** Cryptographic authentication for secure API requests
- **RLS:** Row-Level Security for database access control
- **Edge Function:** Serverless API endpoint for SMS processing

## Legal

**Privacy Policy:** [View Full Policy](/privacy)  
**Terms of Use:** Contact your SACCO administrator  
**Data Retention:** Per SACCO financial record policies  
**Support:** Available through your SACCO IT department

---

**Version:** 1.0.0  
**Last Updated:** October 31, 2025  
**For:** Ibimina Staff Members  
**Platform:** Android 5.1+
