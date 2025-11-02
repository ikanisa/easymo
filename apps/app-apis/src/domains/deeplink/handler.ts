import { DeeplinkRequestSchema } from "@app-apis/domains/deeplink/schemas";
import { upsertDeeplink } from "@app-apis/domains/deeplink/service";
import { createDomainHandler } from "@app-apis/lib/createDomainHandler";
import { readJsonBody } from "@app-apis/lib/request";
import { NextRequest } from "next/server";

const parseDeeplinkRequest = async (request: NextRequest) => {
  const body = await readJsonBody<unknown>(request);
  return DeeplinkRequestSchema.parse(body);
};

export const POST = createDomainHandler({
  domain: "deeplink",
  method: "POST",
  parse: parseDeeplinkRequest,
  execute: (context, input) => upsertDeeplink(context, input),
});
