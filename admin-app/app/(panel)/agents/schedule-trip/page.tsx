import { AtlasBlueprintPage } from "@/components/atlas/AtlasBlueprintPage";
import { getAtlasConfig } from "@/components/atlas/page-config";

export default function ScheduleTripAgentPage() {
  const config = getAtlasConfig("agents/schedule-trip");
  return <AtlasBlueprintPage config={config} />;
}
