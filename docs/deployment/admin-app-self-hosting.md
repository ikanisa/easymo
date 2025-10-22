# Admin App Self-Hosting (Next.js)

Use this recipe to deploy the Next.js App Router project under `admin-app/` on your own infrastructure.

1. **Build Output**
   - From the repo root run `pnpm --filter admin-app build`. The compiled assets land in `admin-app/.next`.
   - Copy `admin-app/public/` alongside the build output when packaging the artefact (the Dockerfile already does this).

2. **Container Image**
   - Use `docker build -f admin-app/Dockerfile -t easymo-admin:latest admin-app` to produce a container.
   - The provided Dockerfile runs `next start` behind Node.js 18. Adjust the exposed port via `PORT` (default `3000`).

3. **Environment Variables**
   - Configure these values in your orchestrator (docker compose, Kubernetes, systemd unit, etc.):
     - `SERVICE_URL` → Supabase project URL
     - `SERVICE_ROLE_KEY` → Supabase service-role key
     - `NEXT_PUBLIC_SUPABASE_URL` → same Supabase URL (client usage)
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → Supabase anon key (client)
     - Optional WhatsApp/OCR keys as required by your flows

4. **Reverse Proxy**
   - Place the container behind nginx/traefik and forward `/api/*` + `/` routes to the Next.js server.
   - Static exports under `/openapi.yaml` and `/favicon.ico` are served automatically by Next.

5. **Smoke Checks**
   - `GET http://<host>/api/insurance/ocr` → `{ route: "insurance.ocr", status: "ok" }`
   - `GET http://<host>/api/mobility/book` → `{ route: "mobility.book", status: "ok" }`

If you see 405 on POST during initial rollout, confirm the container is healthy and the reverse proxy forwards all verbs.
