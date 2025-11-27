import { AtlasBlueprintPage } from "@/components/atlas/AtlasBlueprintPage";
import { getAtlasConfig } from "@/components/atlas/page-config";

export default function AgentPerformancePage() {
  const config = getAtlasConfig("agents/performance");
  return <AtlasBlueprintPage config={config} />;
}
