import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/api/queryClient";
import { FilesClient } from "./FilesClient";
import {
  fetchStorageObjects,
  storageQueryKeys,
  type StorageQueryParams,
} from "@/lib/queries/files";

const DEFAULT_PARAMS: StorageQueryParams = { limit: 200 };

export default async function FilesPage() {
  const queryClient = createQueryClient();

  await queryClient.prefetchQuery({
    queryKey: storageQueryKeys.list(DEFAULT_PARAMS),
    queryFn: () => fetchStorageObjects(DEFAULT_PARAMS),
  });

  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
      <FilesClient initialParams={DEFAULT_PARAMS} />
    </HydrationBoundary>
  );
}
