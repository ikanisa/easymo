"use client";

import { useMemo, useState, useTransition } from "react";
import type { Database } from "@/lib/supabase/types";
import { upsertMomoCode, deleteMomoCode } from "@/app/(main)/admin/actions";
import { useToast } from "@/providers/toast-provider";
import { useTranslation } from "@/providers/i18n-provider";
import { cn } from "@/lib/utils";

type MomoCodeRow = Database["app"]["Tables"]["momo_codes"]["Row"];

type MomoCodeTableProps = {
  initialCodes: MomoCodeRow[];
  providerOptions?: string[];
  districtOptions: string[];
};

type MomoCodeFormState = {
  id?: string;
  provider: string;
  district: string;
  code: string;
  accountName?: string | null;
  description?: string | null;
};

const DEFAULT_PROVIDERS = ["MTN", "AIRTEL", "OTHER"];

export function MomoCodeTable({
  initialCodes,
  providerOptions,
  districtOptions,
}: MomoCodeTableProps) {
  const { t } = useTranslation();
  const { success, error } = useToast();
  const [codes, setCodes] = useState<MomoCodeRow[]>(initialCodes);
  const [editing, setEditing] = useState<MomoCodeFormState | null>(null);
  const [mode, setMode] = useState<"create" | "edit">("edit");
  const [search, setSearch] = useState("");
  const [pending, startTransition] = useTransition();

  const providers =
    providerOptions && providerOptions.length > 0 ? providerOptions : DEFAULT_PROVIDERS;

  const notifyError = (message: string) => error(message);
  const notifySuccess = (message: string) => success(message);

  const uniqueDistricts = useMemo(
    () => Array.from(new Set([...districtOptions, ...codes.map((code) => code.district)])),
    [codes, districtOptions]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return codes;
    const lowered = search.toLowerCase();
    return codes.filter((row) =>
      `${row.district} ${row.provider} ${row.code}`.toLowerCase().includes(lowered)
    );
  }, [codes, search]);

  const beginCreate = () => {
    setEditing({
      provider: providers[0] ?? "MTN",
      district: "",
      code: "",
      accountName: "",
      description: "",
    });
    setMode("create");
  };

  const beginEdit = (row: MomoCodeRow) => {
    setEditing({
      id: row.id,
      provider: row.provider,
      district: row.district,
      code: row.code,
      accountName: row.account_name ?? "",
      description: row.description ?? "",
    });
    setMode("edit");
  };

  const resetForm = () => {
    setEditing(null);
    setMode("edit");
  };

  const handleSave = () => {
    if (!editing) {
      notifyError(t("admin.momoCodes.noSelection", "Select a record to edit or create a new one."));
      return;
    }
    if (!editing.district.trim()) {
      notifyError(t("admin.momoCodes.districtRequired", "District is required."));
      return;
    }
    if (!editing.code.trim()) {
      notifyError(t("admin.momoCodes.codeRequired", "MoMo code is required."));
      return;
    }

    startTransition(async () => {
      const result = await upsertMomoCode({
        id: editing.id,
        provider: editing.provider,
        district: editing.district,
        code: editing.code,
        accountName: editing.accountName ?? null,
        description: editing.description ?? null,
      });

      if (result.status === "error") {
        notifyError(result.message ?? t("common.operationFailed", "Operation failed"));
        return;
      }

      if (result.record) {
        setCodes((prev) => {
          const index = prev.findIndex((row) => row.id === result.record?.id);
          if (index >= 0) {
            const copy = [...prev];
            copy[index] = result.record!;
            return copy;
          }
          return [...prev, result.record!];
        });
      }

      notifySuccess(
        mode === "create"
          ? t("admin.momoCodes.created", "MoMo code created.")
          : t("admin.momoCodes.updated", "MoMo code updated.")
      );
      resetForm();
    });
  };

  const handleDelete = (id: string) => {
    if (
      !confirm(t("admin.momoCodes.deleteConfirm", "Delete this MoMo code? This cannot be undone."))
    ) {
      return;
    }

    startTransition(async () => {
      const result = await deleteMomoCode({ id });
      if (result.status === "error") {
        notifyError(result.message ?? t("common.operationFailed", "Operation failed"));
        return;
      }

      setCodes((prev) => prev.filter((row) => row.id !== id));
      if (editing?.id === id) resetForm();
      notifySuccess(t("admin.momoCodes.deleted", "MoMo code removed."));
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("admin.momoCodes.searchPlaceholder", "Search by provider or district")}
            className="w-full max-w-xs rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue"
          />
          <button
            type="button"
            onClick={beginCreate}
            className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-neutral-0 transition hover:border-white/30"
          >
            {t("admin.momoCodes.new", "New MoMo code")}
          </button>
        </div>
        <p className="text-xs text-neutral-3">
          {`${codes.length} ${t("admin.momoCodes.totalSuffix", "codes configured")}`}
        </p>
      </div>

      <div className="overflow-hidden rounded-3xl border border-white/10">
        <table className="min-w-full divide-y divide-white/10 text-sm text-neutral-1">
          <thead className="bg-white/5 text-xs uppercase tracking-[0.3em] text-neutral-3">
            <tr>
              <th className="px-4 py-3 text-left">{t("admin.momoCodes.provider", "Provider")}</th>
              <th className="px-4 py-3 text-left">{t("common.district", "District")}</th>
              <th className="px-4 py-3 text-left">{t("admin.momoCodes.code", "Code")}</th>
              <th className="px-4 py-3 text-left">
                {t("admin.momoCodes.accountName", "Account name")}
              </th>
              <th className="px-4 py-3 text-right">{t("common.actions", "Actions")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-neutral-2">
                  {t("admin.momoCodes.empty", "No MoMo codes found. Create one to get started.")}
                </td>
              </tr>
            ) : (
              filtered
                .sort((a, b) => a.district.localeCompare(b.district))
                .map((row) => (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-b border-white/5",
                      editing?.id === row.id && "bg-white/8"
                    )}
                  >
                    <td className="px-4 py-3 font-medium text-neutral-0">{row.provider}</td>
                    <td className="px-4 py-3 text-neutral-1">{row.district}</td>
                    <td className="px-4 py-3 text-neutral-1">{row.code}</td>
                    <td className="px-4 py-3 text-neutral-1">
                      {row.account_name ?? t("common.none", "None")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => beginEdit(row)}
                        className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-neutral-0 transition hover:border-white/30"
                      >
                        {t("common.edit", "Edit")}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(row.id)}
                        className="ml-3 rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-red-200 transition hover:border-white/30"
                      >
                        {t("common.delete", "Delete")}
                      </button>
                    </td>
                  </tr>
                ))
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-neutral-0">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              {mode === "create"
                ? t("admin.momoCodes.createTitle", "Create MoMo code")
                : t("admin.momoCodes.editTitle", "Edit MoMo code")}
            </h3>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-full border border-white/15 px-3 py-1 text-xs uppercase tracking-[0.25em] text-neutral-0 transition hover:border-white/30"
            >
              {t("common.cancel", "Cancel")}
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">
                {t("admin.momoCodes.provider", "Provider")}
              </span>
              <select
                className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue"
                value={editing.provider}
                onChange={(event) =>
                  setEditing((prev) => (prev ? { ...prev, provider: event.target.value } : prev))
                }
              >
                {providers.map((provider) => (
                  <option key={provider} value={provider}>
                    {provider.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">
                {t("common.district", "District")}
              </span>
              <input
                list="momo-code-districts"
                className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue"
                value={editing.district}
                onChange={(event) =>
                  setEditing((prev) => (prev ? { ...prev, district: event.target.value } : prev))
                }
              />
              <datalist id="momo-code-districts">
                {uniqueDistricts.map((district) => (
                  <option key={district} value={district} />
                ))}
              </datalist>
            </label>

            <label className="space-y-1 md:col-span-2">
              <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">
                {t("admin.momoCodes.code", "Code")}
              </span>
              <input
                className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue"
                value={editing.code}
                onChange={(event) =>
                  setEditing((prev) => (prev ? { ...prev, code: event.target.value } : prev))
                }
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">
                {t("admin.momoCodes.accountName", "Account name")}
              </span>
              <input
                className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue"
                value={editing.accountName ?? ""}
                onChange={(event) =>
                  setEditing((prev) => (prev ? { ...prev, accountName: event.target.value } : prev))
                }
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">
                {t("common.description", "Description")}
              </span>
              <textarea
                className="h-20 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue"
                value={editing.description ?? ""}
                onChange={(event) =>
                  setEditing((prev) => (prev ? { ...prev, description: event.target.value } : prev))
                }
              />
            </label>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={pending}
              className="rounded-full bg-kigali px-4 py-2 text-sm font-semibold uppercase tracking-[0.3em] text-ink shadow-glass disabled:opacity-60"
            >
              {pending ? t("common.saving", "Saving…") : t("common.save", "Save")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
