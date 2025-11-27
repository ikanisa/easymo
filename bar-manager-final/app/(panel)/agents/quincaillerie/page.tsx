export const dynamic = "force-dynamic";

import { dehydrate,HydrationBoundary } from "@tanstack/react-query";

import { createQueryClient } from "@/lib/api/queryClient";
import {
  fetchQuincaillerieVendors,
  quincaQueryKeys,
} from "@/lib/queries/quincaillerie";

import { QuincaillerieAgentClient } from "./QuincaillerieAgentClient";

export default async function QuincaillerieAgentPage() {
  const queryClient = createQueryClient();

  await queryClient.prefetchQuery({
    queryKey: quincaQueryKeys.vendors(),
    queryFn: fetchQuincaillerieVendors,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <QuincaillerieAgentClient />
    </HydrationBoundary>
  );
}
