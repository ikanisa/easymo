import { AtlasBlueprintPage } from "@/components/atlas/AtlasBlueprintPage";
import { getAtlasConfig } from "@/components/atlas/page-config";
import { createPanelPageMetadata } from "@/components/layout/nav-items";

export const metadata = createPanelPageMetadata("/leads");

export default function LeadsPage() {
  const config = getAtlasConfig("leads");
  return <AtlasBlueprintPage config={config} />;
}
