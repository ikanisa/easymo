import { AtlasBlueprintPage } from "@/components/atlas/AtlasBlueprintPage";
import { getAtlasConfig } from "@/components/atlas/page-config";

export default function AgentsSettingsPage() {
  const config = getAtlasConfig("agents/settings");
  return <AtlasBlueprintPage config={config} />;
}
