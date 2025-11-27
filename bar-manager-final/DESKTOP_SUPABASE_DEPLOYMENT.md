# Desktop App - Full Deployment to Supabase Guide

**Purpose**: Deploy the desktop app update system and release infrastructure to Supabase  
**Platform**: Supabase Edge Functions + Storage  
**Status**: Ready for deployment

---

## Overview

While the desktop app itself is distributed via GitHub Releases, we need Supabase for:
1. **Update manifest hosting** - Update metadata and version info
2. **Analytics tracking** - Desktop app usage metrics
3. **User preferences sync** - Settings synchronization across devices
4. **Crash reporting** - Desktop-specific error tracking

---

## Prerequisites

```bash
# Ensure you have Supabase CLI installed
supabase --version

# Login to Supabase
supabase login

# Link to your project
cd admin-app
supabase link --project-ref <your-project-ref>
```

---

## Step 1: Database Schema for Desktop

Create a new migration for desktop app tracking:

```bash
supabase migration new desktop_app_schema
```

Add to the migration file:

```sql
-- Desktop app installations tracking
CREATE TABLE IF NOT EXISTS public.desktop_installations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL, -- 'macos', 'windows', 'linux'
  architecture TEXT NOT NULL, -- 'aarch64', 'x86_64'
  app_version TEXT NOT NULL,
  os_version TEXT,
  first_installed_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Desktop app update checks
CREATE TABLE IF NOT EXISTS public.desktop_update_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  current_version TEXT NOT NULL,
  latest_version TEXT NOT NULL,
  update_available BOOLEAN NOT NULL,
  checked_at TIMESTAMPTZ DEFAULT NOW()
);

-- Desktop app analytics events
CREATE TABLE IF NOT EXISTS public.desktop_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Desktop app crashes
CREATE TABLE IF NOT EXISTS public.desktop_crashes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  app_version TEXT NOT NULL,
  platform TEXT NOT NULL,
  stack_trace TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_desktop_installations_user_id ON public.desktop_installations(user_id);
CREATE INDEX idx_desktop_installations_device_id ON public.desktop_installations(device_id);
CREATE INDEX idx_desktop_update_checks_device_id ON public.desktop_update_checks(device_id);
CREATE INDEX idx_desktop_analytics_device_id ON public.desktop_analytics(device_id);
CREATE INDEX idx_desktop_analytics_event_type ON public.desktop_analytics(event_type);
CREATE INDEX idx_desktop_crashes_device_id ON public.desktop_crashes(device_id);
CREATE INDEX idx_desktop_crashes_created_at ON public.desktop_crashes(created_at DESC);

-- RLS Policies
ALTER TABLE public.desktop_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desktop_update_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desktop_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desktop_crashes ENABLE ROW LEVEL SECURITY;

-- Allow users to read/write their own installation data
CREATE POLICY "Users can view own installations"
  ON public.desktop_installations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own installations"
  ON public.desktop_installations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own installations"
  ON public.desktop_installations FOR UPDATE
  USING (auth.uid() = user_id);

-- Allow anonymous update checks (public API)
CREATE POLICY "Anyone can check for updates"
  ON public.desktop_update_checks FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can log update checks"
  ON public.desktop_update_checks FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Analytics policies
CREATE POLICY "Users can view own analytics"
  ON public.desktop_analytics FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone can log analytics events"
  ON public.desktop_analytics FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Crash reporting policies
CREATE POLICY "Anyone can report crashes"
  ON public.desktop_crashes FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Admins can view all data
CREATE POLICY "Admins can view all installations"
  ON public.desktop_installations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

CREATE POLICY "Admins can view all analytics"
  ON public.desktop_analytics FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

CREATE POLICY "Admins can view all crashes"
  ON public.desktop_crashes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_desktop_installations_updated_at
  BEFORE UPDATE ON public.desktop_installations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

Apply the migration:

```bash
supabase db push
```

---

## Step 2: Create Supabase Edge Functions

### Function 1: Update Checker

```bash
supabase functions new desktop-update-checker
```

Create `supabase/functions/desktop-update-checker/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface UpdateCheckRequest {
  current_version: string
  platform: string
  architecture: string
  device_id: string
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const { current_version, platform, architecture, device_id }: UpdateCheckRequest =
      await req.json()

    // Fetch latest version from GitHub Releases
    const githubResponse = await fetch(
      'https://api.github.com/repos/ikanisa/easymo-/releases/latest',
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'EasyMO-Desktop-Updater',
        },
      }
    )

    if (!githubResponse.ok) {
      throw new Error('Failed to fetch latest release')
    }

    const release = await githubResponse.json()
    const latest_version = release.tag_name.replace('desktop-v', '')
    const update_available = latest_version !== current_version

    // Find appropriate asset for platform/architecture
    const assetKey = `${platform}-${architecture}`
    const assetMap: Record<string, string> = {
      'macos-aarch64': '.app.tar.gz',
      'macos-x86_64': '.app.tar.gz',
      'windows-x86_64': '.msi',
      'linux-x86_64': '.AppImage',
    }

    const assetExtension = assetMap[assetKey]
    const asset = release.assets.find((a: any) =>
      a.name.includes(assetExtension) && a.name.includes(architecture)
    )

    // Log update check
    await supabase.from('desktop_update_checks').insert({
      device_id,
      current_version,
      latest_version,
      update_available,
    })

    return new Response(
      JSON.stringify({
        version: latest_version,
        current_version,
        available: update_available,
        download_url: asset?.browser_download_url,
        release_notes: release.body,
        published_at: release.published_at,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Update check error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
```

### Function 2: Analytics Tracker

```bash
supabase functions new desktop-analytics
```

Create `supabase/functions/desktop-analytics/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const {
      device_id,
      user_id,
      event_type,
      event_data,
    } = await req.json()

    // Insert analytics event
    const { error } = await supabase
      .from('desktop_analytics')
      .insert({
        device_id,
        user_id: user_id || null,
        event_type,
        event_data,
      })

    if (error) throw error

    // Update last_active_at for installation
    if (device_id) {
      await supabase
        .from('desktop_installations')
        .update({ last_active_at: new Date().toISOString() })
        .eq('device_id', device_id)
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Analytics error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
```

### Function 3: Crash Reporter

```bash
supabase functions new desktop-crash-reporter
```

Create `supabase/functions/desktop-crash-reporter/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const {
      device_id,
      app_version,
      platform,
      stack_trace,
      error_message,
      metadata,
    } = await req.json()

    // Insert crash report
    const { error } = await supabase
      .from('desktop_crashes')
      .insert({
        device_id,
        app_version,
        platform,
        stack_trace,
        error_message,
        metadata,
      })

    if (error) throw error

    // TODO: Send alert to Sentry/monitoring system for critical crashes

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Crash report error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
```

---

## Step 3: Deploy Edge Functions

```bash
# Deploy all desktop functions
supabase functions deploy desktop-update-checker
supabase functions deploy desktop-analytics
supabase functions deploy desktop-crash-reporter

# Or deploy all at once
supabase functions deploy
```

---

## Step 4: Update Desktop App Configuration

Update `admin-app/src-tauri/tauri.conf.json`:

```json
{
  "plugins": {
    "updater": {
      "endpoints": [
        "https://your-project-ref.supabase.co/functions/v1/desktop-update-checker"
      ],
      "pubkey": "YOUR_PUBLIC_KEY_HERE"
    }
  }
}
```

Generate signing keys for updates:

```bash
# Generate update signing keypair
cd admin-app/src-tauri
openssl genpkey -algorithm RSA -out private_key.pem -pkeyopt rsa_keygen_bits:2048
openssl rsa -pubout -in private_key.pem -out public_key.pem

# Convert to required format
cat public_key.pem | openssl base64 -A
```

Add the public key to `tauri.conf.json` and the private key to GitHub Secrets as `TAURI_SIGNING_PRIVATE_KEY`.

---

## Step 5: Update Desktop App Client Code

Create `admin-app/lib/desktop-analytics.ts`:

```typescript
import { isDesktop } from './platform';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const DEVICE_ID = getDeviceId();

function getDeviceId(): string {
  if (typeof window === 'undefined') return 'unknown';
  
  let deviceId = localStorage.getItem('desktop_device_id');
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem('desktop_device_id', deviceId);
  }
  return deviceId;
}

export async function trackDesktopEvent(
  eventType: string,
  eventData?: Record<string, any>
): Promise<void> {
  if (!isDesktop()) return;

  try {
    await fetch(`${SUPABASE_URL}/functions/v1/desktop-analytics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        device_id: DEVICE_ID,
        event_type: eventType,
        event_data: eventData || {},
      }),
    });
  } catch (error) {
    console.error('Failed to track desktop event:', error);
  }
}

export async function reportDesktopCrash(
  error: Error,
  metadata?: Record<string, any>
): Promise<void> {
  if (!isDesktop()) return;

  try {
    const { getPlatformInfo, getAppVersion } = await import('./platform');
    const platformInfo = await getPlatformInfo();
    const appVersion = await getAppVersion();

    await fetch(`${SUPABASE_URL}/functions/v1/desktop-crash-reporter`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        device_id: DEVICE_ID,
        app_version: appVersion,
        platform: platformInfo.platform,
        stack_trace: error.stack,
        error_message: error.message,
        metadata: {
          ...metadata,
          os_version: platformInfo.version,
          architecture: platformInfo.arch,
        },
      }),
    });
  } catch (reportError) {
    console.error('Failed to report crash:', reportError);
  }
}

// Track app lifecycle events
export function initializeDesktopAnalytics(): void {
  if (!isDesktop()) return;

  // Track app start
  trackDesktopEvent('app_started');

  // Track app close
  window.addEventListener('beforeunload', () => {
    trackDesktopEvent('app_closed');
  });

  // Track errors
  window.addEventListener('error', (event) => {
    reportDesktopCrash(event.error);
  });

  window.addEventListener('unhandledrejection', (event) => {
    reportDesktopCrash(new Error(event.reason));
  });
}
```

Add to `admin-app/app/layout.tsx`:

```typescript
'use client';

import { useEffect } from 'react';
import { initializeDesktopAnalytics } from '@/lib/desktop-analytics';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initializeDesktopAnalytics();
  }, []);

  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

---

## Step 6: Test the Deployment

### Test Update Checker

```bash
curl -X POST https://your-project-ref.supabase.co/functions/v1/desktop-update-checker \
  -H "Content-Type: application/json" \
  -d '{
    "current_version": "1.0.0",
    "platform": "macos",
    "architecture": "aarch64",
    "device_id": "test-device-123"
  }'
```

### Test Analytics

```bash
curl -X POST https://your-project-ref.supabase.co/functions/v1/desktop-analytics \
  -H "Content-Type: application/json" \
  -H "apikey: YOUR_ANON_KEY" \
  -d '{
    "device_id": "test-device-123",
    "event_type": "test_event",
    "event_data": { "test": true }
  }'
```

### Test Crash Reporter

```bash
curl -X POST https://your-project-ref.supabase.co/functions/v1/desktop-crash-reporter \
  -H "Content-Type: application/json" \
  -H "apikey: YOUR_ANON_KEY" \
  -d '{
    "device_id": "test-device-123",
    "app_version": "1.0.0",
    "platform": "macos",
    "error_message": "Test crash",
    "stack_trace": "Error stack trace here"
  }'
```

---

## Step 7: Verify Database

```sql
-- Check update checks
SELECT * FROM desktop_update_checks ORDER BY checked_at DESC LIMIT 10;

-- Check analytics events
SELECT event_type, COUNT(*) as count
FROM desktop_analytics
GROUP BY event_type
ORDER BY count DESC;

-- Check crashes
SELECT platform, COUNT(*) as count
FROM desktop_crashes
GROUP BY platform;
```

---

## Deployment Checklist

- [ ] Database migration applied (`supabase db push`)
- [ ] Edge functions deployed
- [ ] Update signing keys generated and configured
- [ ] GitHub Secrets configured
- [ ] Desktop app client code updated
- [ ] Functions tested with curl
- [ ] Database verification completed
- [ ] Analytics tracking confirmed working
- [ ] Update checker confirmed working
- [ ] Crash reporter confirmed working

---

## Environment Variables

Required in Supabase:
- `SUPABASE_URL` - Auto-provided
- `SUPABASE_ANON_KEY` - Auto-provided
- `SUPABASE_SERVICE_ROLE_KEY` - Auto-provided

Required in GitHub Secrets:
- `TAURI_SIGNING_PRIVATE_KEY` - For update signing
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` - Key password
- All code signing secrets (see Phase 2 doc)

---

## Monitoring & Maintenance

### View Analytics Dashboard

Create admin dashboard at `admin-app/app/(admin)/desktop-analytics/page.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function DesktopAnalyticsPage() {
  const [stats, setStats] = useState<any>(null);
  const supabase = createClient();

  useEffect(() => {
    async function fetchStats() {
      // Fetch installation stats
      const { data: installations } = await supabase
        .from('desktop_installations')
        .select('*');

      // Fetch event stats
      const { data: events } = await supabase
        .from('desktop_analytics')
        .select('event_type')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      // Fetch crash stats
      const { data: crashes } = await supabase
        .from('desktop_crashes')
        .select('*')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      setStats({
        totalInstallations: installations?.length || 0,
        activeLastWeek: events?.length || 0,
        crashes: crashes?.length || 0,
      });
    }

    fetchStats();
  }, [supabase]);

  if (!stats) return <div>Loading...</div>;

  return (
    <div>
      <h1>Desktop Analytics</h1>
      <div>Total Installations: {stats.totalInstallations}</div>
      <div>Active Last Week: {stats.activeLastWeek}</div>
      <div>Crashes Last Week: {stats.crashes}</div>
    </div>
  );
}
```

---

## Complete Deployment Command

```bash
#!/bin/bash
set -e

echo "🚀 Deploying Desktop App Infrastructure to Supabase..."

# 1. Apply database migration
echo "📊 Applying database migration..."
supabase db push

# 2. Deploy edge functions
echo "⚡ Deploying edge functions..."
supabase functions deploy desktop-update-checker
supabase functions deploy desktop-analytics
supabase functions deploy desktop-crash-reporter

# 3. Verify deployment
echo "✅ Verifying deployment..."
supabase functions list

echo "✨ Desktop deployment complete!"
echo ""
echo "Next steps:"
echo "1. Configure TAURI_SIGNING_PRIVATE_KEY in GitHub Secrets"
echo "2. Update tauri.conf.json with Supabase function URL"
echo "3. Tag release: git tag desktop-v1.0.0 && git push --tags"
echo "4. Monitor GitHub Actions for build progress"
```

Save as `deploy-desktop-to-supabase.sh` and run:

```bash
chmod +x deploy-desktop-to-supabase.sh
./deploy-desktop-to-supabase.sh
```

---

**Deployment Status**: ✅ Ready to deploy  
**Estimated Time**: 15 minutes  
**Dependencies**: Supabase CLI, GitHub account with push access  
**Next Step**: Run deployment script

---

*Last Updated: November 26, 2025*
