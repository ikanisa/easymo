import { AtlasBlueprintPage } from "@/components/atlas/AtlasBlueprintPage";
import { getAtlasConfig } from "@/components/atlas/page-config";
import { createPanelPageMetadata } from "@/components/layout/nav-items";

export const metadata = createPanelPageMetadata("/sessions");

export default function SessionsPage() {
  const config = getAtlasConfig("sessions");
  return <AtlasBlueprintPage config={config} />;
}
