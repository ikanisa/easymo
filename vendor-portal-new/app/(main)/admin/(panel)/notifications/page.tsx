import { GradientHeader } from "@/components/ui/gradient-header";
import { GlassCard } from "@/components/ui/glass-card";
import { StatusChip } from "@/components/common/status-chip";
import { NotificationQueueTable } from "@/components/admin/notification-queue-table";
import { SmsTemplatePanel } from "@/components/admin/sms-template-panel";
import { OutreachAutomationCard } from "@/components/admin/outreach-automation-card";
import { Trans } from "@/components/common/trans";
import { requireUserAndProfile } from "@/lib/auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabaseServer";
import { isMissingRelationError } from "@/lib/supabase/errors";
import {
  resolveTenantScope,
  resolveTenantScopeSearchParams,
  type TenantScopeSearchParamsInput,
} from "@/lib/admin/scope";
import { env } from "@/src/env.server";

interface NotificationsPageProps {
  searchParams?: TenantScopeSearchParamsInput;
}

type QueueRow = {
  id: string;
  event: string;
  sacco_id: string | null;
  template_id: string | null;
  status: string | null;
  scheduled_for: string | null;
  created_at: string | null;
  channel: string | null;
};

type TemplateRow = {
  id: string;
  name: string | null;
  sacco_id: string | null;
  is_active: boolean | null;
};

type SaccoOption = {
  id: string;
  name: string;
};

export default async function NotificationsPage({ searchParams }: NotificationsPageProps) {
  const { profile } = await requireUserAndProfile();
  const resolvedSearchParams = await resolveTenantScopeSearchParams(searchParams);
  const scope = resolveTenantScope(profile, resolvedSearchParams);
  const supabase = createSupabaseServiceRoleClient("admin/panel/notifications");

  const saccoQuery = supabase
    .schema("app")
    .from("saccos")
    .select("id, name")
    .order("name", { ascending: true });

  const saccoPromise = scope.includeAll
    ? saccoQuery
    : scope.saccoId
      ? saccoQuery.eq("id", scope.saccoId)
      : saccoQuery.limit(1);

  let queueQuery = supabase
    .from("notification_queue")
    .select("id, event, sacco_id, template_id, status, scheduled_for, created_at, channel")
    .order("created_at", { ascending: false })
    .limit(75);

  if (!scope.includeAll && scope.saccoId) {
    queueQuery = queueQuery.or(`sacco_id.eq.${scope.saccoId},sacco_id.is.null`);
  }

  let templateQuery = supabase
    .from("sms_templates")
    .select("id, name, sacco_id, is_active")
    .order("updated_at", { ascending: false })
    .limit(100);

  if (!scope.includeAll && scope.saccoId) {
    templateQuery = templateQuery.eq("sacco_id", scope.saccoId);
  }

  const [saccoResponse, queueResponse, templateResponse] = await Promise.all([
    saccoPromise,
    queueQuery,
    templateQuery,
  ]);

  if (saccoResponse.error && !isMissingRelationError(saccoResponse.error)) {
    throw saccoResponse.error;
  }
  if (queueResponse.error && !isMissingRelationError(queueResponse.error)) {
    throw queueResponse.error;
  }
  if (templateResponse.error && !isMissingRelationError(templateResponse.error)) {
    throw templateResponse.error;
  }

  const saccoOptions: SaccoOption[] = (saccoResponse.data ?? []).map((row) => ({
    id: String(row.id),
    name: row.name ?? "Unnamed SACCO",
  }));

  const queueRows = (queueResponse.data ?? []) as QueueRow[];
  const templateRows = (templateResponse.data ?? []) as TemplateRow[];

  const saccoLookup = new Map(saccoOptions.map((row) => [row.id, row.name] as const));
  const templateLookup = new Map(
    templateRows.map((row) => [row.id, row.name ?? `Template ${row.id.slice(0, 6)}`] as const)
  );

  const pendingCount = queueRows.filter((row) => !row.status || row.status === "pending").length;
  const deliveredCount = queueRows.filter((row) => row.status === "delivered").length;
  const failedCount = queueRows.filter((row) => row.status === "failed").length;
  const activeTemplates = templateRows.filter((row) => row.is_active).length;

  const channelAcks = {
    whatsapp: Boolean(env.META_WHATSAPP_ACCESS_TOKEN && env.META_WHATSAPP_PHONE_NUMBER_ID),
    email: Boolean(process.env.RESEND_API_KEY && env.MFA_EMAIL_FROM),
  } as const;

  return (
    <div className="space-y-8">
      <GradientHeader
        title={
          <Trans i18nKey="admin.notifications.title" fallback="Notifications & communications" />
        }
        subtitle={
          <Trans
            i18nKey="admin.notifications.subtitle"
            fallback="Coordinate outbound messaging, automated reminders, and delivery health."
            className="text-xs text-neutral-3"
          />
        }
        badge={<StatusChip tone="info">{pendingCount} queued</StatusChip>}
      />

      <GlassCard
        title={<Trans i18nKey="admin.notifications.metrics" fallback="Channel health" />}
        subtitle={
          <Trans
            i18nKey="admin.notifications.metricsSubtitle"
            fallback="Review queue depth, delivery success, and active templates."
            className="text-xs text-neutral-3"
          />
        }
      >
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricTile
            label={<Trans i18nKey="admin.notifications.metrics.pending" fallback="Pending" />}
            value={pendingCount}
            tone="warning"
          />
          <MetricTile
            label={<Trans i18nKey="admin.notifications.metrics.delivered" fallback="Delivered" />}
            value={deliveredCount}
            tone="success"
          />
          <MetricTile
            label={<Trans i18nKey="admin.notifications.metrics.failed" fallback="Failed" />}
            value={failedCount}
            tone="critical"
          />
          <MetricTile
            label={
              <Trans i18nKey="admin.notifications.metrics.templates" fallback="Active templates" />
            }
            value={activeTemplates}
            tone="info"
          />
        </dl>
      </GlassCard>

      <GlassCard
        title={
          <Trans i18nKey="admin.notifications.acksTitle" fallback="Channel acknowledgements" />
        }
        subtitle={
          <Trans
            i18nKey="admin.notifications.acksSubtitle"
            fallback="Ensure Twilio and Resend credentials are configured before dispatching."
            className="text-xs text-neutral-3"
          />
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <AckTile
            label={<Trans i18nKey="admin.notifications.acks.whatsapp" fallback="WhatsApp" />}
            configured={channelAcks.whatsapp}
            detail={
              <Trans
                i18nKey="admin.notifications.acks.whatsappDetail"
                fallback="Requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_FROM."
              />
            }
          />
          <AckTile
            label={<Trans i18nKey="admin.notifications.acks.email" fallback="Email" />}
            configured={channelAcks.email}
            detail={
              <Trans
                i18nKey="admin.notifications.acks.emailDetail"
                fallback="Requires RESEND_API_KEY and MFA_EMAIL_FROM."
              />
            }
          />
        </div>
      </GlassCard>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <GlassCard
          title={<Trans i18nKey="admin.notifications.queue" fallback="Delivery queue" />}
          subtitle={
            <Trans
              i18nKey="admin.notifications.queueSubtitle"
              fallback="Track scheduled and recently delivered notifications."
              className="text-xs text-neutral-3"
            />
          }
        >
          <NotificationQueueTable
            rows={queueRows}
            saccoLookup={saccoLookup}
            templateLookup={templateLookup}
          />
        </GlassCard>

        <GlassCard
          title={<Trans i18nKey="admin.notifications.automation" fallback="Escalations" />}
          subtitle={
            <Trans
              i18nKey="admin.notifications.automationSubtitle"
              fallback="Trigger follow-ups for aged reconciliation items."
              className="text-xs text-neutral-3"
            />
          }
          className="space-y-6"
        >
          <OutreachAutomationCard />
        </GlassCard>
      </div>

      {profile.role === "SYSTEM_ADMIN" ? (
        <GlassCard
          title={<Trans i18nKey="admin.notifications.templates" fallback="SMS templates" />}
          subtitle={
            <Trans
              i18nKey="admin.notifications.templatesSubtitle"
              fallback="Create localized templates, manage versions, and test deliveries."
              className="text-xs text-neutral-3"
            />
          }
        >
          {saccoOptions.length > 0 ? (
            <SmsTemplatePanel saccos={saccoOptions} />
          ) : (
            <p className="text-sm text-neutral-2">
              <Trans
                i18nKey="admin.notifications.noSaccos"
                fallback="Add a SACCO in the registry to begin authoring templates."
              />
            </p>
          )}
        </GlassCard>
      ) : (
        <GlassCard
          title={<Trans i18nKey="admin.notifications.templates" fallback="SMS templates" />}
          subtitle={
            <Trans
              i18nKey="admin.notifications.templatesReadOnly"
              fallback="Templates are curated centrally. Contact system administrators for changes."
              className="text-xs text-neutral-3"
            />
          }
        >
          <p className="text-sm text-neutral-2">
            <Trans
              i18nKey="admin.notifications.templatesInfo"
              fallback="You can preview outgoing templates from the queue above."
            />
          </p>
        </GlassCard>
      )}
    </div>
  );
}

function MetricTile({
  label,
  value,
  tone,
}: {
  label: React.ReactNode;
  value: number;
  tone: "info" | "success" | "warning" | "critical";
}) {
  const toneClasses: Record<typeof tone, string> = {
    info: "from-sky-500/10 via-sky-500/5 to-transparent text-sky-100",
    success: "from-emerald-500/10 via-emerald-500/5 to-transparent text-emerald-100",
    warning: "from-amber-500/10 via-amber-500/5 to-transparent text-amber-100",
    critical: "from-rose-500/10 via-rose-500/5 to-transparent text-rose-100",
  };

  return (
    <div className="rounded-3xl border border-white/5 bg-gradient-to-br from-white/10 to-transparent p-6">
      <p className="text-xs uppercase tracking-[0.3em] text-neutral-3">{label}</p>
      <p className={`mt-3 text-3xl font-semibold ${toneClasses[tone]}`}>{value.toLocaleString()}</p>
    </div>
  );
}

function AckTile({
  label,
  configured,
  detail,
}: {
  label: React.ReactNode;
  configured: boolean;
  detail: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs uppercase tracking-[0.3em] text-neutral-3">{label}</span>
        <StatusChip tone={configured ? "success" : "critical"}>
          {configured ? (
            <Trans i18nKey="admin.notifications.acks.connected" fallback="Connected" />
          ) : (
            <Trans i18nKey="admin.notifications.acks.missing" fallback="Missing" />
          )}
        </StatusChip>
      </div>
      <p className="mt-3 text-sm text-neutral-2">{detail}</p>
    </div>
  );
}
