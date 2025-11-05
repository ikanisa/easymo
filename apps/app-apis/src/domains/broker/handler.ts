import { BrokerRequestSchema } from "@app-apis/domains/broker/schemas";
import { publishEvent } from "@app-apis/domains/broker/service";
import { createDomainHandler } from "@app-apis/lib/createDomainHandler";
import { readJsonBody } from "@app-apis/lib/request";
import { NextRequest } from "next/server";

const parseBrokerRequest = async (request: NextRequest) => {
  const body = await readJsonBody<unknown>(request);
  return BrokerRequestSchema.parse(body);
};

export const POST = createDomainHandler({
  domain: "broker",
  method: "POST",
  parse: parseBrokerRequest,
  execute: (context, input) => publishEvent(context, input),
});
