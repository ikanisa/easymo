"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useToast } from "@/providers/toast-provider";
import { useTranslation } from "@/providers/i18n-provider";
import { updateTenantSettings } from "@/app/(main)/admin/actions";

export type TenantSettingsRecord = {
  saccoId: string;
  saccoName: string;
  metadata: Record<string, unknown> | null;
};

interface TenantSettingsPanelProps {
  saccos: TenantSettingsRecord[];
  canEdit: boolean;
  initialSaccoId: string | null;
}

interface TenantSettingsState {
  rules: string;
  feePolicy: string;
  enhancedThreshold: number;
  freezeThreshold: number;
  integrations: {
    webhook: boolean;
    edgeReconciliation: boolean;
    notifications: boolean;
  };
  updatedAt: string | null;
  updatedBy: string | null;
}

const DEFAULT_STATE: TenantSettingsState = {
  rules: "",
  feePolicy: "",
  enhancedThreshold: 1000000,
  freezeThreshold: 5000000,
  integrations: {
    webhook: false,
    edgeReconciliation: false,
    notifications: false,
  },
  updatedAt: null,
  updatedBy: null,
};

export function TenantSettingsPanel({ saccos, canEdit, initialSaccoId }: TenantSettingsPanelProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string | null>(
    initialSaccoId ?? saccos[0]?.saccoId ?? null
  );
  const [state, setState] = useState<TenantSettingsState>(DEFAULT_STATE);

  const selectedRecord = useMemo(
    () => saccos.find((item) => item.saccoId === selected) ?? null,
    [selected, saccos]
  );

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      if (!selectedRecord) {
        setState((prev) => (prev === DEFAULT_STATE ? prev : DEFAULT_STATE));
        return;
      }
      const meta = (selectedRecord.metadata ?? {}) as Record<string, unknown>;
      const adminSettings = (meta.admin_settings ?? {}) as Record<string, unknown>;
      const kyc = (adminSettings.kycThresholds ?? {}) as Record<string, unknown>;
      const integrations = (adminSettings.integrations ?? {}) as Record<string, unknown>;
      const nextState: TenantSettingsState = {
        rules: String(adminSettings.rules ?? ""),
        feePolicy: String(adminSettings.feePolicy ?? ""),
        enhancedThreshold: Number(kyc.enhanced ?? 1000000) || 0,
        freezeThreshold: Number(kyc.freeze ?? 5000000) || 0,
        integrations: {
          webhook: Boolean(integrations.webhook ?? false),
          edgeReconciliation: Boolean(integrations.edgeReconciliation ?? false),
          notifications: Boolean(integrations.notifications ?? false),
        },
        updatedAt: typeof adminSettings.updated_at === "string" ? adminSettings.updated_at : null,
        updatedBy: typeof adminSettings.updated_by === "string" ? adminSettings.updated_by : null,
      };
      setState((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(nextState)) {
          return prev;
        }
        return nextState;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [selectedRecord]);

  const updateField = <K extends keyof TenantSettingsState>(
    key: K,
    value: TenantSettingsState[K]
  ) => {
    setState((prev) => ({ ...prev, [key]: value }));
  };

  const updateIntegration = (key: keyof TenantSettingsState["integrations"], value: boolean) => {
    setState((prev) => ({
      ...prev,
      integrations: {
        ...prev.integrations,
        [key]: value,
      },
    }));
  };

  const handleSave = () => {
    if (!selectedRecord) {
      toast.error(t("admin.settings.selectSacco", "Select a SACCO first."));
      return;
    }
    startTransition(async () => {
      const result = await updateTenantSettings({
        saccoId: selectedRecord.saccoId,
        settings: {
          rules: state.rules,
          feePolicy: state.feePolicy,
          kycThresholds: {
            enhanced: Number(state.enhancedThreshold) || 0,
            freeze: Number(state.freezeThreshold) || 0,
          },
          integrations: {
            webhook: state.integrations.webhook,
            edgeReconciliation: state.integrations.edgeReconciliation,
            notifications: state.integrations.notifications,
          },
        },
      });
      if (result.status === "error") {
        toast.error(result.message ?? t("common.operationFailed", "Operation failed"));
        return;
      }
      toast.success(result.message ?? t("common.saved", "Saved"));
    });
  };

  const disableInputs = !canEdit || pending;

  if (!selected) {
    return (
      <p className="text-sm text-neutral-2">
        <TransEmptyState />
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs uppercase tracking-[0.3em] text-neutral-3">
          {t("table.sacco", "SACCO")}
        </label>
        <select
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
          className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue"
        >
          {saccos.map((item) => (
            <option key={item.saccoId} value={item.saccoId}>
              {item.saccoName}
            </option>
          ))}
        </select>
        {state.updatedAt && (
          <span className="text-xs text-neutral-3">
            {t("admin.settings.lastUpdated", "Last updated")}:{" "}
            {new Date(state.updatedAt).toLocaleString()}
          </span>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.3em] text-neutral-3">
            {t("admin.settings.rules", "Tenant rules")}
          </span>
          <textarea
            value={state.rules}
            onChange={(event) => updateField("rules", event.target.value)}
            disabled={disableInputs}
            rows={6}
            placeholder={t(
              "admin.settings.rulesPlaceholder",
              "Document board-approved governance and guardrails."
            )}
            className="w-full rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue disabled:opacity-50"
          />
        </label>
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.3em] text-neutral-3">
            {t("admin.settings.fees", "Fee policy")}
          </span>
          <textarea
            value={state.feePolicy}
            onChange={(event) => updateField("feePolicy", event.target.value)}
            disabled={disableInputs}
            rows={6}
            placeholder={t(
              "admin.settings.feesPlaceholder",
              "Summarise joining, contribution, and penalty fees."
            )}
            className="w-full rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue disabled:opacity-50"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.3em] text-neutral-3">
            {t("admin.settings.kycEnhanced", "Enhanced review threshold (RWF)")}
          </span>
          <input
            type="number"
            value={state.enhancedThreshold}
            onChange={(event) => updateField("enhancedThreshold", Number(event.target.value))}
            disabled={disableInputs}
            className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue disabled:opacity-50"
          />
        </label>
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.3em] text-neutral-3">
            {t("admin.settings.kycFreeze", "Freeze threshold (RWF)")}
          </span>
          <input
            type="number"
            value={state.freezeThreshold}
            onChange={(event) => updateField("freezeThreshold", Number(event.target.value))}
            disabled={disableInputs}
            className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue disabled:opacity-50"
          />
        </label>
      </div>

      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.3em] text-neutral-3">
          {t("admin.settings.integrations", "Integrations")}
        </p>
        <IntegrationToggle
          label={t("admin.settings.integrations.webhook", "Webhook to core banking")}
          checked={state.integrations.webhook}
          onChange={(value) => updateIntegration("webhook", value)}
          disabled={disableInputs}
        />
        <IntegrationToggle
          label={t("admin.settings.integrations.edgeRecon", "Edge reconciliation automation")}
          checked={state.integrations.edgeReconciliation}
          onChange={(value) => updateIntegration("edgeReconciliation", value)}
          disabled={disableInputs}
        />
        <IntegrationToggle
          label={t("admin.settings.integrations.notifications", "Notification pipeline")}
          checked={state.integrations.notifications}
          onChange={(value) => updateIntegration("notifications", value)}
          disabled={disableInputs}
        />
      </div>

      {canEdit && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={pending}
            className="interactive-scale rounded-full bg-kigali px-6 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-ink shadow-glass disabled:opacity-60"
          >
            {pending ? t("common.saving", "Saving…") : t("common.save", "Save")}
          </button>
        </div>
      )}
    </div>
  );
}

function IntegrationToggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-neutral-0">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 rounded border-white/10 bg-white/10 accent-kigali disabled:opacity-50"
      />
    </label>
  );
}

function TransEmptyState() {
  const { t } = useTranslation();
  return <>{t("admin.settings.noSacco", "No SACCO is in scope for this profile.")}</>;
}
