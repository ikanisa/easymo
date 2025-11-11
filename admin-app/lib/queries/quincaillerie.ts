import {
  useQuery,
  type QueryKey,
  type UseQueryOptions,
} from "@tanstack/react-query";
import {
  listQuincaillerieVendors,
  type QuincaillerieVendorsResponse,
} from "@/lib/agents/quincaillerie-service";

const QUINCA_VENDORS_KEY: QueryKey = ["agents", "quincaillerie", "vendors"];

export function fetchQuincaillerieVendors() {
  return listQuincaillerieVendors();
}

export function useQuincaillerieVendors(
  options?: UseQueryOptions<
    QuincaillerieVendorsResponse,
    unknown,
    QuincaillerieVendorsResponse
  >,
) {
  return useQuery({
    queryKey: QUINCA_VENDORS_KEY,
    queryFn: fetchQuincaillerieVendors,
    staleTime: 20_000,
    ...options,
  });
}

export const quincaQueryKeys = {
  vendors: () => QUINCA_VENDORS_KEY,
};

