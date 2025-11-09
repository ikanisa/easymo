import { AtlasBlueprintPage } from "@/components/atlas/AtlasBlueprintPage";
import { getAtlasConfig } from "@/components/atlas/page-config";

export default function LeadsPage() {
  const config = getAtlasConfig("leads");
  return <AtlasBlueprintPage config={config} />;
}
