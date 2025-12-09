"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import { useToast } from "@/providers/toast-provider";
import { useConfirmDialog } from "@/providers/confirm-provider";
import {
  DEFAULT_MEMBER_MASKS,
  getMaskOptions,
  processRow,
  type ProcessedCell,
  type ProcessedRow,
} from "@/lib/imports/validation";
import { parseTabularFile } from "@/lib/imports/file-parser";
import { Skeleton } from "@/components/ui/skeleton";
import { Modal } from "@/components/ui/modal";
// BilingualText removed; using t()
import { useTranslation } from "@/providers/i18n-provider";

const REQUIRED_FIELDS = [
  { key: "full_name", label: "Full name", hint: "Umuntu nyir'ikimina" },
  { key: "msisdn", label: "MSISDN", hint: "07########" },
  { key: "member_code", label: "Member code", hint: "Optional unique code" },
] as const satisfies ReadonlyArray<{
  key: "full_name" | "msisdn" | "member_code";
  label: string;
  hint: string;
}>;

const supabase = getSupabaseBrowserClient();

type CsvRow = Record<string, string | null>;

type Mapping = Record<string, string>;

interface MemberImportWizardProps {
  ikiminaId: string;
  saccoId: string | null;
}

export function MemberImportWizard({ ikiminaId, saccoId }: MemberImportWizardProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [masks, setMasks] = useState(() => ({ ...DEFAULT_MEMBER_MASKS }));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [presetAvailable, setPresetAvailable] = useState(false);
  const [pending, startTransition] = useTransition();
  const { success, error: toastError } = useToast();

  const notifyError = (messageEn: string) => {
    toastError(messageEn);
  };

  const notifySuccess = (messageEn: string) => {
    success(messageEn);
  };
  const confirmDialog = useConfirmDialog();

  const mappingComplete = useMemo(
    () => REQUIRED_FIELDS.every((field) => Boolean(mapping[field.key])),
    [mapping]
  );

  const signature = useMemo(
    () => headers.map((header) => header.toLowerCase()).join("|"),
    [headers]
  );

  useEffect(() => {
    if (!signature) {
      setPresetAvailable(false);
      return;
    }
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("member-import-presets");
    if (!stored) {
      setPresetAvailable(false);
      return;
    }
    try {
      const presets: Array<{ signature: string; mapping: Mapping; masks: typeof masks }> =
        JSON.parse(stored);
      const preset = presets.find((item) => item.signature === signature);
      if (preset) {
        setMapping(preset.mapping);
        setMasks(preset.masks);
        setPresetAvailable(true);
      } else {
        setPresetAvailable(false);
      }
    } catch (err) {
      console.error("Failed to parse member-import presets", err);
      setPresetAvailable(false);
    }
  }, [signature]);

  type MemberInsert = Partial<Database["app"]["Tables"]["members"]["Insert"]>;

  const processedRows = useMemo<Array<ProcessedRow<MemberInsert> & { index: number }>>(() => {
    if (rows.length === 0 || !mappingComplete) {
      return [];
    }

    return rows.map((row, index) => {
      const fieldConfigs = REQUIRED_FIELDS.map((field) => ({
        key: field.key,
        maskId: masks[field.key],
        columnKey: mapping[field.key] ?? null,
      }));

      const processed = processRow(fieldConfigs, row, (entries) => {
        const fullName = entries.full_name.value?.toString() ?? "";
        const msisdn = entries.msisdn.value?.toString() ?? "";
        const memberCodeValue = entries.member_code.value;
        const memberCode =
          memberCodeValue == null || memberCodeValue === "" ? null : memberCodeValue.toString();

        return {
          full_name: fullName,
          msisdn,
          member_code: memberCode,
        } satisfies MemberInsert;
      });

      return { ...processed, index };
    });
  }, [rows, masks, mapping, mappingComplete]);

  const validRows = useMemo(
    () => processedRows.filter((row) => row.errors.length === 0),
    [processedRows]
  );

  const invalidRows = useMemo(
    () => processedRows.filter((row) => row.errors.length > 0),
    [processedRows]
  );

  const reset = () => {
    setOpen(false);
    setStep(1);
    setMessage(null);
    setError(null);
    setFileName(null);
    setHeaders([]);
    setRows([]);
    setMapping({});
    setMasks({ ...DEFAULT_MEMBER_MASKS });
    setParsing(false);
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    setMessage(null);
    setError(null);
    setParsing(true);
    setFileName(file.name);
    setMasks({ ...DEFAULT_MEMBER_MASKS });
    try {
      const { headers: nextHeaders, rows: nextRows } = await parseTabularFile(file);
      setHeaders(nextHeaders);
      setRows(nextRows);
      const autoMapping: Mapping = {};
      for (const field of nextHeaders) {
        const lower = field.toLowerCase();
        if (lower.includes("name") && !autoMapping.full_name) autoMapping.full_name = field;
        if ((lower.includes("msisdn") || lower.includes("phone")) && !autoMapping.msisdn)
          autoMapping.msisdn = field;
        if ((lower.includes("code") || lower.includes("member")) && !autoMapping.member_code)
          autoMapping.member_code = field;
      }
      setMapping(autoMapping);
      setStep(2);
    } catch (parseError: unknown) {
      const message = parseError instanceof Error ? parseError.message : "Unable to parse file";
      setError(message);
      notifyError(message);
    } finally {
      setParsing(false);
    }
  };

  const handleConfirm = async () => {
    const accepted = await confirmDialog({
      title: t("ikimina.import.confirmTitle", "Confirm member import"),
      description: `Import ${validRows.length} valid row(s) into this ikimina? (${processedRows.length} total)`,
      confirmLabel: t("ikimina.import.confirm", "Import"),
      cancelLabel: t("common.cancel", "Cancel"),
    });

    if (!accepted) {
      return;
    }

    startTransition(async () => {
      setMessage(null);
      setError(null);
      try {
        const payload = validRows.map((row) => ({
          ikimina_id: ikiminaId,
          full_name: row.record.full_name?.toString().trim() ?? "",
          msisdn: row.record.msisdn?.toString().trim() ?? "",
          member_code: row.record.member_code?.toString().trim() || null,
        }));

        const { error } = await supabase.functions.invoke("secure-import-members", {
          body: {
            ikiminaId,
            saccoId,
            rows: payload,
          },
        });

        if (error) {
          throw new Error(error.message ?? "Import failed");
        }

        const successEn = `Imported ${payload.length} of ${processedRows.length} row(s). Refresh to verify counts.`;
        setMessage(successEn);
        notifySuccess(`Imported ${payload.length} members`);
        if (typeof window !== "undefined" && signature) {
          try {
            const stored = window.localStorage.getItem("member-import-presets");
            const presets: Array<{ signature: string; mapping: Mapping; masks: typeof masks }> =
              stored ? JSON.parse(stored) : [];
            const next = presets.filter((preset) => preset.signature !== signature);
            next.push({ signature, mapping, masks });
            window.localStorage.setItem("member-import-presets", JSON.stringify(next));
          } catch (err) {
            console.error("Failed to persist mapping preset", err);
          }
        }
        setStep(3);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Import failed";
        console.error(err);
        setError(message);
        notifyError(message);
      }
    });
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-member-import-trigger={ikiminaId}
        className="interactive-scale rounded-xl bg-kigali px-4 py-2 text-sm font-semibold text-ink shadow-glass"
      >
        {t("ikimina.import.button", "Spreadsheet import")}
      </button>

      <Modal
        open={open}
        onClose={reset}
        size="xl"
        labelledBy="member-import-heading"
        className="glass relative w-full max-w-2xl rounded-3xl p-6 text-neutral-0"
      >
        {() => (
          <div className="relative space-y-6">
            {parsing && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-3xl bg-black/40">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            )}
            <header className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-neutral-2">
                  {t("ikimina.import.title", "Ikimina import")}
                </p>
                <h2 id="member-import-heading" className="text-lg font-semibold">
                  {t("ikimina.import.step", "Step")} {step} ·{" "}
                  {fileName ?? t("ikimina.import.uploadCsv", "Upload CSV")}
                </h2>
              </div>
              <button className="text-sm text-neutral-2 hover:text-neutral-0" onClick={reset}>
                {t("common.close", "Close")}
                <span aria-hidden className="ml-1">
                  ✕
                </span>
              </button>
            </header>

            {step === 1 && (
              <div className="mt-6 space-y-4 text-sm text-neutral-0">
                <p>
                  {t(
                    "ikimina.import.uploadHelp",
                    "Upload a CSV exported from your SACCO system. Include column headers in the first row."
                  )}
                </p>
                <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/30 bg-white/5 p-10 text-center transition hover:bg-white/10">
                  <span className="text-sm font-semibold">
                    {t("ikimina.import.dropOrBrowse", "Drop CSV here or click to browse")}
                  </span>
                  <span className="text-xs text-neutral-2">
                    {t("ikimina.import.supported", "Supported: .csv, .xlsx")}
                  </span>
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls,.xlsm,.xlsb"
                    className="hidden"
                    onChange={(event) => handleFile(event.target.files?.[0])}
                  />
                </label>
                {error && (
                  <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
                )}
                <p className="text-xs text-neutral-2">
                  {t(
                    "ikimina.import.templateColumns",
                    "Template columns: full_name, msisdn, member_code. You can adjust mapping in the next step."
                  )}
                </p>
              </div>
            )}

            {step === 2 && (
              <div className="mt-6 space-y-4 text-sm text-neutral-0">
                <p>
                  {t(
                    "ikimina.import.dragMapping",
                    "Drag a CSV column chip into each required field below."
                  )}
                </p>
                {presetAvailable && (
                  <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-neutral-2">
                    {t(
                      "ikimina.import.previousMapping",
                      "Previous mapping detected for this header set. Fields applied automatically."
                    )}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {headers
                    .filter((header) => !Object.values(mapping).includes(header))
                    .map((header) => (
                      <span
                        key={header}
                        draggable
                        onDragStart={(event) => event.dataTransfer.setData("text/plain", header)}
                        className="interactive-scale cursor-grab rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.3em] text-neutral-0"
                      >
                        {header}
                      </span>
                    ))}
                </div>
                {REQUIRED_FIELDS.map((field) => {
                  const assigned = mapping[field.key];
                  const maskOptions = getMaskOptions(field.key);
                  const selectedMask = masks[field.key];
                  const activeMask = maskOptions.find((mask) => mask.id === selectedMask);
                  return (
                    <div key={field.key} className="space-y-2">
                      <label className="text-xs uppercase tracking-[0.3em] text-neutral-2">
                        {field.label}
                      </label>
                      <div
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          const header = event.dataTransfer.getData("text/plain");
                          if (!header) return;
                          setError(null);
                          setMapping((current) => ({ ...current, [field.key]: header }));
                        }}
                        className="flex min-h-[64px] items-center justify-between gap-3 rounded-2xl border border-dashed border-white/25 bg-white/5 px-4 py-3"
                      >
                        {assigned ? (
                          <span className="rounded-full bg-white/15 px-3 py-1 text-xs uppercase tracking-[0.3em] text-neutral-0">
                            {assigned}
                          </span>
                        ) : (
                          <span className="text-xs text-neutral-2">
                            {t("ikimina.import.dropHere", "Drop a column here")}
                          </span>
                        )}
                        {assigned && (
                          <button
                            type="button"
                            className="text-[11px] text-rw-yellow underline-offset-2 hover:underline"
                            onClick={() =>
                              setMapping((current) => {
                                const clone = { ...current };
                                delete clone[field.key];
                                return clone;
                              })
                            }
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      {maskOptions.length > 0 && (
                        <div className="flex items-center justify-between gap-3 text-[11px] text-neutral-2">
                          <span>Validation mask</span>
                          <select
                            value={selectedMask}
                            onChange={(event) =>
                              setMasks((current) => ({
                                ...current,
                                [field.key]: event.target.value,
                              }))
                            }
                            className="rounded-xl border border-white/10 bg-white/10 px-3 py-1 text-xs text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue"
                          >
                            {maskOptions.map((mask) => (
                              <option key={mask.id} value={mask.id}>
                                {mask.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      <p className="text-[11px] text-neutral-2">{field.hint}</p>
                      {activeMask?.description && (
                        <p className="text-[10px] text-neutral-2">{activeMask.description}</p>
                      )}
                    </div>
                  );
                })}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-xl border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-neutral-2"
                    onClick={() => {
                      if (typeof window === "undefined") return;
                      const stored = window.localStorage.getItem("member-import-presets");
                      if (!stored) return;
                      try {
                        const presets: Array<{
                          signature: string;
                          mapping: Mapping;
                          masks: typeof masks;
                        }> = JSON.parse(stored);
                        const preset = presets.find((item) => item.signature === signature);
                        if (preset) {
                          setMapping(preset.mapping);
                          setMasks(preset.masks);
                          setError(null);
                        }
                      } catch (err) {
                        console.error("Failed to load preset", err);
                      }
                    }}
                  >
                    Apply preset
                  </button>
                  <button
                    className="interactive-scale rounded-xl border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-neutral-2"
                    onClick={() => setStep(1)}
                  >
                    Back
                  </button>
                  <button
                    className="interactive-scale rounded-xl bg-kigali px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-ink shadow-glass disabled:opacity-60"
                    disabled={!mappingComplete}
                    onClick={() => {
                      if (!mappingComplete) {
                        const msg = t(
                          "ikimina.import.mapAll",
                          "Map all required fields before continuing."
                        );
                        setError(msg);
                        notifyError(msg);
                        return;
                      }
                      setError(null);
                      setStep(3);
                    }}
                  >
                    Review
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="mt-6 space-y-4 text-sm text-neutral-0">
                <p>Preview sanitized rows. Validation issues appear inline.</p>
                <div className="max-h-56 overflow-auto rounded-2xl border border-white/10">
                  <table className="w-full border-collapse text-xs">
                    <thead className="bg-white/5 text-left uppercase tracking-[0.2em] text-neutral-2">
                      <tr>
                        <th className="px-4 py-2">Full name</th>
                        <th className="px-4 py-2">MSISDN</th>
                        <th className="px-4 py-2">Member code</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {processedRows.slice(0, 10).map((row) => {
                        const fullNameCell = row.cells.full_name as ProcessedCell;
                        const msisdnCell = row.cells.msisdn as ProcessedCell;
                        const memberCodeCell = row.cells.member_code as ProcessedCell;
                        const invalid = row.errors.length > 0;
                        return (
                          <tr key={row.index} className={invalid ? "bg-red-500/10" : undefined}>
                            <td className="px-4 py-2 text-neutral-0">
                              {fullNameCell?.value ?? ""}
                              {!fullNameCell?.valid && fullNameCell?.reason && (
                                <p className="mt-1 text-[10px] text-amber-200">
                                  {fullNameCell.reason}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-2 text-neutral-2">
                              {msisdnCell?.value ?? ""}
                              {!msisdnCell?.valid && msisdnCell?.reason && (
                                <p className="mt-1 text-[10px] text-amber-200">
                                  {msisdnCell.reason}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-2 text-neutral-2">
                              {memberCodeCell?.value ?? "—"}
                              {!memberCodeCell?.valid && memberCodeCell?.reason && (
                                <p className="mt-1 text-[10px] text-amber-200">
                                  {memberCodeCell.reason}
                                </p>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <button
                    className="interactive-scale rounded-xl border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-neutral-2"
                    onClick={() => setStep(2)}
                  >
                    {t("common.back", "Back")}
                  </button>
                  <div className="flex flex-1 flex-col gap-2 text-right">
                    <div className="text-xs text-neutral-2">
                      Valid rows: {validRows.length} / {processedRows.length}
                    </div>
                    <button
                      type="button"
                      onClick={handleConfirm}
                      disabled={
                        pending ||
                        !mappingComplete ||
                        validRows.length === 0 ||
                        invalidRows.length > 0
                      }
                      className="interactive-scale rounded-xl bg-kigali px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-ink shadow-glass disabled:opacity-60"
                    >
                      {pending
                        ? t("ikimina.import.importing", "Importing…")
                        : t("ikimina.import.confirmImport", "Confirm import")}
                    </button>
                    {error && (
                      <p className="rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-300">
                        {error}
                      </p>
                    )}
                    {message && (
                      <p className="rounded-xl bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                        {message}
                      </p>
                    )}
                    {invalidRows.length > 0 && (
                      <div className="rounded-xl bg-amber-500/10 px-3 py-2 text-left text-[11px] text-amber-200">
                        <p>
                          {invalidRows.length}{" "}
                          {t("ikimina.import.rowsNeedFixes", "row(s) need fixes before importing.")}
                        </p>
                        <ul className="mt-1 space-y-1">
                          {invalidRows.slice(0, 3).map((row) => (
                            <li key={row.index}>
                              Row {row.index + 1}: {row.errors[0]}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <p className="text-[10px] text-neutral-2">
                      {t(
                        "ikimina.import.payloadNote",
                        "Payload is sent to the secure-import-members edge function. Ensure it is deployed and reachable."
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
