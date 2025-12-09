"use client";

import { useMemo, useState, useTransition } from "react";
import { useToast } from "@/providers/toast-provider";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/providers/i18n-provider";
import { upsertSacco, removeSacco } from "@/app/(main)/admin/actions";
import type { Database } from "@/lib/supabase/types";

type RawSaccoRow = Pick<
  Database["app"]["Tables"]["saccos"]["Row"],
  | "id"
  | "name"
  | "district"
  | "province"
  | "sector"
  | "status"
  | "email"
  | "category"
  | "logo_url"
  | "sector_code"
  | "district_org_id"
>;

type SaccoRow = {
  id: string;
  name: string;
  district: string;
  province: string;
  sector: string;
  status: string;
  email: string | null;
  category: string;
  logo_url: string | null;
  sector_code: string;
  district_org_id: string | null;
};

const normalizeSacco = (row: RawSaccoRow): SaccoRow => ({
  id: row.id,
  name: row.name,
  district: row.district ?? "",
  province: row.province ?? "",
  sector: row.sector ?? "",
  status: row.status ?? "ACTIVE",
  email: row.email ?? null,
  category: row.category ?? DEFAULT_CATEGORY,
  logo_url: row.logo_url ?? null,
  sector_code: row.sector_code ?? "",
  district_org_id: row.district_org_id ?? null,
});

type DistrictMomoInfo = {
  code: string;
  provider: string;
  account_name: string | null;
};

type SaccoRegistryManagerProps = {
  initialSaccos: RawSaccoRow[];
  districtMomoMap?: Record<string, DistrictMomoInfo>;
};

type SaccoFormState = SaccoRow;

const PROVINCES = [
  "CITY OF KIGALI",
  "NORTHERN PROVINCE",
  "SOUTHERN PROVINCE",
  "EASTERN PROVINCE",
  "WESTERN PROVINCE",
];

const STATUS_OPTIONS: SaccoRow["status"][] = ["ACTIVE", "SUSPENDED", "INACTIVE"];

function buildSectorCode(district: string, sector: string) {
  const raw = `${district}-${sector}`.toUpperCase().replace(/[^A-Z0-9]+/g, "-");
  return raw.replace(/^-+|-+$/g, "");
}

//

const DEFAULT_CATEGORY = "Deposit-Taking Microfinance Cooperative (UMURENGE SACCO)";

export function SaccoRegistryManager({
  initialSaccos,
  districtMomoMap = {},
}: SaccoRegistryManagerProps) {
  const { t } = useTranslation();
  const [saccos, setSaccos] = useState<SaccoRow[]>(() => initialSaccos.map(normalizeSacco));
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<SaccoFormState | null>(null);
  const [mode, setMode] = useState<"edit" | "create">("edit");
  const [pending, startTransition] = useTransition();
  const { success, error } = useToast();

  const notifySuccess = (msg: string) => success(msg);
  const notifyError = (msg: string) => error(msg);

  const filtered = useMemo(() => {
    if (!search.trim()) return saccos;
    const lowered = search.toLowerCase();
    return saccos.filter((sacco) =>
      `${sacco.name} ${sacco.district} ${sacco.province} ${sacco.category ?? ""}`
        .toLowerCase()
        .includes(lowered)
    );
  }, [saccos, search]);

  const resetForm = () => {
    setEditing(null);
    setMode("edit");
  };

  const handleEdit = (sacco: SaccoRow) => {
    setEditing({
      ...sacco,
      category: sacco.category || DEFAULT_CATEGORY,
      email: sacco.email ?? "",
      logo_url: sacco.logo_url ?? null,
      district: sacco.district ?? "",
      province: sacco.province ?? "",
      sector: sacco.sector ?? "",
      sector_code: buildSectorCode(sacco.district ?? "", sacco.sector ?? ""),
      district_org_id: sacco.district_org_id ?? null,
    });
    setMode("edit");
  };

  const handleCreate = () => {
    setEditing({
      id: "",
      name: "",
      district: "",
      province: PROVINCES[0],
      sector: "",
      status: "ACTIVE",
      email: "",
      category: DEFAULT_CATEGORY,
      logo_url: null,
      sector_code: "",
      district_org_id: null,
    });
    setMode("create");
  };

  const handleChange = <K extends keyof SaccoFormState>(key: K, value: SaccoFormState[K]) => {
    setEditing((current) => {
      if (!current) return current;
      const nextValue = value === undefined ? ("" as SaccoFormState[K]) : value;
      return { ...current, [key]: nextValue };
    });
  };

  const validateForm = (state: SaccoFormState | null) => {
    if (!state) return t("admin.registry.noRecord", "No record selected");
    if (!state.name.trim()) return t("admin.registry.nameRequired", "Name is required");
    if (!state.district.trim()) return t("admin.registry.districtRequired", "District is required");
    if (!state.sector.trim()) return t("admin.registry.sectorRequired", "Sector is required");
    if (!state.province.trim()) return t("admin.registry.provinceRequired", "Province is required");
    return null;
  };

  const handleSubmit = () => {
    const message = validateForm(editing);
    if (message) {
      error(message);
      return;
    }
    if (!editing) return;
    const sectorCode = buildSectorCode(editing.district, editing.sector);

    startTransition(async () => {
      const basePayload = {
        name: editing.name.trim(),
        district: editing.district.trim().toUpperCase(),
        province: editing.province.trim().toUpperCase(),
        sector: editing.sector.trim().toUpperCase(),
        sector_code: sectorCode,
        category: (editing.category || DEFAULT_CATEGORY).trim(),
        status: editing.status,
        email: editing.email?.trim() ? editing.email.trim() : null,
        logo_url: editing.logo_url ?? null,
        district_org_id: editing.district_org_id ?? null,
      } as Database["app"]["Tables"]["saccos"]["Insert"];

      const result = await upsertSacco({
        mode: mode === "create" ? "create" : "update",
        // id is present in update mode
        sacco:
          mode === "create"
            ? basePayload
            : ({
                ...basePayload,
                id: editing.id,
              } as unknown as Database["app"]["Tables"]["saccos"]["Update"] & { id: string }),
      });
      if (result.status === "error") {
        notifyError(result.message ?? t("common.operationFailed", "Operation failed"));
        return;
      }
      if (result.sacco) {
        const normalized = normalizeSacco(result.sacco as RawSaccoRow);
        setSaccos((prev) =>
          mode === "create"
            ? [...prev, normalized]
            : prev.map((s) => (s.id === editing.id ? normalized : s))
        );
      }
      notifySuccess(
        mode === "create"
          ? t("admin.registry.created", "SACCO created")
          : t("admin.registry.updated", "SACCO updated")
      );
      resetForm();
    });
  };

  const handleDelete = (saccoId: string) => {
    if (!confirm(t("admin.registry.deleteConfirm", "Delete this SACCO? This cannot be undone.")))
      return;
    startTransition(async () => {
      const result = await removeSacco({ id: saccoId });
      if (result.status === "error") {
        notifyError(result.message ?? t("admin.registry.deleteFailed", "Failed to delete SACCO"));
        return;
      }
      setSaccos((prev) => prev.filter((s) => s.id !== saccoId));
      notifySuccess(t("admin.registry.deleted", "SACCO deleted"));
      if (editing?.id === saccoId) resetForm();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("admin.registry.searchPlaceholder", "Search name, district")}
          className="w-full max-w-xs rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue"
        />
        <button
          type="button"
          onClick={handleCreate}
          className="interactive-scale rounded-full bg-kigali px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-ink shadow-glass"
        >
          {t("admin.registry.new", "New SACCO")}
        </button>
      </div>

      <div className="max-h-80 overflow-y-auto rounded-2xl border border-white/10">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.2em] text-neutral-2">
            <tr>
              <th className="px-4 py-3">{t("table.name", "Name")}</th>
              <th className="px-4 py-3">{t("table.district", "District")}</th>
              <th className="px-4 py-3">{t("table.province", "Province")}</th>
              <th className="px-4 py-3">{t("table.status", "Status")}</th>
              <th className="px-4 py-3">{t("admin.registry.momoCode", "MoMo code")}</th>
              <th className="px-4 py-3 text-right">{t("table.actions", "Actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.map((sacco) => (
              <tr key={sacco.id} className="hover:bg-white/5">
                <td className="px-4 py-3 font-medium text-neutral-0">{sacco.name}</td>
                <td className="px-4 py-3 text-neutral-2">{sacco.district}</td>
                <td className="px-4 py-3 text-neutral-2">{sacco.province}</td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "rounded-full px-2 py-1 text-[11px] uppercase tracking-[0.2em]",
                      sacco.status === "ACTIVE"
                        ? "bg-emerald-500/20 text-emerald-200"
                        : "bg-amber-500/20 text-amber-200"
                    )}
                  >
                    {sacco.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-neutral-2">
                  {(() => {
                    const districtKey = sacco.district?.toUpperCase() ?? "";
                    const info = districtMomoMap[districtKey];
                    if (!info) return t("common.notSet", "Not set");
                    return `${info.code}${info.provider ? ` · ${info.provider}` : ""}`;
                  })()}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => handleEdit(sacco)}
                      className="text-xs text-neutral-2 underline-offset-2 hover:underline"
                    >
                      {t("common.edit", "Edit")}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(sacco.id)}
                      className="text-xs text-red-300 underline-offset-2 hover:underline"
                    >
                      {t("common.delete", "Delete")}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-neutral-2">
                  {t("admin.registry.none", "No SACCOs match this search.")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-neutral-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-neutral-2">
                {mode === "create"
                  ? t("admin.registry.createTitle", "Create SACCO")
                  : t("admin.registry.editTitle", "Edit SACCO")}
              </p>
              <h3 className="text-lg font-semibold">
                {editing.name || t("admin.registry.new", "New SACCO")}
              </h3>
            </div>
            <button
              type="button"
              onClick={resetForm}
              className="text-xs text-neutral-2 underline-offset-2 hover:underline"
            >
              {t("common.close", "Close")}
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">
                {t("table.name", "Name")}
              </span>
              <input
                type="text"
                value={editing.name}
                onChange={(event) => handleChange("name", event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">
                {t("table.province", "Province")}
              </span>
              <select
                value={editing.province}
                onChange={(event) => handleChange("province", event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue"
              >
                {PROVINCES.map((province) => (
                  <option key={province} value={province}>
                    {province}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">
                {t("table.district", "District")}
              </span>
              <input
                type="text"
                value={editing.district}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  handleChange("district", nextValue);
                  setEditing((current) =>
                    current ? { ...current, district_org_id: null } : current
                  );
                }}
                className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue"
                placeholder={t("admin.registry.districtHelper", "ex: Kicukiro")}
              />
              <p className="text-[11px] text-neutral-3">
                {t(
                  "admin.registry.districtHelperText",
                  "We auto-link the hidden District org for RLS when you save."
                )}
              </p>
            </label>
            <label className="space-y-1">
              <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">
                {t("table.sector", "Sector")}
              </span>
              <input
                type="text"
                value={editing.sector}
                onChange={(event) => handleChange("sector", event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">
                {t("table.status", "Status")}
              </span>
              <select
                value={editing.status}
                onChange={(event) =>
                  handleChange("status", event.target.value as SaccoRow["status"])
                }
                className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue"
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">
                {t("common.email", "Email")}
              </span>
              <input
                type="email"
                value={editing.email ?? ""}
                onChange={(event) => handleChange("email", event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue"
              />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">
                {t("admin.registry.category", "Category")}
              </span>
              <input
                type="text"
                value={editing.category}
                onChange={(event) => handleChange("category", event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue"
              />
            </label>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-neutral-2">
            {(() => {
              const info = districtMomoMap[editing.district?.toUpperCase() ?? ""];
              if (!info) {
                return (
                  <p>
                    {t(
                      "admin.registry.momoInfoMissing",
                      "No MoMo code configured for this district. Update the MoMo codes table to surface it here."
                    )}
                  </p>
                );
              }

              return (
                <p>
                  <span className="font-semibold text-neutral-0">{info.code}</span>{" "}
                  {info.provider && <span>· {info.provider}</span>}
                  {info.account_name && <span className="ml-2">({info.account_name})</span>}
                </p>
              );
            })()}
          </div>

          <div className="mt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={resetForm}
              className="rounded-full border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-neutral-2"
            >
              {t("common.cancel", "Cancel")}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={pending}
              className="interactive-scale rounded-full bg-kigali px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-ink shadow-glass disabled:opacity-60"
            >
              {pending
                ? t("common.saving", "Saving…")
                : mode === "create"
                  ? t("common.create", "Create")
                  : t("common.save", "Save")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
