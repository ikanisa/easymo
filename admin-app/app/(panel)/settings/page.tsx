export const dynamic = 'force-dynamic';

import { createPanelPageMetadata } from "@/components/layout/nav-items";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/api/queryClient";
import { SettingsClient } from "./SettingsClient";
import {
  fetchSettingsPreview,
  type SettingsPreviewParams,
  settingsQueryKeys,
} from "@/lib/queries/settings";
import {
  fetchAdminAlertPreferences,
  alertPreferencesQueryKeys,
} from "@/lib/queries/alertPreferences";

export const metadata = createPanelPageMetadata("/settings");

const DEFAULT_PREVIEW_PARAMS: SettingsPreviewParams = { limit: 100 };

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
  ]);

  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
      <SettingsClient initialPreviewParams={DEFAULT_PREVIEW_PARAMS} />
    </HydrationBoundary>
  );
}
