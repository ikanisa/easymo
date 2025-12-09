"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import { useToast } from "@/providers/toast-provider";
import { useTranslation } from "@/providers/i18n-provider";
import {
  queueNotification,
  createSmsTemplate,
  setSmsTemplateActive,
  deleteSmsTemplate,
} from "@/app/(main)/admin/actions";

const supabase = getSupabaseBrowserClient();

const TOKEN_LIBRARY = [
  { token: "{member_name}", primary: "Member name", secondary: "Izina ry'umunyamuryango" },
  { token: "{amount}", primary: "Amount", secondary: "Amafaranga" },
  { token: "{ikimina_name}", primary: "Ikimina", secondary: "Izina ry'ikimina" },
  { token: "{sacco_name}", primary: "SACCO", secondary: "Izina rya SACCO" },
  { token: "{due_date}", primary: "Due date", secondary: "Itariki yo kwishyura" },
  { token: "{reference}", primary: "Reference", secondary: "Indango" },
];

type SaccoOption = {
  id: string;
  name: string;
};

type TemplateRow = Database["public"]["Tables"]["sms_templates"]["Row"];

type SmsTemplatePanelProps = {
  saccos: SaccoOption[];
};

export function SmsTemplatePanel({ saccos }: SmsTemplatePanelProps) {
  const { t } = useTranslation();
  const [selectedSacco, setSelectedSacco] = useState<string | null>(saccos[0]?.id ?? null);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [description, setDescription] = useState("");
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const notifySuccess = (msg: string) => toast.success(msg);
  const notifyError = (msg: string) => toast.error(msg);

  const selectedSaccoName = useMemo(
    () => saccos.find((sacco) => sacco.id === selectedSacco)?.name ?? "",
    [saccos, selectedSacco]
  );

  useEffect(() => {
    if (!selectedSacco) {
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error: fetchError } = await supabase
        .from("sms_templates")
        .select(
          "id, name, body, is_active, sacco_id, created_at, updated_at, version, tokens, description"
        )
        .eq("sacco_id", selectedSacco)
        .order("updated_at", { ascending: false });
      if (cancelled) return;
      if (fetchError) {
        toast.error(
          fetchError.message ?? t("admin.templates.loadFailed", "Failed to load templates")
        );
        return;
      }
      setTemplates((prev) => {
        const next = data ?? [];
        if (JSON.stringify(prev) === JSON.stringify(next)) {
          return prev;
        }
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedSacco, toast, t]);

  const resetForm = () => {
    setName("");
    setBody("");
    setDescription("");
  };

  const extractTokens = (value: string) => {
    const matches = value.match(/\{[a-zA-Z0-9_]+\}/g) ?? [];
    return Array.from(new Set(matches));
  };

  const handleCreate = () => {
    if (!selectedSacco)
      return notifyError(t("admin.templates.selectSacco", "Select a SACCO first"));
    if (!name.trim())
      return notifyError(t("admin.templates.nameRequired", "Template name is required"));
    if (!body.trim())
      return notifyError(t("admin.templates.bodyRequired", "Template body is required"));

    startTransition(async () => {
      const tokens = extractTokens(body.trim());
      const result = await createSmsTemplate({
        saccoId: selectedSacco as string,
        name,
        body,
        description,
        tokens,
      });
      if (result.status === "error")
        return notifyError(
          result.message ?? t("admin.templates.createFailed", "Failed to create template")
        );
      if (result.template) setTemplates((prev) => [result.template as TemplateRow, ...prev]);
      notifySuccess(t("admin.templates.created", "Template created"));
      resetForm();
    });
  };

  const handleToggleActive = (template: TemplateRow) => {
    startTransition(async () => {
      const result = await setSmsTemplateActive({
        templateId: template.id,
        isActive: !template.is_active,
      });
      if (result.status === "error")
        return notifyError(
          result.message ?? t("admin.templates.updateFailed", "Failed to update template")
        );
      setTemplates((prev) =>
        prev.map((item) =>
          item.id === template.id
            ? { ...item, is_active: !template.is_active, updated_at: new Date().toISOString() }
            : item
        )
      );
      notifySuccess(
        template.is_active
          ? t("admin.templates.deactivated", "Template deactivated")
          : t("admin.templates.activated", "Template activated")
      );
    });
  };

  const handleDelete = (templateId: string) => {
    if (!confirm(t("admin.templates.deleteConfirm", "Delete this template?"))) return;
    startTransition(async () => {
      const result = await deleteSmsTemplate({ templateId });
      if (result.status === "error")
        return notifyError(
          result.message ?? t("admin.templates.deleteFailed", "Failed to delete template")
        );
      setTemplates((prev) => prev.filter((item) => item.id !== templateId));
      notifySuccess(t("admin.templates.deleted", "Template deleted"));
    });
  };

  const handleNewVersion = (template: TemplateRow) => {
    startTransition(async () => {
      const tokens = Array.isArray(template.tokens)
        ? template.tokens
        : extractTokens(template.body);
      const payload: Database["public"]["Tables"]["sms_templates"]["Insert"] = {
        sacco_id: template.sacco_id,
        name: template.name,
        body: template.body,
        description: template.description,
        tokens,
        version: (template.version ?? 1) + 1,
        is_active: false,
      };

      const { data, error: insertError } = await (supabase as any)
        .from("sms_templates")
        .insert(payload)
        .select(
          "id, name, body, is_active, sacco_id, created_at, updated_at, version, tokens, description"
        )
        .single();
      if (insertError) {
        notifyError(
          insertError.message ??
            t("admin.templates.newVersionFailed", "Failed to create new version")
        );
        return;
      }
      setTemplates((prev) => [data as TemplateRow, ...prev]);
      notifySuccess(t("admin.templates.newVersionDrafted", "New version drafted"));
    });
  };

  const handleQueueTest = (template: TemplateRow) => {
    if (!template.sacco_id) {
      notifyError(t("admin.templates.noSacco", "Template is missing SACCO"));
      return;
    }
    startTransition(async () => {
      const recipient = window.prompt(
        t("admin.templates.testRecipientPrompt", "Enter WhatsApp number for the test send")
      );
      if (recipient === null) {
        return;
      }
      const trimmed = recipient.trim();
      if (!trimmed) {
        notifyError(t("admin.templates.recipientRequired", "Recipient number is required"));
        return;
      }
      const result = await queueNotification({
        saccoId: template.sacco_id as string,
        templateId: template.id,
        testMsisdn: trimmed,
      });
      if (result.status === "error") {
        notifyError(result.message ?? t("admin.templates.testQueueFailed", "Failed to queue test"));
      } else {
        notifySuccess(result.message ?? t("admin.templates.testQueued", "Test queued"));
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs uppercase tracking-[0.3em] text-neutral-2">
          {t("table.sacco", "SACCO")}
        </label>
        <select
          value={selectedSacco ?? ""}
          onChange={(event) => {
            const value = event.target.value || null;
            setSelectedSacco(value);
            if (!value) {
              setTemplates([]);
            }
          }}
          className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue"
        >
          {saccos.map((sacco) => (
            <option key={sacco.id} value={sacco.id}>
              {sacco.name}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-2">
          {t("admin.templates.create", "Create template")}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">
              {t("table.name", "Name")}
            </span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("admin.templates.namePlaceholder", "Payment reminder")}
              className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue"
            />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">
              {t("admin.templates.bodyLabel", "Body")}
            </span>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={4}
              placeholder={t(
                "admin.templates.bodyPlaceholder",
                "Hello {member_name}, this is your reminder for this month…"
              )}
              className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue"
            />
            <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-neutral-2">
              {TOKEN_LIBRARY.map((token) => (
                <button
                  key={token.token}
                  type="button"
                  onClick={() =>
                    setBody(
                      (prev) =>
                        `${prev}${prev.endsWith(" ") || prev.length === 0 ? "" : " "}${token.token}`
                    )
                  }
                  className="rounded-full border border-white/15 px-2 py-1 text-neutral-0 hover:border-white/30"
                >
                  <span className="text-[9px] text-neutral-3">{token.primary}</span>
                </button>
              ))}
            </div>
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">
              {t("admin.templates.description", "Description")}
            </span>
            <input
              type="text"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t(
                "admin.templates.descriptionPlaceholder",
                "Reminder for weekly contributions"
              )}
              className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue"
            />
          </label>
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={handleCreate}
            disabled={pending || !selectedSacco}
            className="interactive-scale rounded-full bg-kigali px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-ink shadow-glass disabled:opacity-60"
          >
            {pending
              ? t("common.saving", "Saving…")
              : t("admin.templates.create", "Create template")}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.3em] text-neutral-2">
          {templates.length} {t("admin.templates.count", "template(s)")}{" "}
          {t("admin.templates.for", "for")} {selectedSaccoName}
        </p>
        {templates.length === 0 && (
          <p className="text-sm text-neutral-2">
            {t("admin.templates.empty", "No templates yet. Create one above to get started.")}
          </p>
        )}
        <div className="space-y-3">
          {templates.map((template) => (
            <div
              key={template.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-neutral-0"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-base font-semibold">{template.name}</h4>
                  <p className="text-[11px] text-neutral-2">
                    {t("common.version", "Version")}: {template.version ?? 1} ·{" "}
                    {t("common.updated", "Updated")}:{" "}
                    {new Date(template.updated_at).toLocaleString()}
                  </p>
                  {template.description && (
                    <p className="text-[11px] text-neutral-2">{template.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleActive(template)}
                    className="text-xs text-neutral-2 underline-offset-2 hover:underline"
                  >
                    {template.is_active
                      ? t("admin.templates.deactivate", "Deactivate")
                      : t("admin.templates.activate", "Activate")}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNewVersion(template)}
                    className="text-xs text-neutral-2 underline-offset-2 hover:underline"
                  >
                    {t("admin.templates.newVersion", "New version")}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(template.id)}
                    className="text-xs text-red-300 underline-offset-2 hover:underline"
                  >
                    {t("common.delete", "Delete")}
                  </button>
                </div>
              </div>
              <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-black/30 p-3 text-sm text-neutral-0">
                {template.body}
              </pre>
              <p className="mt-2 text-[10px] text-neutral-2">
                {t("table.status", "Status")}:{" "}
                {template.is_active
                  ? t("common.active", "Active")
                  : t("common.inactive", "Inactive")}
              </p>
              <div className="mt-2 flex flex-wrap gap-1 text-[10px] text-neutral-3">
                {(Array.isArray(template.tokens)
                  ? template.tokens
                  : extractTokens(template.body)
                ).map((token) => {
                  const tokenText = typeof token === "string" ? token : JSON.stringify(token);
                  return (
                    <span
                      key={`${template.id}-${tokenText}`}
                      className="rounded-full bg-white/10 px-2 py-1"
                    >
                      {tokenText}
                    </span>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleQueueTest(template)}
                  className="rounded-full border border-white/15 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-neutral-0 hover:border-white/30"
                >
                  {t("admin.templates.sendTest", "Send test SMS")}
                </button>
                <span className="text-[10px] text-neutral-3">
                  {t("admin.templates.queueHint", "Queues an event in notification pipeline")}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
