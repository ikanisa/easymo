import { AtlasBlueprintPage } from "@/components/atlas/AtlasBlueprintPage";
import { getAtlasConfig } from "@/components/atlas/page-config";

export default function SessionsPage() {
  const config = getAtlasConfig("sessions");
  return <AtlasBlueprintPage config={config} />;
}
