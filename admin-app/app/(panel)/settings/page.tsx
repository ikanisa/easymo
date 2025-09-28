import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { createQueryClient } from '@/lib/api/queryClient';
import { SettingsClient } from './SettingsClient';
import {
  settingsQueryKeys,
  fetchSettingsPreview,
  type SettingsPreviewParams
} from '@/lib/queries/settings';
import {
  templatesQueryKeys,
  fetchTemplates,
  type TemplatesQueryParams
} from '@/lib/queries/templates';

const DEFAULT_PREVIEW_PARAMS: SettingsPreviewParams = { limit: 100 };
const DEFAULT_TEMPLATE_PARAMS: TemplatesQueryParams = { limit: 100 };

export default async function SettingsPage() {
  const queryClient = createQueryClient();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: settingsQueryKeys.preview(DEFAULT_PREVIEW_PARAMS),
      queryFn: () => fetchSettingsPreview(DEFAULT_PREVIEW_PARAMS)
    }),
    queryClient.prefetchQuery({
      queryKey: templatesQueryKeys.list(DEFAULT_TEMPLATE_PARAMS),
      queryFn: () => fetchTemplates(DEFAULT_TEMPLATE_PARAMS)
    })
  ]);

  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
      <SettingsClient
        initialPreviewParams={DEFAULT_PREVIEW_PARAMS}
        initialTemplateParams={DEFAULT_TEMPLATE_PARAMS}
      />
    </HydrationBoundary>
  );
}
