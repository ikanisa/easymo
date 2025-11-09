import { AtlasBlueprintPage } from "@/components/atlas/AtlasBlueprintPage";
import { getAtlasConfig } from "@/components/atlas/page-config";

export default function VoiceAnalyticsPage() {
  const config = getAtlasConfig("voice-analytics");
  return <AtlasBlueprintPage config={config} />;
}
