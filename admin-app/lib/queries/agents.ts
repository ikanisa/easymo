import {
  useQuery,
  type QueryKey,
  type UseQueryOptions,
} from "@tanstack/react-query";
import {
  listDriverRequests,
  type DriverRequestsResponse,
} from "@/lib/agents/driver-requests-service";

const DRIVER_REQUESTS_KEY: QueryKey = ["agents", "driver", "requests"];

export function fetchDriverRequests() {
  return listDriverRequests();
}

export function useDriverRequestsQuery(
  options?: UseQueryOptions<
    DriverRequestsResponse,
    unknown,
    DriverRequestsResponse
  >,
) {
  return useQuery({
    queryKey: DRIVER_REQUESTS_KEY,
    queryFn: fetchDriverRequests,
    staleTime: 20_000,
    ...options,
  });
}

export const driverQueryKeys = {
  requests: () => DRIVER_REQUESTS_KEY,
};
