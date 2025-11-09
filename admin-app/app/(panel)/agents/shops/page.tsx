import { AtlasBlueprintPage } from "@/components/atlas/AtlasBlueprintPage";
import { getAtlasConfig } from "@/components/atlas/page-config";

export default function ShopsAgentPage() {
  const config = getAtlasConfig("agents/shops");
  return <AtlasBlueprintPage config={config} />;
}
