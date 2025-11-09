import { AtlasBlueprintPage } from "@/components/atlas/AtlasBlueprintPage";
import { getAtlasConfig } from "@/components/atlas/page-config";

export default function NegotiationsPage() {
  const config = getAtlasConfig("negotiations");
  return <AtlasBlueprintPage config={config} />;
}
