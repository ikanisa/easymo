import { AdminQuerySchema } from "@app-apis/domains/admin/schemas";
import { listAdminAudit } from "@app-apis/domains/admin/service";
import { createDomainHandler } from "@app-apis/lib/createDomainHandler";
import { NextRequest } from "next/server";

const parseAdminRequest = (request: NextRequest) => {
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  return AdminQuerySchema.parse(params);
};

export const GET = createDomainHandler({
  domain: "admin",
  method: "GET",
  parse: parseAdminRequest,
  execute: (context, input) => listAdminAudit(context, input),
});
