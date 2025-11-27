import {
  type QueryKey,
  useQuery,
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

type QuincaillerieVendorsQueryOptions = Omit<
  UseQueryOptions<QuincaillerieVendorsResponse, unknown, QuincaillerieVendorsResponse>,
  "queryKey" | "queryFn"
>;

export function useQuincaillerieVendors(
  options?: QuincaillerieVendorsQueryOptions,
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

