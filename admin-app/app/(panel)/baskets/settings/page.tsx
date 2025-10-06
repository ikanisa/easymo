import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/api/queryClient";
import { PageHeader } from "@/components/layout/PageHeader";
import { BasketsSettingsForm } from "@/components/baskets/BasketsSettingsForm";
import { basketsQueryKeys, fetchBasketsSettings } from "@/lib/queries/baskets";

export default async function BasketsSettingsPage() {
  const queryClient = createQueryClient();

  await queryClient.prefetchQuery({
    queryKey: basketsQueryKeys.settings,
    queryFn: fetchBasketsSettings,
  });

  const dehydratedState = dehydrate(queryClient);

  return (
    <div className="admin-page">
      <PageHeader
        title="Baskets Settings"
        description="Configure MoMo codes, quiet hours, templates, feature flags, and reminder policies."
      />
      <HydrationBoundary state={dehydratedState}>
        <BasketsSettingsForm />
      </HydrationBoundary>
    </div>
  );
}
