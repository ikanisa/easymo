import { AtlasBlueprintPage } from "@/components/atlas/AtlasBlueprintPage";
import { getAtlasConfig } from "@/components/atlas/page-config";

export default function PropertyRentalAgentPage() {
  const config = getAtlasConfig("agents/property-rental");
  return <AtlasBlueprintPage config={config} />;
}
