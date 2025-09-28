import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { createQueryClient } from '@/lib/api/queryClient';
import { MenusClient } from './MenusClient';
import {
  menuQueryKeys,
  fetchMenuVersions,
  type MenuQueryParams,
  ocrJobQueryKeys,
  fetchOcrJobs,
  type OcrJobQueryParams
} from '@/lib/queries/menus';

const DEFAULT_MENU_PARAMS: MenuQueryParams = { limit: 100 };
const DEFAULT_OCR_PARAMS: OcrJobQueryParams = { limit: 50 };

export default async function MenusPage() {
  const queryClient = createQueryClient();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: menuQueryKeys.versions(DEFAULT_MENU_PARAMS),
      queryFn: () => fetchMenuVersions(DEFAULT_MENU_PARAMS)
    }),
    queryClient.prefetchQuery({
      queryKey: ocrJobQueryKeys.list(DEFAULT_OCR_PARAMS),
      queryFn: () => fetchOcrJobs(DEFAULT_OCR_PARAMS)
    })
  ]);

  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
      <MenusClient initialMenuParams={DEFAULT_MENU_PARAMS} initialOcrParams={DEFAULT_OCR_PARAMS} />
    </HydrationBoundary>
  );
}
