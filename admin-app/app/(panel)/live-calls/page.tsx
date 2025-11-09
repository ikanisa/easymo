import { AtlasBlueprintPage } from "@/components/atlas/AtlasBlueprintPage";
import { getAtlasConfig } from "@/components/atlas/page-config";

export default function LiveCallsPage() {
  const config = getAtlasConfig("live-calls");
  return <AtlasBlueprintPage config={config} />;
}
