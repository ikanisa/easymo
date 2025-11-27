import { AtlasBlueprintPage } from "@/components/atlas/AtlasBlueprintPage";
import { getAtlasConfig } from "@/components/atlas/page-config";
import { createPanelPageMetadata } from "@/components/layout/nav-items";

export const metadata = createPanelPageMetadata("/negotiations");

export default function NegotiationsPage() {
  const config = getAtlasConfig("negotiations");
  return <AtlasBlueprintPage config={config} />;
}
