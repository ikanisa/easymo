import type { DomainHandlerContext } from "@app-apis/lib/createDomainHandler";
import { getSupabaseRepositories } from "@app-apis/lib/supabase";
import { measure } from "@app-apis/lib/perf";
import type { DeeplinkRequest, DeeplinkResponse } from "@app-apis/domains/deeplink/schemas";
import { v4 as uuid } from "uuid";

export const upsertDeeplink = async (
  context: DomainHandlerContext,
  payload: DeeplinkRequest
): Promise<DeeplinkResponse> => {
  const repositories = getSupabaseRepositories();
  const record = await measure("deeplink.repository", () =>
    repositories.deeplink.upsert(context, {
      id: uuid(),
      target: payload.target,
      url: payload.url,
      metadata: payload.metadata ?? null,
    })
  );

  return {
    id: record.id,
    target: record.target,
    url: record.url,
    metadata: record.metadata,
    createdAt: record.created_at,
  };
};
