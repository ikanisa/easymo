export const dynamic = 'force-dynamic';

import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { createPanelPageMetadata } from "@/components/layout/nav-items";
import { createQueryClient } from "@/lib/api/queryClient";
import {
  alertPreferencesQueryKeys,
  fetchAdminAlertPreferences,
} from "@/lib/queries/alertPreferences";
import {
  fetchSettingsPreview,
  type SettingsPreviewParams,
  settingsQueryKeys,
} from "@/lib/queries/settings";

import { SettingsClient } from "./SettingsClient";

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
