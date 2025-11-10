import { AtlasBlueprintPage } from "@/components/atlas/AtlasBlueprintPage";
import { getAtlasConfig } from "@/components/atlas/page-config";
import { LearningModules } from "@/components/agents/LearningModules";

export default function AgentLearningPage() {
  const config = getAtlasConfig("agents/learning");
  return (
    <div className="admin-page space-y-6">
      <AtlasBlueprintPage config={config} />
      <LearningModules />
    </div>
  );
}
