import {
  useQuery,
  type QueryKey,
  type UseQueryOptions,
} from "@tanstack/react-query";
import {
  listScheduledTrips,
  type ScheduledTripsResponse,
} from "@/lib/agents/schedule-trips-service";

const SCHEDULE_TRIPS_KEY: QueryKey = ["agents", "schedule-trip", "list"];

export function fetchScheduledTrips() {
  return listScheduledTrips();
}

export function useScheduledTripsQuery(
  options?: UseQueryOptions<
    ScheduledTripsResponse,
    unknown,
    ScheduledTripsResponse
  >,
) {
  return useQuery({
    queryKey: SCHEDULE_TRIPS_KEY,
    queryFn: fetchScheduledTrips,
    staleTime: 20_000,
    ...options,
  });
}

export const scheduleTripQueryKeys = {
  list: () => SCHEDULE_TRIPS_KEY,
};

