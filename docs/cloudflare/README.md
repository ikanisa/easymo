# Cloudflare Pages Setup (Vite SPA + Next.js Admin)

This repository deploys two Cloudflare Pages projects from a single monorepo:
1. **easymo-web**: Root Vite SPA (main user-facing application)
2. **easymo-admin**: Next.js 14 admin panel in `admin-app/`

## Important: Package Manager Configuration

⚠️ **CRITICAL: Force pnpm Usage in Cloudflare Pages**

This repository contains multiple package manager lockfiles (`pnpm-lock.yaml`, `bun.lockb`, `package-lock.json`). Cloudflare Pages auto-detects package managers based on lockfiles and may incorrectly choose bun or npm, which do not support the pnpm workspace configuration properly.

**Required Cloudflare Pages Environment Variable:**

Add this environment variable to **BOTH** Cloudflare Pages projects (easymo-web and easymo-admin):

```bash
UNSTABLE_PRE_BUILD=asdf install pnpm 10.18.3 && asdf global pnpm 10.18.3
```

This forces Cloudflare Pages to use pnpm 10.18.3 instead of auto-detecting bun or npm.

**Alternative Configuration (if UNSTABLE_PRE_BUILD doesn't work):**

Set the package manager explicitly:
```bash
NPM_FLAGS=--version  # This disables npm
SKIP_DEPENDENCY_INSTALL=false
```

Then ensure your build command starts with the pnpm installation as shown in the build scripts.

### Admin App Deployment Method

⚠️ **Note on Admin App Builds**: The admin-app uses pnpm's `workspace:*` protocol for shared packages, which is not supported by npm. Since Cloudflare Pages' native build system may default to npm or bun, **the recommended deployment method for the admin app is via GitHub Actions** (see `.github/workflows/cloudflare-pages-deploy.yml`).

The build script `admin-app/scripts/cloudflare/build.sh` is provided for:
- ✅ GitHub Actions CI/CD pipelines (where pnpm can manage dependencies)
- ✅ Local development and testing
- ✅ Wrangler CLI deployments
- ❌ NOT for Cloudflare Pages dashboard "Connect to Git" builds (due to package manager auto-detection issues)

For the **Vite SPA** (easymo-web), the same considerations apply - ensure pnpm is used.

## Requirements

### System Requirements
- **Node.js**: 20.x or later
- **pnpm**: 10.18.3 or later (for root/shared packages)
- **npm**: 9.8.1 or later (for admin-app only)

### Cloudflare Prerequisites
- Cloudflare account with Pages enabled
- API token with Pages permissions
- Domain configured in Cloudflare (optional, for custom domains)

## Project Configuration

### Project 1: easymo-web (Root Vite SPA)

**Cloudflare Pages Settings:**
- **Project name**: `easymo-web` (or your preferred name)
- **Build command**: `bash scripts/cloudflare/build-web.sh`
- **Build output directory**: `dist`
- **Root directory**: `/` (repository root)
- **Node version**: `20`
- **Build system**: None (script handles everything)

**Environment Variables (Production):**
```bash
# REQUIRED: Force pnpm usage (prevents bun auto-detection)
UNSTABLE_PRE_BUILD=asdf install pnpm 10.18.3 && asdf global pnpm 10.18.3

# Public variables (client-safe)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_ENVIRONMENT=production

# Server-side secrets (if needed for server-side rendering)
# NOTE: Do NOT expose these as VITE_* variables
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

### Project 2: easymo-admin (Next.js Admin)

**Cloudflare Pages Settings:**
- **Project name**: `easymo-admin` (or your preferred name)
- **Build command**: `bash admin-app/scripts/cloudflare/build.sh`
- **Build output directory**: `admin-app/.vercel/output/static`
- **Root directory**: `/` (repository root, script handles navigation)
- **Node version**: `20`
- **Build system**: None (script handles everything)

**Environment Variables (Production):**
```bash
# REQUIRED: Force pnpm usage (prevents bun auto-detection)
UNSTABLE_PRE_BUILD=asdf install pnpm 10.18.3 && asdf global pnpm 10.18.3

# Public variables (client-safe)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_ENVIRONMENT_LABEL=Production
NEXT_PUBLIC_USE_MOCKS=false
NEXT_PUBLIC_DEFAULT_ACTOR_ID=00000000-0000-0000-0000-000000000001

# Server-side secrets (NEVER expose as NEXT_PUBLIC_*)
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
ADMIN_SESSION_SECRET=<min-16-char-random-string>
ADMIN_TOKEN=<admin-api-token>
EASYMO_ADMIN_TOKEN=<admin-api-token>
ADMIN_ACCESS_CREDENTIALS=[{"actorId":"uuid","token":"token","label":"Ops"}]
```

## Setup Instructions

### Method 1: Connect via Cloudflare Dashboard (Recommended)

#### Step 1: Create Project for Vite SPA

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Pages** → **Create a project**
3. Click **Connect to Git** → Select **GitHub**
4. Choose repository: `ikanisa/easymo`
5. Configure build settings:
   - **Project name**: `easymo-web`
   - **Production branch**: `main`
   - **Build command**: `bash scripts/cloudflare/build-web.sh`
   - **Build output directory**: `dist`
   - **Root directory**: `/`
   - **Environment variables**: Add the variables listed above
6. Click **Save and Deploy**

#### Step 2: Create Project for Admin App

1. In Cloudflare Dashboard, navigate to **Pages** → **Create a project**
2. Click **Connect to Git** → Select **GitHub**
3. Choose repository: `ikanisa/easymo` (same repo)
4. Configure build settings:
   - **Project name**: `easymo-admin`
   - **Production branch**: `main`
   - **Build command**: `bash admin-app/scripts/cloudflare/build.sh`
   - **Build output directory**: `admin-app/.vercel/output/static`
   - **Root directory**: `/`
   - **Environment variables**: Add the variables listed above
5. Click **Save and Deploy**

#### Step 3: Configure Custom Domains (Optional)

For each project:
1. Navigate to project → **Custom domains**
2. Click **Set up a custom domain**
3. Enter your domain (e.g., `app.yourdomain.com` for web, `admin.yourdomain.com` for admin)
4. Follow DNS configuration instructions
5. Wait for DNS propagation and SSL certificate provisioning

### Method 2: Deploy via Wrangler CLI

#### Prerequisites
```bash
# Install wrangler globally
npm install -g wrangler

# Login to Cloudflare
wrangler login
```

#### Deploy Vite SPA
```bash
# Clone and prepare repository
git clone https://github.com/ikanisa/easymo.git
cd easymo

# Run the build script
bash scripts/cloudflare/build-web.sh

# Deploy to Cloudflare Pages
npx wrangler pages deploy dist \
  --project-name=easymo-web \
  --branch=main
```

#### Deploy Admin App
```bash
# From repository root
bash admin-app/scripts/cloudflare/build.sh

# Deploy to Cloudflare Pages
cd admin-app
npx wrangler pages deploy .vercel/output/static \
  --project-name=easymo-admin \
  --branch=main
```

## Build Scripts Explained

### scripts/cloudflare/build-web.sh

This script handles building the root Vite SPA:

1. **Ensures pnpm is available** (installs if needed)
2. **Installs dependencies** with `pnpm install --frozen-lockfile`
3. **Builds shared packages** (`@va/shared` and `@easymo/commons`)
4. **Runs security guard** to prevent secret leaks
5. **Builds Vite application** with production optimizations
6. **Verifies output** directory (`dist/`) exists

### admin-app/scripts/cloudflare/build.sh

This script handles building the Next.js admin app:

1. **Ensures pnpm is available** (for shared packages)
2. **Builds shared packages** from repository root
3. **Verifies admin-app dependencies** are ready (installed via pnpm workspace at root)
4. **Runs security guard** to prevent secret leaks
5. **Lints and tests** the application (continues on failure)
6. **Builds Next.js application** with production settings
7. **Runs Cloudflare Pages adapter** (OpenNext: `@opennextjs/cloudflare@latest`)
8. **Verifies output** directory (`.vercel/output/static/`) exists

**Note on Dependency Management**: The admin-app uses npm for running scripts (`npm run build`, `npm test`), but dependencies are installed via pnpm at the repository root level. This is because admin-app is part of the pnpm workspace and uses the `workspace:*` protocol for shared packages. The build script does not run `npm ci` - instead, it relies on `pnpm install --frozen-lockfile` run at the root.

## Security Considerations

### Secret Guard

Both build scripts run `scripts/assert-no-service-role-in-client.mjs` which:
- Scans for forbidden patterns in environment variables
- Blocks build if `VITE_*` or `NEXT_PUBLIC_*` variables contain:
  - `SERVICE_ROLE`
  - `SERVICE_KEY`
  - `ADMIN_TOKEN`
  - `SECRET_KEY`
  - `DATABASE_URL`
  - And other sensitive patterns

**Example of what will FAIL:**
```bash
# ❌ WRONG - Will fail security check
NEXT_PUBLIC_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_ADMIN_TOKEN=secret-token
```

**Correct approach:**
```bash
# ✅ CORRECT - Public variables only
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Server-side secrets (no client prefix)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
ADMIN_TOKEN=secret-token
```

### Dependency Security

- **Shared packages**: Built with pnpm, uses `workspace:*` protocol
- **Admin app**: Uses npm (as documented in repo guidelines)
- **No mixed package managers**: Root uses pnpm, admin-app uses npm

## Preflight Checks

The repository includes a GitHub Action (`.github/workflows/cloudflare-pages-check.yml`) that:
- Runs on every pull request
- Simulates Cloudflare builds for both projects
- Uploads build artifacts for inspection
- Fails early if builds would fail in Cloudflare

**To trigger manually:**
1. Open a pull request
2. Watch for "Cloudflare Pages Preflight" workflow
3. Review build logs and artifacts

## Troubleshooting

### Build Failures

#### Error: "Workspace dependency '@va/shared' not found" (Bun Install)
**Cause**: Cloudflare Pages auto-detected `bun.lockb` and tried to use bun instead of pnpm. Bun doesn't properly support pnpm workspace configurations.

**Solution**: Configure Cloudflare Pages to use pnpm:

1. In Cloudflare Pages project settings, add environment variable:
   ```bash
   UNSTABLE_PRE_BUILD=asdf install pnpm 10.18.3 && asdf global pnpm 10.18.3
   ```

2. Verify the build command in Cloudflare Pages dashboard is:
   ```bash
   bash scripts/cloudflare/build-web.sh  # for Vite SPA
   # OR
   bash admin-app/scripts/cloudflare/build.sh  # for admin app
   ```

3. The build scripts will install pnpm if not available, but the UNSTABLE_PRE_BUILD ensures Cloudflare doesn't auto-select bun first.

**Alternative**: If you don't need bun, consider removing `bun.lockb` from the repository to prevent auto-detection issues.

#### Error: "workspace:* protocol not supported"
**Cause**: Shared packages not built or npm used instead of pnpm

**Solution**: Build scripts automatically handle this, but if building manually:
```bash
pnpm --filter @va/shared build
pnpm --filter @easymo/commons build
```

#### Error: "SECURITY VIOLATION: Service role key found"
**Cause**: Secret exposed in client-facing environment variable

**Solution**: Remove sensitive values from `VITE_*` and `NEXT_PUBLIC_*` variables
```bash
# Check your .env files
grep -E "(VITE_|NEXT_PUBLIC_).*SERVICE_ROLE" .env*
```

#### Error: "dist directory not found" (Vite SPA)
**Cause**: Vite build failed or ran from wrong directory

**Solution**: Ensure you're in repository root and re-run:
```bash
bash scripts/cloudflare/build-web.sh
```

#### Error: ".vercel/output not found" (Admin)
**Cause**: Next.js build or adapter failed

**Solution**: Check build logs for errors, ensure all dependencies installed:
```bash
cd admin-app
npm ci
npm run build
npx @opennextjs/cloudflare@latest
```

### Runtime Issues

#### Error: "Module not found" in production
**Cause**: Shared package not properly built or linked

**Solution**: Rebuild shared packages and redeploy:
```bash
pnpm --filter @va/shared build
pnpm --filter @easymo/commons build
```

#### Error: "Unauthorized" on API routes (Admin)
**Cause**: Missing or incorrect `ADMIN_SESSION_SECRET`

**Solution**: Verify environment variable is set in Cloudflare Pages project settings

#### Error: Database connection issues
**Cause**: Incorrect Supabase URL or keys

**Solution**: Verify credentials in Cloudflare Pages environment variables
```bash
# Test connection locally
curl https://your-project.supabase.co/rest/v1/
```

## CI/CD Integration

### Existing Workflows

The repository has these relevant workflows:
- `.github/workflows/ci.yml` - Main CI pipeline
- `.github/workflows/admin-app-ci.yml` - Admin app specific checks
- `.github/workflows/cloudflare-pages-deploy.yml` - Existing admin deploy
- `.github/workflows/cloudflare-pages-check.yml` - **NEW** Preflight checks

### GitHub Actions Deployment (Optional)

You can automate deployments using GitHub Actions with the Cloudflare Pages action:

```yaml
- name: Deploy to Cloudflare Pages
  uses: cloudflare/pages-action@v1
  with:
    apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
    projectName: easymo-web
    directory: dist
    gitHubToken: ${{ secrets.GITHUB_TOKEN }}
```

See `.github/workflows/cloudflare-pages-deploy.yml` for a complete example.

## Testing Deployments

### Local Testing

#### Test Vite SPA build:
```bash
bash scripts/cloudflare/build-web.sh
cd dist
python3 -m http.server 8080
# Visit http://localhost:8080
```

#### Test Admin build:
```bash
bash admin-app/scripts/cloudflare/build.sh
cd admin-app
npx wrangler pages dev .vercel/output/static --compatibility-flag=nodejs_compat
# Visit http://localhost:8788
```

### Cloudflare Deployment Tests

After deploying to Cloudflare Pages, verify:

1. **Deployment succeeded** in Pages dashboard
2. **Build logs** show no errors
3. **Preview URL** is accessible
4. **Application loads** without console errors
5. **Authentication works** (admin app)
6. **API routes respond** correctly
7. **Assets load** from CDN

## Performance Optimization

### Vite SPA
- Vite automatically chunks and optimizes bundle
- Use route-based code splitting
- Configure caching headers in `public/_headers`

### Next.js Admin
- Edge runtime for optimal performance
- Static generation where possible
- ISR (Incremental Static Regeneration) for dynamic content

### Cloudflare Configuration

Add `_headers` file for caching:
```
# Cache static assets
/assets/*
  Cache-Control: public, max-age=31536000, immutable

# Cache API responses
/api/*
  Cache-Control: public, max-age=300, s-maxage=600
```

## Monitoring

### Cloudflare Analytics
- View in Pages dashboard → Project → Analytics
- Monitor: Requests, bandwidth, errors, response time

### Custom Logging
- Use structured logging (JSON format)
- Include correlation IDs for tracing
- Follow observability guidelines in `docs/GROUND_RULES.md`

## Rollback

If a deployment fails or causes issues:

### Via Cloudflare Dashboard
1. Navigate to Pages → Project → Deployments
2. Find last known good deployment
3. Click **Rollback to this deployment**

### Via Git
```bash
git revert <bad-commit-sha>
git push origin main
```

## Support

### Documentation References
- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [Next.js on Cloudflare](https://developers.cloudflare.com/pages/framework-guides/nextjs/)
- [Monorepo Build Setup](../../README.md)
- [Ground Rules](../GROUND_RULES.md)

### Related Files
- Build scripts: `scripts/cloudflare/build-web.sh`, `admin-app/scripts/cloudflare/build.sh`
- Preflight workflow: `.github/workflows/cloudflare-pages-check.yml`
- Security guard: `scripts/assert-no-service-role-in-client.mjs`

---

**Last Updated**: 2025-10-30  
**Maintainer**: DevOps Team  
**Version**: 1.0.0
