import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { EmptyState } from "@/components/ui/EmptyState";

export default function ContributionRulesPage() {
  return (
    <div className="admin-page">
      <PageHeader
        title="Contribution Rules & Cycles"
        description="Configure fixed/variable amounts, periodicity, and reminder policies per Ikimina."
      />
      <SectionCard
        title="Rule configuration pending"
        description="Future updates will enable editing contribution settings, quiet hours, and reminder templates."
      >
        <EmptyState
          title="Contribution config coming soon"
          description="This section will surface rules stored in ibimina_settings and cycle summaries."
        />
      </SectionCard>
    </div>
  );
}

