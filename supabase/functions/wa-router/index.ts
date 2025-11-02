import { handleRequest } from "../../../apps/router-fn/src/router.ts";

Deno.serve((req) => handleRequest(req));
