import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { SectionCard } from "@/components/ui/SectionCard";
import { SettingsTable } from "@/components/settings/SettingsTable";
import type { SettingEntry } from "@/lib/schemas";

type SettingsPreviewSectionProps = {
  isLoading: boolean;
  data: SettingEntry[];
};

export function SettingsPreviewSection({
  isLoading,
  data,
}: SettingsPreviewSectionProps) {
  return (
    <SectionCard
      title="Current values"
      description="Snapshot of settings from the data provider."
    >
      {isLoading
        ? (
          <LoadingState
            title="Loading settings"
            description="Reading saved configuration."
          />
        )
        : data.length
        ? <SettingsTable data={data} />
        : (
          <EmptyState
            title="Settings preview unavailable"
            description="Connect to Supabase to view saved settings."
          />
        )}
    </SectionCard>
  );
}
