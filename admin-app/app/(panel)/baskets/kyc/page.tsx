import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/api/queryClient";
import { PageHeader } from "@/components/layout/PageHeader";
import { KycReviewTable } from "@/components/baskets/KycReviewTable";
import {
  basketsQueryKeys,
  fetchKycDocuments,
  type BasketsQueryParams,
} from "@/lib/queries/baskets";

const KYC_PARAMS: BasketsQueryParams = { limit: 100, status: 'pending' };

export default async function BasketsKycPage() {
  const queryClient = createQueryClient();

  await queryClient.prefetchQuery({
    queryKey: basketsQueryKeys.kyc(KYC_PARAMS),
    queryFn: () => fetchKycDocuments(KYC_PARAMS),
  });

  const dehydratedState = dehydrate(queryClient);

  return (
    <div className="admin-page">
      <PageHeader
        title="KYC Queue & OCR Review"
        description="Review National ID captures, compare parsed data, and approve or reject applications."
      />
      <HydrationBoundary state={dehydratedState}>
        <KycReviewTable params={KYC_PARAMS} />
      </HydrationBoundary>
    </div>
  );
}
