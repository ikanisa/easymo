import { AtlasBlueprintPage } from "@/components/atlas/AtlasBlueprintPage";
import { getAtlasConfig } from "@/components/atlas/page-config";

export default function DriverNegotiationAgentPage() {
  const config = getAtlasConfig("agents/driver-negotiation");
  return <AtlasBlueprintPage config={config} />;
}
