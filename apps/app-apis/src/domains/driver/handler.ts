import { DriverRequestSchema } from "@app-apis/domains/driver/schemas";
import { getDriverProfile } from "@app-apis/domains/driver/service";
import { createDomainHandler } from "@app-apis/lib/createDomainHandler";
import { NextRequest } from "next/server";

const parseDriverRequest = (request: NextRequest) => {
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  return DriverRequestSchema.parse(params);
};

export const GET = createDomainHandler({
  domain: "driver",
  method: "GET",
  parse: parseDriverRequest,
  execute: (context, input) => getDriverProfile(context, input),
});
