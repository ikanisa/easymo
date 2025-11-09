import { AtlasBlueprintPage } from "@/components/atlas/AtlasBlueprintPage";
import { getAtlasConfig } from "@/components/atlas/page-config";

export default function VendorResponsesPage() {
  const config = getAtlasConfig("vendor-responses");
  return <AtlasBlueprintPage config={config} />;
}
