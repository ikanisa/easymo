import { RouterService } from "./router_service.ts";
import { SupabaseRouterRepository } from "./repository.ts";

const routerService = new RouterService(
  new SupabaseRouterRepository(),
  {
    verifyToken: Deno.env.get("WA_VERIFY_TOKEN") ?? "",
    appSecret: Deno.env.get("WA_APP_SECRET") ?? "",
    routerEnabled: (Deno.env.get("ROUTER_ENABLED") ?? "true").toLowerCase() !== "false",
    rateLimitWindowSeconds: Number(Deno.env.get("ROUTER_RATE_WINDOW_SECONDS") ?? "60"),
    rateLimitMaxMessages: Number(Deno.env.get("ROUTER_RATE_LIMIT") ?? "20"),
  },
);

Deno.serve((req: Request) => routerService.handleRequest(req));
