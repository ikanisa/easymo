import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { SectionCard } from "@/components/ui/SectionCard";
import { TemplatesTable } from "@/components/templates/TemplatesTable";
import type { TemplateMeta } from "@/lib/schemas";

type TemplatesSectionProps = {
  isLoading: boolean;
  templates: TemplateMeta[];
  statusFilter: string;
  hasMore?: boolean;
  loadingMore?: boolean;
  onStatusChange: (value: string) => void;
  onLoadMore: () => void;
};

export function TemplatesSection({
  isLoading,
  templates,
  statusFilter,
  hasMore,
  loadingMore,
  onStatusChange,
  onLoadMore,
}: TemplatesSectionProps) {
  return (
    <SectionCard
      title="Template library"
      description="Manage template metadata and variables without leaving the settings screen."
    >
      {isLoading
        ? (
          <LoadingState
            title="Loading templates"
            description="Fetching template metadata."
          />
        )
        : templates.length
        ? (
          <TemplatesTable
            data={templates}
            statusFilter={statusFilter}
            hasMore={hasMore}
            loadingMore={loadingMore}
            onStatusChange={onStatusChange}
            onLoadMore={onLoadMore}
          />
        )
        : (
          <EmptyState
            title="Templates unavailable"
            description="Connect to Supabase to view template configuration."
          />
        )}
    </SectionCard>
  );
}
