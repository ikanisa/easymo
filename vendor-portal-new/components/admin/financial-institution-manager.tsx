"use client";

import { useMemo, useState, useTransition } from "react";
import { upsertFinancialInstitution, deleteFinancialInstitution } from "@/app/(main)/admin/actions";
import type { Database } from "@/lib/supabase/types";
import { useToast } from "@/providers/toast-provider";
import { useTranslation } from "@/providers/i18n-provider";
import {
  SaccoSearchCombobox,
  type SaccoSearchResult,
} from "@/components/saccos/sacco-search-combobox";
import { cn } from "@/lib/utils";

type FinancialInstitutionRow = Database["app"]["Tables"]["financial_institutions"]["Row"];

type FinancialInstitutionManagerProps = {
  initialInstitutions: FinancialInstitutionRow[];
  saccoOptions: SaccoSearchResult[];
  districtOptions: string[];
};

type InstitutionFormState = {
  id?: string;
  name: string;
  kind: Database["app"]["Enums"]["financial_institution_kind"];
  district: string;
  sacco: SaccoSearchResult | null;
};

const KIND_OPTIONS: Database["app"]["Enums"]["financial_institution_kind"][] = [
  "SACCO",
  "MICROFINANCE",
  "INSURANCE",
  "OTHER",
];

export function FinancialInstitutionManager({
  initialInstitutions,
  saccoOptions,
  districtOptions,
}: FinancialInstitutionManagerProps) {
  const { t } = useTranslation();
  const { success, error } = useToast();
  const [institutions, setInstitutions] = useState<FinancialInstitutionRow[]>(initialInstitutions);
  const [searchTerm, setSearchTerm] = useState("");
  const [editing, setEditing] = useState<InstitutionFormState | null>(null);
  const [mode, setMode] = useState<"create" | "edit">("edit");
  const [pending, startTransition] = useTransition();

  const notifyError = (message: string) => error(message);
  const notifySuccess = (message: string) => success(message);

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return institutions;
    const lowered = searchTerm.toLowerCase();
    return institutions.filter((institution) =>
      `${institution.name} ${institution.district} ${institution.kind}`
        .toLowerCase()
        .includes(lowered)
    );
  }, [institutions, searchTerm]);

  const districtSuggestions = useMemo(
    () => Array.from(new Set([...districtOptions, ...institutions.map((inst) => inst.district)])),
    [districtOptions, institutions]
  );

  const findSaccoOption = (id: string | null) =>
    saccoOptions.find((option) => option.id === id) ?? null;

  const beginCreate = () => {
    setEditing({
      id: undefined,
      name: "",
      district: "",
      kind: "SACCO",
      sacco: null,
    });
    setMode("create");
  };

  const beginEdit = (row: FinancialInstitutionRow) => {
    setEditing({
      id: row.id,
      name: row.name,
      district: row.district,
      kind: row.kind,
      sacco: findSaccoOption(row.sacco_id),
    });
    setMode("edit");
  };

  const resetForm = () => {
    setEditing(null);
    setMode("edit");
  };

  const handleSave = () => {
    if (!editing) {
      notifyError(t("admin.financialInstitutions.noSelection", "Select or create a record first."));
      return;
    }
    if (!editing.name.trim()) {
      notifyError(t("admin.financialInstitutions.nameRequired", "Institution name is required."));
      return;
    }
    if (!editing.district.trim()) {
      notifyError(t("admin.financialInstitutions.districtRequired", "District is required."));
      return;
    }

    startTransition(async () => {
      const result = await upsertFinancialInstitution({
        id: editing.id,
        name: editing.name,
        district: editing.district,
        kind: editing.kind,
        saccoId: editing.sacco?.id ?? null,
      });

      if (result.status === "error") {
        notifyError(result.message ?? t("common.operationFailed", "Operation failed"));
        return;
      }

      if (result.record) {
        setInstitutions((prev) => {
          const existingIndex = prev.findIndex((inst) => inst.id === result.record?.id);
          if (existingIndex >= 0) {
            const copy = [...prev];
            copy[existingIndex] = result.record!;
            return copy;
          }
          return [...prev, result.record!];
        });
      }

      notifySuccess(
        mode === "create"
          ? t("admin.financialInstitutions.created", "Financial institution created.")
          : t("admin.financialInstitutions.updated", "Financial institution updated.")
      );
      resetForm();
    });
  };

  const handleDelete = (id: string) => {
    if (
      !confirm(
        t(
          "admin.financialInstitutions.deleteConfirm",
          "Delete this institution? This cannot be undone."
        )
      )
    ) {
      return;
    }

    startTransition(async () => {
      const result = await deleteFinancialInstitution({ id });
      if (result.status === "error") {
        notifyError(result.message ?? t("common.operationFailed", "Operation failed"));
        return;
      }

      setInstitutions((prev) => prev.filter((inst) => inst.id !== id));
      if (editing?.id === id) resetForm();
      notifySuccess(t("admin.financialInstitutions.deleted", "Financial institution removed."));
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder={t(
              "admin.financialInstitutions.searchPlaceholder",
              "Search by name or district"
            )}
            className="w-full max-w-xs rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue"
          />
          <button
            type="button"
            onClick={beginCreate}
            className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-neutral-0 transition hover:border-white/30"
          >
            {t("admin.financialInstitutions.new", "New institution")}
          </button>
        </div>
        <p className="text-xs text-neutral-3">
          {`${institutions.length} ${t("admin.financialInstitutions.totalSuffix", "institutions total")}`}
        </p>
      </div>

      <div className="overflow-hidden rounded-3xl border border-white/10">
        <table className="min-w-full divide-y divide-white/10 text-sm text-neutral-1">
          <thead className="bg-white/5 text-xs uppercase tracking-[0.3em] text-neutral-3">
            <tr>
              <th className="px-4 py-3 text-left">{t("common.name", "Name")}</th>
              <th className="px-4 py-3 text-left">
                {t("admin.financialInstitutions.kind", "Type")}
              </th>
              <th className="px-4 py-3 text-left">{t("common.district", "District")}</th>
              <th className="px-4 py-3 text-left">
                {t("admin.financialInstitutions.linkedSacco", "Linked SACCO")}
              </th>
              <th className="px-4 py-3 text-right">{t("common.actions", "Actions")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-neutral-2">
                  {t(
                    "admin.financialInstitutions.empty",
                    "No institutions found. Create one to get started."
                  )}
                </td>
              </tr>
            ) : (
              filtered.map((institution) => (
                <tr
                  key={institution.id}
                  className={cn(
                    "border-b border-white/5",
                    editing?.id === institution.id && "bg-white/8"
                  )}
                >
                  <td className="px-4 py-3 font-medium text-neutral-0">{institution.name}</td>
                  <td className="px-4 py-3 capitalize text-neutral-1">
                    {institution.kind.toLowerCase()}
                  </td>
                  <td className="px-4 py-3 text-neutral-1">{institution.district}</td>
                  <td className="px-4 py-3 text-neutral-1">
                    {findSaccoOption(institution.sacco_id)?.name ?? t("common.none", "None")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => beginEdit(institution)}
                      className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-neutral-0 transition hover:border-white/30"
                    >
                      {t("common.edit", "Edit")}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(institution.id)}
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
                ? t("admin.financialInstitutions.createTitle", "Create financial institution")
                : t("admin.financialInstitutions.editTitle", "Edit financial institution")}
            </h3>
            <button
              type="button"
              className="rounded-full border border-white/15 px-3 py-1 text-xs uppercase tracking-[0.25em] text-neutral-0 transition hover:border-white/30"
              onClick={resetForm}
            >
              {t("common.cancel", "Cancel")}
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">
                {t("common.name", "Name")}
              </span>
              <input
                className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue"
                value={editing.name}
                onChange={(event) =>
                  setEditing((prev) => (prev ? { ...prev, name: event.target.value } : prev))
                }
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">
                {t("admin.financialInstitutions.kind", "Type")}
              </span>
              <select
                className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue"
                value={editing.kind}
                onChange={(event) =>
                  setEditing((prev) =>
                    prev
                      ? { ...prev, kind: event.target.value as (typeof KIND_OPTIONS)[number] }
                      : prev
                  )
                }
              >
                {KIND_OPTIONS.map((kind) => (
                  <option key={kind} value={kind}>
                    {kind.toLowerCase()}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 md:col-span-2">
              <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">
                {t("common.district", "District")}
              </span>
              <input
                list="financial-institution-districts"
                className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue"
                value={editing.district}
                onChange={(event) =>
                  setEditing((prev) => (prev ? { ...prev, district: event.target.value } : prev))
                }
              />
              <datalist id="financial-institution-districts">
                {districtSuggestions.map((district) => (
                  <option key={district} value={district} />
                ))}
              </datalist>
            </label>

            <div className="md:col-span-2 space-y-2">
              <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">
                {t("admin.financialInstitutions.linkedSacco", "Linked SACCO (optional)")}
              </span>
              <SaccoSearchCombobox
                value={editing.sacco}
                onChange={(value) =>
                  setEditing((prev) => (prev ? { ...prev, sacco: value } : prev))
                }
                placeholder={t("admin.financialInstitutions.saccoPlaceholder", "Search SACCO")}
              />
            </div>
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
