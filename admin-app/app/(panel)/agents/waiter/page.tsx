import { AtlasBlueprintPage } from "@/components/atlas/AtlasBlueprintPage";
import { getAtlasConfig } from "@/components/atlas/page-config";

export default function WaiterAgentPage() {
  const config = getAtlasConfig("agents/waiter");
  return <AtlasBlueprintPage config={config} />;
}
