import { MarketplaceSettingsClient } from "./MarketplaceSettingsClient";
import { createPanelPageMetadata } from "@/components/layout/nav-items";

export const metadata = createPanelPageMetadata("/marketplace/settings");

export default function MarketplaceSettingsPage() {
  return <MarketplaceSettingsClient />;
}
