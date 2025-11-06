export const dynamic = 'force-dynamic';

import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/api/queryClient";
import { SettingsClient } from "./SettingsClient";
import {
  fetchSettingsPreview,
  type SettingsPreviewParams,
  settingsQueryKeys,
} from "@/lib/queries/settings";
import {
  fetchTemplates,
  templatesQueryKeys,
  type TemplatesQueryParams,
} from "@/lib/queries/templates";
import {
  fetchAdminAlertPreferences,
  alertPreferencesQueryKeys,
} from "@/lib/queries/alertPreferences";

const DEFAULT_PREVIEW_PARAMS: SettingsPreviewParams = { limit: 100 };
const DEFAULT_TEMPLATE_PARAMS: TemplatesQueryParams = { limit: 100 };

export default async function SettingsPage() {
  const queryClient = createQueryClient();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: settingsQueryKeys.preview(DEFAULT_PREVIEW_PARAMS),
      queryFn: () => fetchSettingsPreview(DEFAULT_PREVIEW_PARAMS),
    }),
    queryClient.prefetchQuery({
      queryKey: alertPreferencesQueryKeys.all(),
      queryFn: fetchAdminAlertPreferences,
    }),
    queryClient.prefetchQuery({
      queryKey: templatesQueryKeys.list(DEFAULT_TEMPLATE_PARAMS),
      queryFn: () => fetchTemplates(DEFAULT_TEMPLATE_PARAMS),
    }),
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

export const runtime = "edge";
