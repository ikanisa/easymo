import { handleRequest } from "./router.ts";

Deno.serve((req) => handleRequest(req));
