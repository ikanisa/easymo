import type { DomainHandlerContext } from "@app-apis/lib/createDomainHandler";
import { getSupabaseRepositories } from "@app-apis/lib/supabase";
import { measure } from "@app-apis/lib/perf";
import type { BrokerRequest, BrokerResponse } from "@app-apis/domains/broker/schemas";
import { v4 as uuid } from "uuid";

export const publishEvent = async (
  context: DomainHandlerContext,
  payload: BrokerRequest
): Promise<BrokerResponse> => {
  const repositories = getSupabaseRepositories();
  const record = await measure("broker.repository", () =>
    repositories.broker.publish(context, {
      id: uuid(),
      topic: payload.topic,
      payload: payload.payload,
    })
  );

  return {
    id: record.id,
    topic: record.topic,
    payload: record.payload as Record<string, unknown>,
    createdAt: record.created_at,
  };
};
