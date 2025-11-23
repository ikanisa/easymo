// Minimal placeholder for wa-webhook-marketplace microservice
// Provides a simple health‑check endpoint.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve((req: Request) => {
  const url = new URL(req.url);
  if (url.pathname === "/health" || url.pathname.endsWith("/health")) {
    return new Response(JSON.stringify({ status: "healthy", service: "wa-webhook-marketplace", version: "0.1.0" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  return new Response("Marketplace function placeholder", { status: 200 });
});
