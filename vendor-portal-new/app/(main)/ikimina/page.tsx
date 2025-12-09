import { GradientHeader } from "@/components/ui/gradient-header";
import { requireUserAndProfile } from "@/lib/auth";
import { IkiminaTable } from "@/components/ikimina/ikimina-table";
import { Trans } from "@/components/common/trans";
import { getIkiminaDirectorySummary } from "@/lib/ikimina/list";

export default async function IkiminaPage() {
  const { profile } = await requireUserAndProfile();
  const includeAll = profile.role === "SYSTEM_ADMIN";
  const { rows, statusOptions, typeOptions, saccoOptions } = await getIkiminaDirectorySummary({
    saccoId: profile.sacco_id,
    includeAll,
  });

  return (
    <div className="space-y-8">
      <GradientHeader
        title={<Trans i18nKey="ikimina.list.title" fallback="Ikimina Directory" />}
        subtitle={
          <Trans
            i18nKey="ikimina.list.subtitle"
            fallback="Browse, filter, and drill into every group under your SACCO."
            className="text-xs text-ink/70"
          />
        }
      />
      <IkiminaTable
        rows={rows}
        statusOptions={statusOptions}
        typeOptions={typeOptions}
        saccoOptions={includeAll ? saccoOptions : undefined}
        showSaccoColumn={includeAll}
      />
    </div>
  );
}
