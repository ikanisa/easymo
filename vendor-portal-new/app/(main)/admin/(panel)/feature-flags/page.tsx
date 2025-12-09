import { GradientHeader } from "@/components/ui/gradient-header";
import { GlassCard } from "@/components/ui/glass-card";
import { StatusChip } from "@/components/common/status-chip";
import { FeatureFlagsCard } from "@/components/admin/feature-flags-card";
import { Trans } from "@/components/common/trans";
import { requireUserAndProfile } from "@/lib/auth";

// Feature flags change rarely, enable caching
export const revalidate = 120; // 2 minutes

export default async function FeatureFlagsPage() {
  const { profile } = await requireUserAndProfile();
  const canEdit = profile.role === "SYSTEM_ADMIN";

  return (
    <div className="space-y-8">
      <GradientHeader
        title={<Trans i18nKey="admin.featureFlags.title" fallback="Feature flags & experiments" />}
        subtitle={
          <Trans
            i18nKey="admin.featureFlags.subtitle"
            fallback="Toggle guarded rollouts, background automations, and experiment controls."
            className="text-xs text-neutral-3"
          />
        }
        badge={
          <StatusChip tone={canEdit ? "success" : "info"}>
            {canEdit ? "Editable" : "Read only"}
          </StatusChip>
        }
      />

      <GlassCard
        title={
          <Trans i18nKey="admin.featureFlags.configuration" fallback="Platform configuration" />
        }
        subtitle={
          <Trans
            i18nKey="admin.featureFlags.configurationSubtitle"
            fallback="Manage feature toggles that orchestrate the admin and member experience."
            className="text-xs text-neutral-3"
          />
        }
      >
        {canEdit ? (
          <FeatureFlagsCard />
        ) : (
          <p className="text-sm text-neutral-2">
            <Trans
              i18nKey="admin.featureFlags.readOnly"
              fallback="Only system administrators can adjust feature flags. Contact your platform owner for changes."
            />
          </p>
        )}
      </GlassCard>

      <GlassCard
        title={<Trans i18nKey="admin.featureFlags.changeLog" fallback="Operational guidance" />}
        subtitle={
          <Trans
            i18nKey="admin.featureFlags.changeLogSubtitle"
            fallback="Track dependencies before toggling runtime-sensitive capabilities."
            className="text-xs text-neutral-3"
          />
        }
      >
        <ul className="list-disc space-y-2 pl-6 text-sm text-neutral-2">
          <li>
            <Trans
              i18nKey="admin.featureFlags.guidance.offlineQueue"
              fallback="Ensure background workers are connected before enabling the offline queue."
            />
          </li>
          <li>
            <Trans
              i18nKey="admin.featureFlags.guidance.reconciliation"
              fallback="Scheduled reconciliation requires the edge function deployment to be healthy."
            />
          </li>
          <li>
            <Trans
              i18nKey="admin.featureFlags.guidance.notifications"
              fallback="Notification pipeline sends SMS, email, and WhatsApp through configured providers."
            />
          </li>
        </ul>
      </GlassCard>
    </div>
  );
}
