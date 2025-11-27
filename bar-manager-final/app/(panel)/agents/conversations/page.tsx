import { AtlasBlueprintPage } from "@/components/atlas/AtlasBlueprintPage";
import { getAtlasConfig } from "@/components/atlas/page-config";

export default function ConversationsPage() {
  const config = getAtlasConfig("agents/conversations");
  return <AtlasBlueprintPage config={config} />;
}
