import { createPanelPageMetadata } from "@/components/layout/nav-items";

import { MarketplaceSettingsClient } from "./MarketplaceSettingsClient";

export const metadata = createPanelPageMetadata("/marketplace/settings");

export default function MarketplaceSettingsPage() {
  return <MarketplaceSettingsClient />;
}
