export const dynamic = 'force-dynamic';

import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/api/queryClient";
import { PageHeader } from "@/components/layout/PageHeader";
import { LogsClient } from "@/components/logs/LogsClient";
import { fetchLogs, logsQueryKeys } from "@/lib/queries/logs";

export default async function LogsPage() {
  const queryClient = createQueryClient();

  await queryClient.prefetchQuery({
    queryKey: logsQueryKeys.root(),
    queryFn: fetchLogs,
  });

  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
      <div className="admin-page">
        <PageHeader
          title="Logs"
          description="Unified audit and voucher event stream with filters, JSON drawer, and export options."
        />
        <LogsClient />
      </div>
    </HydrationBoundary>
  );
}

export const runtime = "edge";
