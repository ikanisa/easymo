import { AtlasBlueprintPage } from "@/components/atlas/AtlasBlueprintPage";
import { getAtlasConfig } from "@/components/atlas/page-config";
import { createPanelPageMetadata } from "@/components/layout/nav-items";

export const metadata = createPanelPageMetadata("/voice-analytics");

export default function VoiceAnalyticsPage() {
  const config = getAtlasConfig("voice-analytics");
  return <AtlasBlueprintPage config={config} />;
}
