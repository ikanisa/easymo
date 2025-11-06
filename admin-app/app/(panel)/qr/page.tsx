export const dynamic = 'force-dynamic';

import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/api/queryClient";
import { QrClient } from "./QrClient";
import {
  fetchQrTokens,
  qrQueryKeys,
  type QrTokensQueryParams,
} from "@/lib/queries/qr";
import {
  barsQueryKeys,
  type BarsQueryParams,
  fetchBars,
} from "@/lib/queries/bars";

const DEFAULT_TOKEN_PARAMS: QrTokensQueryParams = { limit: 100 };
const DEFAULT_BAR_PARAMS: BarsQueryParams = { limit: 100 };

export default async function QrPage() {
  const queryClient = createQueryClient();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: qrQueryKeys.list(DEFAULT_TOKEN_PARAMS),
      queryFn: () => fetchQrTokens(DEFAULT_TOKEN_PARAMS),
    }),
    queryClient.prefetchQuery({
      queryKey: barsQueryKeys.list(DEFAULT_BAR_PARAMS),
      queryFn: () => fetchBars(DEFAULT_BAR_PARAMS),
    }),
  ]);

  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
      <QrClient
        initialTokenParams={DEFAULT_TOKEN_PARAMS}
        initialBarParams={DEFAULT_BAR_PARAMS}
      />
    </HydrationBoundary>
  );
}

export const runtime = "edge";
