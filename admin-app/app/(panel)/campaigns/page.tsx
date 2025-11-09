import { AtlasBlueprintPage } from "@/components/atlas/AtlasBlueprintPage";
import { getAtlasConfig } from "@/components/atlas/page-config";

export default function CampaignsPage() {
  const config = getAtlasConfig("campaigns");
  return <AtlasBlueprintPage config={config} />;
}
