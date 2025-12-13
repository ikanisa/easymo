
# 🚨 CRITICAL: Read Guardrails First

**Before making ANY changes to this repository, you MUST read and follow:**

👉 **[CRITICAL_GUARDRAILS.md](./CRITICAL_GUARDRAILS.md)** 👈

These rules prevent schema drift, duplication, and fragmented features. **All work violating these guardrails will be REJECTED.**

---

## Supported Countries

### ✅ Supported

**Rwanda (RW) - PRIMARY MARKET**

### ❌ NOT Supported
- All other countries removed as of 2025-12-13
- ~~KE~~ (Kenya) - Removed 2025-11-27
- ~~UG~~ (Uganda) - Removed 2025-11-27
- ~~CD, BI, TZ~~ - Removed 2025-12-13
- ~~MT~~ (Malta) - Removed 2025-12-13

**Default Country**: `RW` (Rwanda)

### Code Usage
```typescript
// ✅ CORRECT
const SUPPORTED_COUNTRIES = ['RW'];

// ❌ WRONG - NEVER USE
const countries = ['RW', 'KE', 'UG']; // NO!
```

**All database migrations, TypeScript code, and configuration must only use: RW**

---

## EasyMO Services (Rwanda Only)

EasyMO is a WhatsApp-first platform focused on the Rwanda market with the following services:

### Active Services

1. **Mobility (Rides/Transport)** - WhatsApp workflow-based ride booking and scheduling
2. **Buy & Sell** - AI-powered marketplace for products and business services (pharmacy, hardware, groceries, business discovery)
3. **Insurance** - WhatsApp workflow-based insurance quotes and certificate management
4. **Profile** - User profile management
5. **Wallets** - Mobile money integration (USSD-based)

### Supported Languages

- English (en) - Primary UI
- French (fr) - UI and support
- Kinyarwanda (rw) - Comprehension support only (NO UI translation)

### Currency

- **RWF (Rwandan Franc)** - Only supported currency

### AI Agents

EasyMO uses **one primary AI agent** for natural language interactions:

- **Buy & Sell Agent** - Handles marketplace transactions, business discovery, product search, vendor matching, and general support queries via natural language conversation

**Note:** Mobility and Insurance services use workflow-based (button-driven) interactions, not AI agents.

---

## 🚫 CRITICAL RULE: NO KINYARWANDA UI TRANSLATION

**NEVER TRANSLATE THE USER INTERFACE TO KINYARWANDA (rw/rw-RW). THIS IS A BLOCKING REQUIREMENT.**

### Why?
- UI must remain in English or French
- Kinyarwanda comprehension is supported but NOT for UI elements
- Any code that translates UI elements to Kinyarwanda will be **REJECTED**

### Implementation Rules:
```typescript
// ❌ WRONG - NEVER USE KINYARWANDA IN UI
const LANGUAGES = { EN: 'en', FR: 'fr', RW: 'rw' }; // NO!
locale = 'rw'; // NO!
translateTo('rw'); // NO!

// ✅ CORRECT - Only use approved UI languages
const APPROVED_UI_LANGUAGES = ['en', 'fr'];
// Kinyarwanda ('rw') is BLOCKED from UI translation
```

---

## ⛔ PROHIBITED SERVICES (CRITICAL - DO NOT USE)

**The following third-party services are STRICTLY PROHIBITED in EasyMO. Any code using these services will be REJECTED.**

### ❌ Twilio - NEVER USE

| Instead of | Use |
|------------|-----|
| Twilio WhatsApp API | **WhatsApp Cloud Business API** (direct Meta API) |
| Twilio Voice/SIP | **MTN and telecom direct SIP Trunk connections** |
| Twilio Media Streams | **Direct SIP Trunk integration** via `services/sip-ingress` |

```typescript
// ❌ WRONG - NEVER USE TWILIO
import twilio from 'twilio';
const client = twilio(accountSid, authToken);
await client.messages.create({ /* ... */ });

// ✅ CORRECT - Use WhatsApp Cloud Business API directly
const response = await fetch(
  `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ /* WhatsApp Cloud API payload */ }),
  }
);
```

### ❌ MoMo API - NEVER USE

| Instead of | Use |
|------------|-----|
| MTN MoMo API | **USSD `tel:` mobile money** (direct dial codes) |
| MoMo Collections API | **USSD-based payment flows** |
| MoMo Disbursements API | **USSD-based payment flows** |

```typescript
// ❌ WRONG - NEVER USE MOMO API (example of prohibited code)
import { MoMoClient } from 'mtn-momo';
const momoClient = new MoMoClient({ /* config */ });  // DO NOT DO THIS
await momoClient.requestToPay({ /* ... */ });

// ✅ CORRECT - Use USSD tel: mobile money
// Generate USSD dial string for user to initiate payment
const ussdCode = `*182*8*1*${merchantCode}*${amount}#`;
// Send to user via WhatsApp for them to dial manually
await sendWhatsAppMessage(userId, `Pay via USSD: ${ussdCode}`);
```

### Voice/SIP Integration

EasyMO uses **direct SIP Trunk connections** with MTN and other telecoms:

- `services/sip-ingress`: Handles inbound SIP webhook events with Redis-backed idempotency
- `services/voice-bridge`: Processes audio streams via direct SIP Trunk, relays to OpenAI Realtime API

**DO NOT integrate any Twilio Voice, Twilio SIP Trunking, or similar services.**

### Why These Restrictions?

1. **Cost**: Direct APIs are significantly cheaper than third-party aggregators
2. **Latency**: Fewer hops = faster message/call delivery
3. **Control**: Direct integration with carriers gives us full control
4. **Compliance**: Direct carrier relationships simplify regulatory compliance in East Africa

---

- **RealAdapter** (`src/lib/adapter.real.ts`): delegates to the `AdminAPI`
  helper which calls Supabase Edge Functions secured by an admin token.
  This keeps the Supabase service role key server-side while exposing a
  simple asynchronous API for settings, users, trips, subscriptions and
  simulator workflows.
- **Supabase Edge Functions**: located under `supabase/functions`, these
  functions handle admin API requests.  Each function verifies an
  `x-api-key` header against `EASYMO_ADMIN_TOKEN` and uses the service
  role key to bypass RLS for writes.  Functions include:
  - `admin-settings`: get/update settings
  - `admin-stats`: compute operational metrics
  - `admin-users`: list users and derive subscription status
  - `admin-trips`: list trips or close a trip
  - `admin-subscriptions`: list, approve or reject subscriptions
  - `simulator`: simulate driver/passenger operations
- **Database Schema & Migrations**: see
  `supabase/migrations/20251112100000_phase2_init.sql` for the Phase 2
  schema.  New tables include `settings`, `profiles`, `driver_presence`,
  `trips` and `subscriptions`.  Row level security is enabled on all
  tables with permissive read policies and restrictive write policies.
- **Seeding**: a development seed file (`supabase/seeders/phase2_seed.sql`)
  inserts example settings, profiles, driver presence rows, trips and
  subscriptions for local testing.
- **Environment Variables**: `.env.example` now focuses on local hosting
  values including `APP_ENV`, `PORT`, `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`.
- **Deployment Profile**: the internal release pipeline applies the rewrites
  and headers required for the admin panel and exposed API routes (see
  `docs/deployment/production-pipeline.md` for the full process).

## Insurance Admin Notifications

**Status:** ✅ Working (as of 2025-12-04)

When users submit insurance certificates via WhatsApp, the system automatically notifies ALL insurance admins concurrently.

**Key Features:**
- ✅ Concurrent notifications to all admins (1-2s vs 3-5s sequential)
- ✅ Dynamic admin list from database (no hardcoded numbers)
- ✅ Full audit trail in `insurance_admin_notifications` table
- ✅ Comprehensive structured logging

**Admin Management:**
```sql
-- View current admins
SELECT contact_value, display_name, is_active 
FROM insurance_admin_contacts 
WHERE contact_type = 'whatsapp';

-- Add new admin
INSERT INTO insurance_admin_contacts (contact_type, contact_value, display_name, display_order, is_active)
VALUES ('whatsapp', '+250XXXXXXXXX', 'Admin Name', 4, true);
```

**⚠️ Important:** Admins must initiate contact with your WhatsApp Business number first to receive notifications (WhatsApp 24-hour messaging window policy).

**Complete Documentation:** See [`docs/INSURANCE_ADMIN_NOTIFICATIONS_README.md`](./docs/INSURANCE_ADMIN_NOTIFICATIONS_README.md)

## Phase 4 & 5 Highlights

- **Realtime bridges**: `services/voice-bridge` processes audio streams via **direct SIP Trunk connections** (MTN and telecoms),
  relays audio to the OpenAI Realtime API, emits Kafka telemetry, and exposes a
  `/analytics/live-calls` snapshot consumed by the admin console. `services/sip-ingress`
  normalises SIP webhook events with Redis-backed idempotency. ⚠️ **Note:** We do NOT use Twilio - see [Prohibited Services](#-prohibited-services-critical---do-not-use).
- **Marketplace & wallet services**: new microservices (`wallet-service`,
  `ranking-service`, `vendor-service`, `buyer-service`, `broker-orchestrator`)
  coordinate intents → quotes → purchases and double-entry ledger postings.
- **Admin console upgrades**: the Next.js panel now ships dedicated surfaces for
  live call monitoring, lead management (opt-in/tag updates via Agent-Core), and
  marketplace oversight (vendor ranking, intent pipeline, purchase audits). The
  UI remains PWA-ready with offline awareness and CSV exports.
- **Testing & observability**: acceptance tests cover ledger invariants,
  payment helpers (USSD mobile money / Revolut - **NOT MoMo API**), opt-out flows, and ranking logic. New
  Grafana-ready dashboards (`dashboards/phase4/*.json`) and Kafka topic manifests
  document the expanded footprint.

## Local Setup

1. Install prerequisites: `pnpm` (≥10.18.3), Node 18.18+, and the Supabase CLI (`brew install supabase/tap/supabase` on macOS).
2. Clone this repository and install dependencies from the root: `pnpm install`.
3. Copy `.env.example` to `.env` (backend/shared) and `.env.local` (Next.js only),
   then populate every `CHANGEME_*` placeholder with your Supabase project values.
4. Start Supabase locally with `supabase start` or link to a remote project with
   `supabase link --project-ref <project-ref> && supabase db pull`.
5. Apply migrations and seed data (local stack):
   - `supabase db reset` to recreate the database from `supabase/migrations`.
   - `supabase db seed --file supabase/seeders/phase2_seed.sql` to load sample data.
6. Deploy the Edge Functions used by the admin API when targeting a remote project:
   - `pnpm functions:deploy` (core admin routes)
   - `pnpm functions:deploy:agents` (agent-specific helpers)
7. Launch the admin app:
   - Dev: `pnpm dev`
   - Production build + serve: `pnpm build && pnpm start`

## Environment Variables

| Variable | Purpose | Scope |
| --- | --- | --- |
| `APP_ENV` | Names the runtime (e.g., `local`, `staging`, `prod`) for logging. | `.env` |
| `PORT` | Admin app port (defaults to 3000). | `.env`, `.env.local` |
| `NEXT_PUBLIC_SUPABASE_URL` | Public Supabase URL for browser traffic. | `.env.local` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser anon key; **never** use the service role. | `.env.local` |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Mirrors the `NEXT_PUBLIC_*` pair for tooling (Vitest/Cypress). | `.env`, `.env.local` |
| `VITE_SUPABASE_PROJECT_ID` | Supabase project ref used by diagnostics scripts. | `.env` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key used only by Edge Functions. | `.env` |
| `EASYMO_ADMIN_TOKEN` | Shared secret validated by admin Edge Functions. | `.env`, `.env.local` |
| `ADMIN_SESSION_SECRET` | 32+ chars to encrypt cookies in the admin app. | `.env` |

Optional helpers such as `SUPABASE_DB_URL`, `DISPATCHER_FUNCTION_URL`, and cron toggles
remain in `.env.example` for services that require them.

## Configuration & Environment Variables

### Quick Start

1. **Local Development:**
   ```bash
   # Copy the example file
   cp .env.example .env.local
   
   # For admin-app specifically
   cd admin-app
   cp .env.example .env.local
   ```

2. **Edit `.env.local`** with your actual values from:
   - Supabase Dashboard → Settings → API
   - Meta Business Suite → WhatsApp → Settings
   - Google Cloud Console (for AI features)

3. **NEVER commit** `.env.local` or `.env` to git (already in `.gitignore`)

### Required Variables

#### Supabase (Required for all apps)

```bash
# Public (client-side safe)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# Server-side only (NEVER use NEXT_PUBLIC_* prefix)
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
EASYMO_ADMIN_TOKEN=your-admin-token
ADMIN_SESSION_SECRET=your-session-secret-min-32-chars
```

#### WhatsApp Business API (Required for messaging)

```bash
# Meta WhatsApp Business API (NOT Twilio)
WHATSAPP_ACCESS_TOKEN=your-permanent-access-token
WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id
WHATSAPP_SEND_ENDPOINT=https://your-project.supabase.co/functions/v1/wa-webhook-core
```

### AI/LLM Configuration (Required)

> ⚠️ **IMPORTANT**: EasyMO requires specific LLM models for AI features. Using other models may result in degraded performance or unexpected behavior.

#### Mandatory LLM Providers

| Provider | Model | Use Cases |
|----------|-------|-----------|
| **OpenAI** | **GPT-5** | Conversation, reasoning, intent classification, complex decision-making |
| **Google Gemini** | **Gemini-3** | Vision/OCR, Google Maps integration, document parsing, image analysis |

#### Environment Variables

```bash
# OpenAI GPT-5 (Required for AI chat, agents, reasoning)
OPENAI_API_KEY=sk-your-openai-api-key
# Model: GPT-5 is used automatically for conversation and reasoning tasks

# Google Gemini-3 (Required for vision/OCR tasks)
GEMINI_API_KEY=AIza-your-gemini-api-key
# Model: Gemini-3 is used automatically for vision, OCR, and document parsing

# Additional Google APIs
GOOGLE_MAPS_API_KEY=AIza-your-google-maps-api-key
GOOGLE_SEARCH_API_KEY=AIza-your-google-search-api-key
GOOGLE_SEARCH_ENGINE_ID=your-engine-id
```

#### Dual Provider Architecture

EasyMO uses a **dual-provider AI architecture** with automatic failover:

1. **Primary Provider (OpenAI GPT-5)**: Handles conversation, reasoning, and intent classification
2. **Secondary Provider (Google Gemini-3)**: Handles vision/OCR, document parsing, and Google Maps integration

```
┌─────────────────────────────────────────────────────────────────┐
│                     AI Request Router                           │
├─────────────────────────────────────────────────────────────────┤
│  Text/Conversation ──► OpenAI GPT-5 (primary)                   │
│  Vision/OCR ──────────► Google Gemini-3 (primary)               │
│  Document Parsing ────► Google Gemini-3 (primary)               │
│  Maps Integration ────► Google Gemini-3 + Google Maps API       │
│                                                                 │
│  Failover: If primary fails, automatically retry with backup    │
└─────────────────────────────────────────────────────────────────┘
```

#### ⚠️ Model Restrictions

**DO NOT** use the following deprecated models:
- ❌ `gpt-4o`, `gpt-4-turbo`, `gpt-4o-mini` - Use **GPT-5** instead
- ❌ `gemini-1.5-flash`, `gemini-1.5-pro`, `gemini-2.0-flash` - Use **Gemini-3** instead

### Optional Variables

#### Additional AI Features

```bash
# Enable real-time voice features (optional)
ENABLE_OPENAI_REALTIME=false
ENABLE_GEMINI_LIVE=false

# Enable Google Search grounding for AI responses (optional)
ENABLE_GOOGLE_SEARCH_GROUNDING=false
```

#### Microservices

```bash
# Only needed if running microservices locally
NEXT_PUBLIC_AGENT_CORE_URL=http://localhost:3001
NEXT_PUBLIC_VOICE_BRIDGE_API_URL=http://localhost:3002
NEXT_PUBLIC_WALLET_SERVICE_URL=http://localhost:3006
```

### Production Deployment

#### Cloud Run / App Engine

Set environment variables in GCP:

```bash
# Using gcloud CLI
gcloud run services update easymo-admin-app \
  --region us-central1 \
  --set-env-vars NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co \
  --set-env-vars NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key \
  --update-secrets SUPABASE_SERVICE_ROLE_KEY=supabase-service-role:latest \
  --update-secrets EASYMO_ADMIN_TOKEN=admin-token:latest \
  --update-secrets ADMIN_SESSION_SECRET=session-secret:latest
```

**Best Practice:** Use Secret Manager for sensitive values:

1. Create secrets:
   ```bash
   echo -n "your-service-role-key" | gcloud secrets create supabase-service-role --data-file=-
   echo -n "your-admin-token" | gcloud secrets create easymo-admin-token --data-file=-
   ```

2. Grant access to Cloud Run service account

3. Reference in deployment (shown above)

#### Netlify

Configure in: **Site settings → Environment variables**

- Add all `NEXT_PUBLIC_*` variables
- Add server-side secrets (`SUPABASE_SERVICE_ROLE_KEY`, `EASYMO_ADMIN_TOKEN`, etc.)
- Netlify automatically provides: `NETLIFY`, `CONTEXT`, `URL`, `DEPLOY_URL`

### Security Rules

⚠️ **CRITICAL:** Follow these rules to prevent security breaches:

1. **NEVER use `NEXT_PUBLIC_*` or `VITE_*` prefixes for sensitive values**
   - ❌ `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` (WRONG - exposed to browser!)
   - ✅ `SUPABASE_SERVICE_ROLE_KEY` (CORRECT - server-only)

2. **NEVER commit secrets to git**
   - Use `.env.local` for local development (in `.gitignore`)
   - Use `.env.example` to document required variables (no real values)
   - Use Secret Manager for production

3. **Validate during build**
   - The prebuild script (`scripts/assert-no-service-role-in-client.mjs`) will fail builds if service role keys are found in `NEXT_PUBLIC_*` or `VITE_*` variables

4. **Environment-specific configuration**
   - Local: `.env.local` (ignored by git)
   - CI/CD: GitHub Secrets / environment variables
   - Production: Cloud Run env vars + Secret Manager

### Framework-Specific Prefixes

Different frameworks use different environment variable prefixes for client-side exposure:

| Framework | Client Prefix | Server Prefix | Example |
|-----------|---------------|---------------|---------|
| Next.js   | `NEXT_PUBLIC_*` | No prefix | `NEXT_PUBLIC_SUPABASE_URL` |
| Vite      | `VITE_*` | No prefix | `VITE_API_BASE_URL` |
| Node.js   | No prefix | No prefix | All variables server-side |

**Rule:** If it has a prefix, it's sent to the browser. Only use prefixes for non-sensitive values!

### Verification

Check your configuration is correct:

```bash
# Verify Cloud Run config
./verify-cloudrun-config.sh

# Check for security issues
pnpm exec eslint --no-error-on-unmatched-pattern
node scripts/assert-no-service-role-in-client.mjs
```

### Complete Reference

See `.env.example` files for complete lists:
- Root: `/Users/jeanbosco/workspace/easymo/.env.example` (monorepo-wide)
- Admin app: `/Users/jeanbosco/workspace/easymo/admin-app/.env.example` (Next.js specific)

For Cloud Run deployment details, see [CLOUD_RUN_DEPLOYMENT.md](./CLOUD_RUN_DEPLOYMENT.md)

## Run Commands

- Install deps: `pnpm install`
- Local dev server with hot reload: `pnpm dev`
- Production build: `pnpm build`
- Serve the compiled build: `pnpm start`
- Netlify build (CI-equivalent): `pnpm netlify:build`
- Deploy Edge Functions: `pnpm functions:deploy` or `pnpm functions:deploy:agents`
- Supabase connectivity check: `pnpm diagnostics:supabase [table_name]`
- Reset local database: `supabase db reset && supabase db seed --file supabase/seeders/phase2_seed.sql`

## Supabase Notes

- Add `http://localhost:3000` (or whatever `PORT` you set) to **Auth → URL
  configuration → Redirect URLs** and **API → Allowed CORS origins** in the
  Supabase dashboard. Include your tunnel/proxy hostnames if you expose the app
  beyond localhost.
- When using the local Supabase stack, the CLI injects matching service role and
  anon keys. For remote projects, create a `.env.local` using the dashboard’s
  `Project API` tab.
- Edge Functions expect the `EASYMO_ADMIN_TOKEN` header. Update the secret in
  both Supabase (project secrets) and your `.env`/`.env.local` files.
- The Supabase CLI stores credentials in `~/.config/supabase`. Run `supabase login`
  before `supabase link` to manage multiple environments.

## Supabase MCP Server

LLM tooling that speaks the [Model Context Protocol](https://modelcontextprotocol.io/)
(Cursor, Windsurf, Claude desktop/code, Cline, etc.) can inspect this Supabase
project via the official `@supabase/mcp-server-supabase` bridge.

1. [Generate a Supabase personal access token](https://supabase.com/dashboard/account/tokens)
   dedicated to MCP usage. Grant only the projects you need.
2. Export the environment expected by the helper script:

   ```bash
   export SUPABASE_MCP_ACCESS_TOKEN=<your-pat>
   export SUPABASE_MCP_PROJECT_REF=<project-ref> # lhbowpbcpwoiparwnwgt for dev
   # VITE_SUPABASE_PROJECT_ID already stores the same ref for local tooling.
   ```

3. (Optional) Toggle behavior with:
   - `SUPABASE_MCP_READ_ONLY=false` to allow write queries (defaults to read-only).
   - `SUPABASE_MCP_EXTRA_ARGS="--schema public"` to pass additional CLI flags.
4. Run the server whenever your MCP client asks for it:

   ```bash
   pnpm mcp:supabase
   ```

   or call the script directly with inline env variables for one-offs:

   ```bash
   SUPABASE_MCP_ACCESS_TOKEN=pat SUPABASE_MCP_PROJECT_REF=lhbowpbcpwoiparwnwgt pnpm mcp:supabase
   ```

5. Point your MCP client at the spawned process. For example, Cursor’s
   `.cursor/mcp.json` entry would be:

   ```json
   {
     "mcpServers": {
       "supabase": {
         "command": "pnpm",
         "args": ["mcp:supabase"],
         "env": {
           "SUPABASE_MCP_ACCESS_TOKEN": "pat",
           "SUPABASE_MCP_PROJECT_REF": "lhbowpbcpwoiparwnwgt"
         }
       }
     }
   }
   ```

Review Supabase’s [MCP security best practices](https://supabase.com/docs/guides/getting-started/mcp#security-risks)
before granting write access or sharing tokens.

## Platform Changes

- Removed `VERCEL_*` environment variables from `.env.example`; local hosting
  now depends on explicit Supabase and runtime values instead of platform
  defaults.
- We removed legacy hosting assumptions. Configure
  `NEXT_PUBLIC_APP_URL` (or rely on `localhost`) and update Supabase CORS origins
  manually.
- Added `.env.local` guidance for pnpm-based builds (`pnpm install`, `pnpm build`, `pnpm start`) and reverse
  proxy placeholders to support self-hosting.
- Added first-class Netlify support via `netlify.toml` and the official Next.js
  plugin so the admin app deploys on a Node runtime without extra config.

## Deploying to Netlify

1. Connect this repository in the Netlify UI (New site → Import from Git).
2. Netlify reads `netlify.toml`; the important bits are:

   - `command`: `pnpm netlify:build` (builds shared workspaces then the admin app).
   - `publish`: `admin-app/.next`.
   - `[[plugins]]`: `@netlify/plugin-nextjs` so API routes become Netlify Functions.
   - `NETLIFY_USE_PNPM=true` and `NODE_VERSION=18.18.0` ensure the correct toolchain.

3. Configure the required environment variables under Site settings → Environment
   (mirrors the `.env` table above; never expose service-role keys in `NEXT_PUBLIC_*`).
4. `netlify dev` can simulate the build locally if you install the CLI
   (`npm install -g netlify-cli`).

## CI/CD to Google Cloud Run

The admin PWA can be deployed to Google Cloud Run using the GitHub Actions workflow `.github/workflows/deploy-cloud-run.yml`. The workflow automatically builds a Docker container and deploys it on every push to `main`, or can be triggered manually.

### Required GitHub Secrets

Configure these secrets in your repository settings (Settings → Secrets and variables → Actions):

| Secret | Description | Example |
|--------|-------------|---------|
| `GCP_PROJECT_ID` | Your GCP project ID | `easymo-production` |
| `GCP_REGION` | Cloud Run deployment region | `europe-west1` |
| `CLOUD_RUN_SERVICE` | Name of the Cloud Run service | `easymo-admin-pwa` |
| `GCP_SA_KEY` | JSON service account key with Cloud Run Admin, Storage Admin, and Artifact Registry permissions | `{"type": "service_account", ...}` |

### Service Account Setup

1. Create a service account in your GCP project:
   ```bash
   gcloud iam service-accounts create cloud-run-deployer \
     --description="GitHub Actions deployment for Cloud Run" \
     --display-name="Cloud Run Deployer"
   ```

2. Grant required permissions:
   ```bash
   gcloud projects add-iam-policy-binding PROJECT_ID \
     --member="serviceAccount:cloud-run-deployer@PROJECT_ID.iam.gserviceaccount.com" \
     --role="roles/run.admin"
   
   gcloud projects add-iam-policy-binding PROJECT_ID \
     --member="serviceAccount:cloud-run-deployer@PROJECT_ID.iam.gserviceaccount.com" \
     --role="roles/storage.admin"
   
   gcloud projects add-iam-policy-binding PROJECT_ID \
     --member="serviceAccount:cloud-run-deployer@PROJECT_ID.iam.gserviceaccount.com" \
     --role="roles/artifactregistry.admin"
   
   gcloud projects add-iam-policy-binding PROJECT_ID \
     --member="serviceAccount:cloud-run-deployer@PROJECT_ID.iam.gserviceaccount.com" \
     --role="roles/iam.serviceAccountUser"
   ```

3. Create and download the JSON key:
   ```bash
   gcloud iam service-accounts keys create key.json \
     --iam-account=cloud-run-deployer@PROJECT_ID.iam.gserviceaccount.com
   ```
   
   Copy the contents of `key.json` and paste it as the `GCP_SA_KEY` secret in GitHub.

### Manual Deployment Trigger

To manually trigger a deployment from GitHub:

1. Go to **Actions** → **Deploy to Google Cloud Run**
2. Click **Run workflow**
3. Select the `main` branch (or your target branch)
4. Click **Run workflow**

### Authentication & IAP

The workflow deploys with `--allow-unauthenticated` by default for simplicity. For production deployments:

1. **With Identity-Aware Proxy (IAP):** Configure IAP at the load balancer level and change the deployment to use `--no-allow-unauthenticated`:
   ```bash
   gcloud run deploy SERVICE_NAME \
     --no-allow-unauthenticated \
     ...
   ```
   IAP handles authentication before requests reach Cloud Run.

2. **Environment Variables:** Configure runtime environment variables (Supabase keys, admin tokens, etc.) in the Cloud Run console or via `gcloud`:
   ```bash
   gcloud run services update SERVICE_NAME \
     --update-env-vars="NEXT_PUBLIC_SUPABASE_URL=https://...,NEXT_PUBLIC_SUPABASE_ANON_KEY=..." \
     --region=REGION
   ```

### Monitoring Deployments

- View deployment logs in the **Actions** tab of your GitHub repository
- Check Cloud Run logs: `gcloud run services logs read SERVICE_NAME --region=REGION`
- Monitor service health in the [Cloud Run console](https://console.cloud.google.com/run)

## Identity-Aware Proxy (IAP)

For production deployments, secure your admin PWA with Google's Identity-Aware Proxy to restrict access to authorized users only.

**What is IAP?**
- Centralized authentication layer that sits in front of your application
- Verifies user identity via Google OAuth before allowing access
- Supports Google Workspace accounts and Gmail addresses
- Zero code changes required - purely infrastructure-level security

**Quick Start:**

```bash
# 1. Enable required APIs
./scripts/enable-iap.sh --enable-apis --project-id=YOUR_PROJECT_ID

# 2. Grant access to your admin team
./scripts/enable-iap.sh \
  --project-id=YOUR_PROJECT_ID \
  --backend-service=YOUR_BACKEND_SERVICE \
  --member=group:easymo-admins@yourcompany.com

# 3. Update Cloud Run to deny unauthenticated access
gcloud run services update YOUR_SERVICE \
  --region=YOUR_REGION \
  --no-allow-unauthenticated
```

**Complete Setup Guide:** See [docs/iap-setup.md](./docs/iap-setup.md) for:
- Step-by-step IAP configuration (OAuth consent screen, load balancer, access policies)
- Managing users and groups
- Testing and troubleshooting
- Security best practices
- Cost considerations

**Helper Script:** Use `./scripts/enable-iap.sh` to:
- Enable required GCP APIs
- List available backend services
- Grant/revoke IAP access
- Show current access policies

## Development Notes

1. Copy `.env.example` to `.env` and fill in your Supabase and admin
   credentials.  Never commit your service role key to version control.
   - When enabling WhatsApp callbacks, set `WABA_PHONE_NUMBER_ID`,
     `WABA_ACCESS_TOKEN`, and `WA_APP_SECRET`; the backend now fails fast if
     these values are missing or left at defaults.
2. Run `pnpm install` to install workspace dependencies (`pnpm-workspace.yaml`
   wires `services/*` and `packages/*`).
3. Start the admin panel with `pnpm dev`.  The app talks to Supabase through
   the RealAdapter and Edge Functions once environment variables are present.
4. Apply the Supabase schema with `supabase db push`, then load the additive
   fixtures from `supabase/seed/fixtures/admin_panel_core.sql`.  The legacy
   `supabase/seeders/phase2_seed.sql` remains available for quick smoke runs.
   After running new migrations or exporting the schema, run
   `pnpm schema:verify` to ensure `latest_schema.sql` (with its checksum marker)
   matches the contents of `supabase/migrations/**/*.sql`.
   - **Migration archives are quarantined**: 388 historical files live under
     `supabase/migrations/archive`, `_archived_duplicates`, `_disabled`,
     `backup_*`, and `phased`. Never edit or execute these; glob only
     `supabase/migrations/*.sql` (excluding `*.skip`) when adding/verifying
     migrations, and pick a new timestamp beyond the latest active file.
5. Bootstrap the Phase 4/5 workspace: `pnpm --filter @easymo/db prisma:migrate:dev`
   against the Agent-Core Postgres URL, then `pnpm --filter @easymo/db seed` to
   generate tenants, agent configs, leads, intents, wallet accounts, and sample
   quotes/purchases.
6. Bring up dependencies with `docker compose -f docker-compose.agent-core.yml up`.
   This runs Postgres, Redis, Kafka, and dev instances for voice bridge, SIP
   ingress, wallet, ranking, vendor, buyer, WhatsApp bot, broker orchestrator,
   and Agent-Core.  Each service can also be launched individually via
   `pnpm --filter @easymo/<service> start:dev`.
7. Run the acceptance suites when wiring integrations:  
   `pnpm --filter @easymo/wallet-service test`,  
   `pnpm --filter @easymo/ranking-service test`,  
   `pnpm --filter @easymo/vendor-service test`,  
   `pnpm --filter @easymo/buyer-service test`, and  
   `pnpm --filter @easymo/agent-core test`.  Tests cover payment helpers
   (USSD mobile money / Revolut - **NOT MoMo API**), opt-out flows, intent/quote ranking, and ledger
   invariants.
8. Deploy Supabase edge functions via `supabase functions deploy --project-ref <ref>`,
   or let Netlify handle deployment if configured.  Import the Grafana dashboards
   in `dashboards/phase4/*.json` and provision Kafka topics per
   `infrastructure/kafka/topics.yaml` during staging cut-overs.

## Deprecated Feature Guard

Legacy promo flows have been fully decommissioned. The guard script
(`pnpm guard:deprecated`) scans runtime code for prohibited tokens and fails if
they reappear outside the historical Supabase schema. Pre-commit hooks invoke
the same check automatically.

## Package Manager

- Use `pnpm` (>=8) for all workspace installs and scripts. `npm install` / `npm audit fix` reintroduce TypeScript peer dependency conflicts between `typescript@5.9.x` and `typescript-eslint@8.x`.
- Install dependencies with `pnpm install` and run workspace scripts via `pnpm <script>`.

## Database Seeding (Remote)

1. Fetch the service-role connection string from Supabase Dashboard → Settings → Database and export it:
   ```bash
   export SUPABASE_DB_URL="postgresql://postgres:<password>@db.vacltfdslodqybxojytc.supabase.co:5432/postgres"
   ```
2. Run the Phase-2 seed fixture:
   ```bash
   pnpm seed:remote
   ```
   The script pipes `supabase/seeders/phase2_seed.sql` through `psql` with `ON_ERROR_STOP`, so it will fail fast if anything breaks.
3. If `psql` is not available, use the same SQL file inside the Supabase SQL editor or run:
   ```bash
   PGPASSWORD=<password> psql "postgresql://postgres@db.vacltfdslodqybxojytc.supabase.co:5432/postgres" \
     -v ON_ERROR_STOP=1 \
     -f supabase/seeders/phase2_seed.sql
   ```

## Development Ground Rules

**All development MUST follow the ground rules for observability, security, and feature flags.**

See [docs/GROUND_RULES.md](docs/GROUND_RULES.md) for comprehensive guidelines on:

- **Observability**: Structured logging, event counters, and metrics for all APIs and jobs
- **Security**: Secret management, webhook signature verification, and data protection
- **Feature Flags**: Controlling feature rollout with flags that default to OFF in production

Key principles:
- Use structured logs (JSON format) with correlation IDs
- Never expose secrets client-side (validated in `prebuild` script)
- Verify webhook signatures (WhatsApp Cloud API, SIP Trunk webhooks)
- **NEVER use Twilio or MoMo API** - see [Prohibited Services](#-prohibited-services-critical---do-not-use)
- Gate all new features behind feature flags
- Record metrics for significant actions
- Mask PII in all logs

## Testing

Vitest is used for admin panel unit tests (`src/lib/adapter.real.test.ts`, etc.).
Run `pnpm test` for the SPA, and rely on the per-package Jest suites noted above
for the realtime and marketplace services.

## Next Steps

This Phase 2 implementation lays the groundwork for a fully integrated
WhatsApp mobility platform.  Future enhancements could include:

- Adding tables and functions for stations,
  insurance quotes and audit logging.
- Implementing PostGIS geospatial queries for precise distance calculations.
- Extending the simulator to enforce credit usage and subscription
  expiration rules.
- Improving error handling and logging with structured outputs.
- Tracking the deferred inventory console rebuild; see
  [`docs/inventory-app-assessment.md`](docs/inventory-app-assessment.md) for the
  guardrails and roadmap impact.【F:docs/inventory-app-assessment.md†L1-L44】

## macOS Code Signing (Desktop Apps)

EasyMO includes **two macOS desktop applications** (Admin Panel + Client/Staff Portal) that require code signing for distribution. We provide a complete, production-ready signing infrastructure.

### 🚀 Quick Start (5 minutes)

```bash
# 1. Read the quick start guide
open SIGNING_QUICK_START.md

# 2. Create certificate (via Keychain Access GUI - see guide)
# 3. Verify setup
./scripts/check_certificate.sh

# 4. Sign both apps
./scripts/sign_all_apps.sh

# 5. Verify signatures
./scripts/verify_apps.sh
```

### 📚 Documentation

- **[SIGNING_QUICK_START.md](./SIGNING_QUICK_START.md)** - 5-minute setup guide
- **[docs/internal_mac_signing.md](./docs/internal_mac_signing.md)** - Complete reference
- **[docs/github_actions_signing.md](./docs/github_actions_signing.md)** - CI/CD automation
- **[docs/SIGNING_REFERENCE.md](./docs/SIGNING_REFERENCE.md)** - Master index

### 🔧 Scripts

```bash
./scripts/list_identities.sh      # List signing certificates
./scripts/check_certificate.sh    # Verify certificate setup
./scripts/sign_all_apps.sh         # Sign both apps (main entry point)
./scripts/verify_apps.sh           # Verify signatures
./scripts/test_signing_workflow.sh # Run test suite
```

See [scripts/README.md](./scripts/README.md) for all available scripts.

### 🤖 CI/CD (GitHub Actions)

Automated signing workflow at `.github/workflows/macos-signing.yml` triggers on:
- Version tags (`git push --tags v1.0.0`)
- Manual dispatch (Actions tab in GitHub)
- PR changes to signing scripts (validation only)

**Features:** Automated signing, DMG creation, secure certificate storage, notarization-ready.

See [docs/github_actions_signing.md](./docs/github_actions_signing.md) for setup instructions.

---

## Cloud Run Deployment

### Overview

The admin-app is a Next.js 15 SSR application deployed to Google Cloud Run as a standalone container. The Dockerfile builds the admin-app with all required workspace dependencies and serves it on port 8080.

### Local Docker Testing

Build and test the Docker image locally before deploying:

```bash
# Build the Docker image
docker build -t easymo-admin-app .

# Run the container locally
docker run -p 8080:8080 \
  -e NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key \
  -e SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
  -e EASYMO_ADMIN_TOKEN=your-admin-token \
  -e ADMIN_SESSION_SECRET=your-session-secret-min-32-chars \
  easymo-admin-app

# Test the app
open http://localhost:8080
```

### Required Environment Variables

Configure these environment variables in Cloud Run (Console → Service → Variables & Secrets):

**Public (Client-side):**
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL (e.g., `https://xxxxx.supabase.co`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key (safe for browser)

**Server-only (NEVER prefix with NEXT_PUBLIC_):**
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key for server-side operations
- `EASYMO_ADMIN_TOKEN` - Admin API authentication token
- `ADMIN_SESSION_SECRET` - Session encryption key (min 32 characters)

**Optional Microservice URLs:**
- `NEXT_PUBLIC_AGENT_CORE_URL` - Agent core service URL
- `NEXT_PUBLIC_VOICE_BRIDGE_API_URL` - Voice bridge API URL
- `NEXT_PUBLIC_MARKETPLACE_RANKING_URL` - Marketplace ranking service URL
- `NEXT_PUBLIC_MARKETPLACE_VENDOR_URL` - Vendor service URL
- `NEXT_PUBLIC_MARKETPLACE_BUYER_URL` - Buyer service URL
- `NEXT_PUBLIC_WALLET_SERVICE_URL` - Wallet service URL

### Deploy to Cloud Run

```bash
# Set your GCP project
gcloud config set project YOUR_PROJECT_ID

# Build and deploy (Cloud Build will handle the build)
gcloud run deploy easymo-admin-app \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co \
  --set-env-vars NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Or use gcloud secrets for sensitive values
gcloud run deploy easymo-admin-app \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --update-secrets SUPABASE_SERVICE_ROLE_KEY=supabase-service-role:latest \
  --update-secrets EASYMO_ADMIN_TOKEN=admin-token:latest \
  --update-secrets ADMIN_SESSION_SECRET=session-secret:latest
```

### Configure Identity-Aware Proxy (IAP)

After deployment, configure IAP in the Cloud Console to restrict access to internal users:

1. Go to **Security → Identity-Aware Proxy**
2. Enable IAP for your Cloud Run service
3. Add authorized users/groups
4. The service will be accessible only after IAP authentication

### Production Checklist

- [ ] All environment variables configured
- [ ] Service role key stored in Secret Manager (not hardcoded)
- [ ] IAP configured for internal-only access
- [ ] Supabase CORS settings include Cloud Run URL
- [ ] Supabase Auth redirect URLs include Cloud Run URL
- [ ] Health checks passing (Next.js built-in at `/api/health` if implemented)
- [ ] Logs flowing to Cloud Logging
- [ ] CloudSQL/external services accessible from Cloud Run VPC

---

## Setup
Copy env sample:

```
cp .env.example .env
```
