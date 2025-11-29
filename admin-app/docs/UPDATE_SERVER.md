# Update Server Configuration
# ===========================

This document describes the auto-update server setup for EasyMO Admin Desktop.

## Architecture

```
releases.easymo.dev/
├── desktop/
│   ├── windows/
│   │   ├── 1.0.0/
│   │   │   ├── EasyMO-Admin-1.0.0-x64.msi
│   │   │   └── EasyMO-Admin-1.0.0-x64.msi.sig
│   │   └── latest.json
│   ├── darwin/
│   │   ├── 1.0.0/
│   │   │   ├── EasyMO-Admin-1.0.0-universal.dmg
│   │   │   ├── EasyMO-Admin-1.0.0-universal.dmg.sig
│   │   │   └── EasyMO-Admin-1.0.0-universal.app.tar.gz
│   │   └── latest.json
│   └── darwin-aarch64/
│       └── latest.json (symlink to darwin)
```

## latest.json Format

### Windows (windows/latest.json)
```json
{
  "version": "1.0.0",
  "notes": "Bug fixes and performance improvements",
  "pub_date": "2025-11-29T10:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "BASE64_SIGNATURE_HERE",
      "url": "https://releases.easymo.dev/desktop/windows/1.0.0/EasyMO-Admin-1.0.0-x64.msi"
    }
  }
}
```

### macOS (darwin/latest.json)
```json
{
  "version": "1.0.0",
  "notes": "Bug fixes and performance improvements",
  "pub_date": "2025-11-29T10:00:00Z",
  "platforms": {
    "darwin-x86_64": {
      "signature": "BASE64_SIGNATURE_HERE",
      "url": "https://releases.easymo.dev/desktop/darwin/1.0.0/EasyMO-Admin-1.0.0-universal.app.tar.gz"
    },
    "darwin-aarch64": {
      "signature": "BASE64_SIGNATURE_HERE",
      "url": "https://releases.easymo.dev/desktop/darwin/1.0.0/EasyMO-Admin-1.0.0-universal.app.tar.gz"
    }
  }
}
```

## Deployment Options

### Option 1: Netlify (Recommended)
```bash
# netlify.toml in release-server repo
[build]
  publish = "dist"

[[redirects]]
  from = "/desktop/:platform/:version/*"
  to = "/desktop/:platform/:version/:splat"
  status = 200

[[headers]]
  for = "/*.sig"
  [headers.values]
    Content-Type = "application/octet-stream"
    Cache-Control = "public, max-age=3600"

[[headers]]
  for = "/latest.json"
  [headers.values]
    Content-Type = "application/json"
    Cache-Control = "public, max-age=300"
```

### Option 2: AWS S3 + CloudFront
```bash
# Deploy script
aws s3 sync dist/ s3://releases.easymo.dev/ --acl public-read
aws cloudfront create-invalidation --distribution-id YOUR_ID --paths "/*"
```

### Option 3: Supabase Storage
```typescript
// Upload to Supabase Storage
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function uploadRelease(version: string, platform: string, file: Buffer) {
  const path = `desktop/${platform}/${version}/${file.name}`;
  const { data, error } = await supabase.storage
    .from('releases')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false
    });
  
  if (error) throw error;
  
  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('releases')
    .getPublicUrl(path);
  
  return publicUrl;
}
```

## Update Manifest Generation

```bash
#!/bin/bash
# scripts/generate-update-manifest.sh

VERSION=$1
PLATFORM=$2
SIG_FILE=$3
INSTALLER_URL=$4

cat > latest.json <<EOF
{
  "version": "$VERSION",
  "notes": "See https://github.com/ikanisa/easymo/releases/tag/desktop-v$VERSION",
  "pub_date": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "platforms": {
    "$PLATFORM": {
      "signature": "$(cat $SIG_FILE)",
      "url": "$INSTALLER_URL"
    }
  }
}
EOF
```

## Security

1. **HTTPS Required**: Auto-updates ONLY work over HTTPS
2. **Signature Verification**: Every update is cryptographically signed
3. **Public Key**: Embedded in tauri.conf.json
4. **Private Key**: Never committed, stored in CI/CD secrets

## Testing

```bash
# Test update endpoint
curl -v https://releases.easymo.dev/desktop/windows/latest.json

# Expected response:
# - Status: 200 OK
# - Content-Type: application/json
# - Valid JSON with version, signature, url
```

## Monitoring

### Metrics to Track
- Update check requests (per platform)
- Update downloads (per version)
- Update failures
- Average update duration

### Implementation
```typescript
// app/lib/updater.ts
import { logStructuredEvent } from '@/lib/monitoring';

async function checkForUpdates() {
  const startTime = Date.now();
  
  try {
    const update = await check();
    
    if (update?.available) {
      await logStructuredEvent('UPDATE_AVAILABLE', {
        currentVersion: await getVersion(),
        newVersion: update.version,
        platform: await platform(),
      });
    }
    
    await logStructuredEvent('UPDATE_CHECK_SUCCESS', {
      duration: Date.now() - startTime,
      updateAvailable: update?.available || false,
    });
  } catch (error) {
    await logStructuredEvent('UPDATE_CHECK_FAILED', {
      error: error.message,
      duration: Date.now() - startTime,
    });
  }
}
```

## Rollback Strategy

If a release has critical bugs:

1. **Immediate**: Revert latest.json to previous version
```bash
cp desktop/windows/1.0.0/latest.json desktop/windows/latest.json
```

2. **Next Update**: Release hotfix version (1.0.1)

3. **Notify Users**: Via in-app notification or email

## Release Checklist

- [ ] Build for all platforms (Windows, macOS Intel, macOS ARM)
- [ ] Sign all binaries
- [ ] Notarize macOS app
- [ ] Generate update signatures
- [ ] Upload installers to server
- [ ] Update latest.json for each platform
- [ ] Test update flow on each platform
- [ ] Create GitHub release with notes
- [ ] Monitor Sentry for crash reports
- [ ] Monitor update adoption rate
