import { MatchRequestSchema } from "@app-apis/domains/match/schemas";
import { createMatch } from "@app-apis/domains/match/service";
import { createDomainHandler } from "@app-apis/lib/createDomainHandler";
import { readJsonBody } from "@app-apis/lib/request";
import { NextRequest } from "next/server";

const parseMatchRequest = async (request: NextRequest) => {
  const body = await readJsonBody<unknown>(request);
  return MatchRequestSchema.parse(body);
};

export const POST = createDomainHandler({
  domain: "match",
  method: "POST",
  parse: parseMatchRequest,
  execute: (context, input) => createMatch(context, input),
});
