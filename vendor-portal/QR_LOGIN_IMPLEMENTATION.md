# QR Login Implementation - Staff Web App

## Overview

Biometric QR login allows staff to sign in to the web app by scanning a QR code
with their Staff Mobile App and authenticating with fingerprint/face. This
provides a secure, passwordless login experience with device-bound cryptography.

## Architecture

### Frontend Components

#### 1. **QR Login Component** (`components/auth/qr-login.tsx`)

The main React component that handles the QR login flow.

**Features:**

- Generates QR code from challenge data
- Real-time status updates (generating, waiting, success, error, expired)
- Polling for verification status (2-second intervals)
- 60-second expiry countdown timer
- Automatic retry functionality
- Security features display

**Props:**

```typescript
interface QRLoginProps {
  onSuccess?: (data: {
    user_id: string;
    device_id: string;
    session_id: string;
  }) => void;
  onError?: (error: string) => void;
}
```

**States:**

- `idle` - Initial state
- `generating` - Creating QR challenge
- `waiting` - Waiting for mobile app to scan
- `verifying` - Checking verification status
- `success` - Authentication successful
- `error` - Error occurred
- `expired` - QR code expired (60 seconds)

#### 2. **Device Login Page** (`components/auth/device-login-page.tsx`)

Wrapper page for the QR login component with navigation and help text.

#### 3. **Login Page Enhancement** (`app/(auth)/login/page.tsx`)

Added "Sign in with Biometric Authentication" button to main login page.

#### 4. **Device Login Route** (`app/(auth)/device-login/page.tsx`)

Dedicated route for QR login at `/device-login`.

### Backend API Endpoints

#### 1. **Generate Challenge** (`/api/device-auth/challenge`)

**Method:** POST

**Response:**

```json
{
  "success": true,
  "challenge": {
    "ver": 1,
    "session_id": "uuid-v4",
    "origin": "https://admin.ibimina.rw",
    "nonce": "128-bit-random-hex",
    "exp": 1730376123,
    "aud": "web-login"
  },
  "session_id": "uuid-v4",
  "expires_at": "2025-10-31T12:35:23.000Z"
}
```

**Actions:**

- Generates unique session_id and nonce
- Sets 60-second expiry
- Stores challenge in `device_auth_challenges` table
- Logs audit event

#### 2. **Verify Status** (`/api/device-auth/verify-status`)

**Method:** GET **Query Params:** `?session_id=<uuid>`

**Response (Not Verified):**

```json
{
  "success": false,
  "verified": false
}
```

**Response (Verified):**

```json
{
  "success": true,
  "verified": true,
  "user_id": "uuid",
  "device_id": "uuid",
  "device_label": "Pixel 7 Pro",
  "session_id": "uuid"
}
```

**Actions:**

- Checks if challenge has been verified (`used_at` is set)
- Returns device and user information if verified
- Used by frontend polling (2-second intervals)

#### 3. **Verify Challenge** (`/api/device-auth/verify`)

**Method:** POST **Called by:** Mobile app (not web)

**Body:**

```json
{
  "session_id": "uuid",
  "device_id": "uuid",
  "signature": "base64-signature",
  "signed_message": {
    "ver": 1,
    "user_id": "uuid",
    "device_id": "uuid",
    "session_id": "uuid",
    "origin": "https://admin.ibimina.rw",
    "nonce": "hex",
    "ts": 1730376110,
    "scope": ["login"],
    "alg": "ES256"
  },
  "integrity_token": "play-integrity-token"
}
```

**Actions:**

- Verifies cryptographic signature
- Checks origin, nonce, expiry, one-time use
- Validates Play Integrity token (optional)
- Marks challenge as used
- Upgrades session to authenticated

## User Flow

### 1. **Web App (Staff visits `/login`)**

```
1. User clicks "Sign in with Biometric Authentication"
2. Redirected to `/device-login`
3. QR code automatically generated and displayed
4. 60-second countdown starts
5. Frontend polls `/api/device-auth/verify-status` every 2 seconds
```

### 2. **Mobile App (Staff scans QR)**

```
1. User opens Staff Mobile App
2. Taps "QR Login" or scans QR code
3. App validates challenge (format, expiry, origin)
4. Shows approval screen with origin and timestamp
5. User taps "Approve"
6. Biometric prompt appears (fingerprint/face)
7. User authenticates with biometric
8. App signs challenge with device private key
9. App sends signature to /api/device-auth/verify
```

### 3. **Backend Verification**

```
1. Receives signed challenge from mobile app
2. Validates all 9 required fields
3. Checks origin matches (phishing prevention)
4. Checks nonce matches (replay prevention)
5. Checks one-time use (replay prevention)
6. Checks timestamp within 2 minutes (clock skew tolerance)
7. Verifies ES256 signature with device public key
8. Optionally verifies Play Integrity token
9. Marks challenge as used
10. Associates challenge with user_id
```

### 4. **Web App (Polling detects success)**

```
1. Polling detects challenge is verified
2. Retrieves user_id and device info
3. Shows "Authentication Successful!" message
4. Redirects to dashboard (`/`)
5. Session cookie is set (Supabase auth)
```

## Security Features

### **Phishing Resistance**

- QR contains challenge only (no secrets)
- Origin binding (exact domain match required)
- Mobile app displays origin to user for verification
- Backend validates origin server-side

### **Replay Prevention**

- One-time nonce (128-bit random)
- Single-use challenges (`used_at` check)
- 60-second expiry window
- Timestamp validation (2-minute tolerance)

### **Device Binding**

- Private key never leaves Android Keystore
- Biometric authentication required for every signature
- Device enrollment required before QR login
- Device revocation support

### **Cryptographic Verification**

- ES256 (ECDSA with P-256) signatures
- Public key stored in database
- Signature verified server-side
- Canonical message format (deterministic JSON)

### **Integrity Checking**

- Play Integrity API integration (optional)
- Device integrity verdicts stored
- Rooted/compromised device detection
- Verdict-based policy enforcement

## Database Schema

### **device_auth_challenges**

```sql
CREATE TABLE device_auth_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) UNIQUE NOT NULL,
  nonce VARCHAR(255) NOT NULL,
  origin VARCHAR(500) NOT NULL,
  challenge_data JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  verified_by_device UUID REFERENCES device_auth_keys(id),
  ip_address VARCHAR(100),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON device_auth_challenges(session_id);
CREATE INDEX ON device_auth_challenges(expires_at);
```

### **device_auth_keys**

```sql
CREATE TABLE device_auth_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  device_id VARCHAR(255) UNIQUE NOT NULL,
  device_label VARCHAR(255),
  public_key TEXT NOT NULL,
  key_algorithm VARCHAR(50) DEFAULT 'ES256',
  integrity_verdict JSONB,
  integrity_status VARCHAR(50),
  last_integrity_check_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### **device_auth_audit**

```sql
CREATE TABLE device_auth_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100) NOT NULL,
  user_id UUID,
  device_key_id UUID,
  challenge_id UUID,
  success BOOLEAN DEFAULT false,
  failure_reason VARCHAR(500),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## Configuration

### **Environment Variables**

- `NEXT_PUBLIC_SITE_URL` - Web app origin (e.g., `https://admin.ibimina.rw`)
- `DATABASE_URL` - PostgreSQL connection string

### **Dependencies**

```json
{
  "qrcode": "^1.5.4",
  "@types/qrcode": "^1.5.5"
}
```

### **Tailwind Classes Used**

- `atlas-blue` - Primary blue color (#0066FF)
- `neutral-*` - Neutral color scale
- `shadow-atlas` - Custom shadow
- `rounded-2xl` - Rounded corners

## Testing

### **Manual Test Flow**

1. Visit `http://localhost:3100/device-login`
2. QR code should appear immediately
3. Countdown timer shows 60 seconds
4. Use Staff Mobile App to scan
5. Approve with biometric on mobile
6. Web page should redirect to dashboard within 2 seconds

### **Error Scenarios**

- **No device enrolled:** Mobile app shows error
- **QR expired:** Web shows "QR Code Expired" with retry button
- **Network error:** Web shows "Error" with retry button
- **Invalid signature:** Mobile app shows verification failed

## Future Enhancements

### **Same-Device Flow**

For users on Android phone visiting web:

- Use Android App Links to open mobile app
- Pass session_id via deep link
- Sign in-app and return to browser

### **WebSocket Instead of Polling**

- Replace polling with WebSocket/SSE
- Instant notification when authenticated
- Reduced server load

### **Server-Side Public Key in QR**

- Add `server_pubkey_id` to challenge
- Enable key rotation
- Verify server identity on mobile

### **Strict Integrity Enforcement**

- Reject devices that fail Play Integrity
- Configurable policy levels
- Admin dashboard for device management

## Troubleshooting

### **QR Code Not Generating**

- Check `/api/device-auth/challenge` endpoint
- Verify DATABASE_URL is set
- Check database migration applied
- Check browser console for errors

### **Mobile App Can't Verify**

- Ensure device is enrolled first
- Check origin matches exactly
- Verify signature algorithm (ES256)
- Check signed message has all 9 fields

### **Polling Not Detecting Success**

- Check `/api/device-auth/verify-status` returns data
- Verify challenge.used_at is set
- Check device_auth_keys table has entry
- Look for CORS errors in browser console

### **Session Not Created**

- Verify Supabase auth configured
- Check session cookie being set
- Ensure redirect to `/` works
- Check user exists in `users` table

## Files Created/Modified

### **New Files:**

- `components/auth/qr-login.tsx` - Main QR login component
- `components/auth/device-login-page.tsx` - Page wrapper
- `app/(auth)/device-login/page.tsx` - Route handler
- `app/api/device-auth/verify-status/route.ts` - Polling endpoint
- `QR_LOGIN_IMPLEMENTATION.md` - This documentation

### **Modified Files:**

- `app/(auth)/login/page.tsx` - Added biometric login button
- `package.json` - Added qrcode dependency

### **Existing Files (Backend):**

- `app/api/device-auth/challenge/route.ts` - Challenge generation
- `app/api/device-auth/verify/route.ts` - Signature verification
- `app/api/device-auth/enroll/route.ts` - Device enrollment
- Android Kotlin files (DeviceKeyManager, ChallengeSigner, etc.)

## Summary

The QR Login UI is **production-ready** and provides:

- ✅ Secure biometric authentication
- ✅ Phishing-resistant (origin binding)
- ✅ Replay-resistant (one-time nonce)
- ✅ Device-bound (Android Keystore)
- ✅ User-friendly (1-click login)
- ✅ Real-time feedback (polling + countdown)
- ✅ Error handling (retry, expired, network errors)
- ✅ Atlas design system integration

**Staff can now log in to the web app by scanning a QR code with their
fingerprint/face!** 🎉
