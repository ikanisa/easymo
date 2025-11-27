import { AtlasBlueprintPage } from "@/components/atlas/AtlasBlueprintPage";
import { getAtlasConfig } from "@/components/atlas/page-config";
import { createPanelPageMetadata } from "@/components/layout/nav-items";

export const metadata = createPanelPageMetadata("/live-calls");

export default function LiveCallsPage() {
  const config = getAtlasConfig("live-calls");
  return <AtlasBlueprintPage config={config} />;
}
