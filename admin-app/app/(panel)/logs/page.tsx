export const dynamic = 'force-dynamic';

import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { createPanelPageMetadata } from "@/components/layout/nav-items";
import { PageHeader } from "@/components/layout/PageHeader";
import { LogsClient } from "@/components/logs/LogsClient";
import { createQueryClient } from "@/lib/api/queryClient";
import { fetchLogs, logsQueryKeys } from "@/lib/queries/logs";

export const metadata = createPanelPageMetadata("/logs");

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
          description="Unified audit event stream with filters, JSON drawer, and export options."
        />
        <LogsClient />
      </div>
    </HydrationBoundary>
  );
}
