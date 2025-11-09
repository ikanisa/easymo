import { AtlasBlueprintPage } from "@/components/atlas/AtlasBlueprintPage";
import { getAtlasConfig } from "@/components/atlas/page-config";

export default function QuincaillerieAgentPage() {
  const config = getAtlasConfig("agents/quincaillerie");
  return <AtlasBlueprintPage config={config} />;
}
