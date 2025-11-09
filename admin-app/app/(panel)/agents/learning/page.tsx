import { AtlasBlueprintPage } from "@/components/atlas/AtlasBlueprintPage";
import { getAtlasConfig } from "@/components/atlas/page-config";

export default function AgentLearningPage() {
  const config = getAtlasConfig("agents/learning");
  return <AtlasBlueprintPage config={config} />;
}
