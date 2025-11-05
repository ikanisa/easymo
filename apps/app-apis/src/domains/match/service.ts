import type { DomainHandlerContext } from "@app-apis/lib/createDomainHandler";
import { getSupabaseRepositories } from "@app-apis/lib/supabase";
import { measure } from "@app-apis/lib/perf";
import type { MatchRequest, MatchResponse } from "@app-apis/domains/match/schemas";
import { v4 as uuid } from "uuid";

export const createMatch = async (
  context: DomainHandlerContext,
  payload: MatchRequest
): Promise<MatchResponse> => {
  const repositories = getSupabaseRepositories();
  const record = await measure("match.repository", () =>
    repositories.match.create(context, {
      id: uuid(),
      rider_id: payload.riderId,
      driver_id: payload.driverId,
      pickup_time: payload.pickupTime,
      status: "pending",
    })
  );

  return {
    id: record.id,
    riderId: record.rider_id,
    driverId: record.driver_id,
    pickupTime: record.pickup_time,
    status: record.status,
  };
};
