import { AtlasBlueprintPage } from "@/components/atlas/AtlasBlueprintPage";
import { getAtlasConfig } from "@/components/atlas/page-config";
import { createPanelPageMetadata } from "@/components/layout/nav-items";

export const metadata = createPanelPageMetadata("/vendor-responses");

export default function VendorResponsesPage() {
  const config = getAtlasConfig("vendor-responses");
  return <AtlasBlueprintPage config={config} />;
}
