# Vercel Monorepo Setup — admin-app (Next.js)

Use this recipe to ensure the Next.js App Router API routes under `admin-app/app/api/**` deploy correctly.

1) Project Root Directory

- In Vercel → Project Settings → General → Root Directory, set to `admin-app`.
- Framework Preset: `Next.js`.
- Build Command: `next build` (default).
- Output Directory: `.next` (default).

2) Environment Variables (Server-side)

Set these under the Vercel project (Environment: Production and Preview):

- `SERVICE_URL` → your Supabase project URL
- `SERVICE_ROLE_KEY` → Supabase service-role key
- `NEXT_PUBLIC_SUPABASE_URL` → same Supabase URL (for client if needed)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` → Supabase anon key (client)
- Optional WhatsApp/OCR keys as required by your flows

3) Rewrites

`vercel.json` at repo root includes rewrites and catch-all for SPA. Next.js API routes do not require additional rewrites; they are handled by Next. If you keep the existing entries, ensure they remain listed before the `/(.*)` catch-all.

4) Smoke Checks

- `GET https://<your-domain>/api/insurance/ocr` → `{ route: "insurance.ocr", status: "ok" }`
- `GET https://<your-domain>/api/mobility/book` → `{ route: "mobility.book", status: "ok" }`

If you see 405 on POST during initial rollout, wait for deployment to finish or confirm the Root Directory is set.

