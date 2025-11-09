import { AtlasBlueprintPage } from "@/components/atlas/AtlasBlueprintPage";
import { getAtlasConfig } from "@/components/atlas/page-config";

export default function PharmacyAgentPage() {
  const config = getAtlasConfig("agents/pharmacy");
  return <AtlasBlueprintPage config={config} />;
}
