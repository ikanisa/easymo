"use client";

import { useMemo, useRef, useState, useTransition } from "react";

import { Drawer } from "@/components/ui/drawer";
import { FormField, FormLayout, FormSummaryBanner } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { Stepper } from "@/components/ui/stepper";
import { cn } from "@/lib/utils";
import {
  DEFAULT_MEMBER_MASKS,
  getMaskOptions,
  processRow,
  type ProcessedCell,
  type ProcessedRow,
} from "@/lib/imports/validation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import { useToast } from "@/providers/toast-provider";

const supabase = getSupabaseBrowserClient();

const MAX_PREVIEW_ROWS = 150;

interface MemberPdfImportDialogProps {
  ikiminaId: string;
  saccoId: string | null;
  canImport?: boolean;
  disabledReason?: string;
}

interface AiMemberRecord {
  full_name: string;
  msisdn: string | null;
  member_code: string | null;
}

type MemberInsert = Partial<Database["app"]["Tables"]["members"]["Insert"]>;

type ProcessedMemberRow = ProcessedRow<MemberInsert> & { index: number };

export function MemberPdfImportDialog({
  ikiminaId,
  saccoId,
  canImport = true,
  disabledReason,
}: MemberPdfImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [records, setRecords] = useState<AiMemberRecord[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [masks, setMasks] = useState({ ...DEFAULT_MEMBER_MASKS });
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { success, error: toastError } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toBilingual = (en: string, rw: string) => `${en} / ${rw}`;

  const processedRows = useMemo<ProcessedMemberRow[]>(() => {
    if (records.length === 0) return [];
    const fieldConfigs = [
      { key: "full_name" as const, maskId: masks.full_name, columnKey: "full_name" },
      { key: "msisdn" as const, maskId: masks.msisdn, columnKey: "msisdn" },
      { key: "member_code" as const, maskId: masks.member_code, columnKey: "member_code" },
    ];

    return records.map((record, index) => {
      const rowData: Record<string, string | null> = {
        full_name: record.full_name ?? "",
        msisdn: record.msisdn ?? "",
        member_code: record.member_code ?? "",
      };

      return Object.assign(
        processRow(fieldConfigs, rowData, (entries) => ({
          full_name: entries.full_name.value?.toString() ?? "",
          msisdn: entries.msisdn.value?.toString() ?? "",
          member_code: (entries.member_code.value ?? null) as string | null,
        })),
        { index }
      );
    });
  }, [records, masks]);

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
    setStep(0);
    setRecords([]);
    setWarnings([]);
    setMasks({ ...DEFAULT_MEMBER_MASKS });
    setFileName(null);
    setError(null);
    setMessage(null);
    setLoading(false);
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    setFileName(file.name);
    setLoading(true);
    setError(null);
    setMessage(null);
    setWarnings([]);

    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch(`/api/ikimina/${ikiminaId}/member-ocr`, {
        method: "POST",
        body: form,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? `OCR request failed (${response.status})`);
      }
      const payload = (await response.json()) as { members: AiMemberRecord[]; warnings?: string[] };
      const sanitized = (payload.members ?? []).map((member) => ({
        full_name: member.full_name?.trim() ?? "",
        msisdn: member.msisdn?.trim() || null,
        member_code: member.member_code?.trim() || null,
      }));

      if (sanitized.length === 0) {
        throw new Error("The PDF did not contain any members");
      }

      if (sanitized.length > 300) {
        throw new Error("The extracted list is too large. Split the PDF and try again.");
      }

      setRecords(sanitized);
      setWarnings(payload.warnings ?? []);
      setStep(1);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to process PDF";
      const bilingual = toBilingual(message, "Gucapa PDF byanze");
      setError(bilingual);
      toastError(bilingual);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRecord = (index: number, field: keyof AiMemberRecord, value: string) => {
    setRecords((current) => {
      const clone = [...current];
      const record = { ...clone[index] };
      if (field === "full_name") {
        record.full_name = value;
      } else if (field === "msisdn") {
        record.msisdn = value ? value : null;
      } else if (field === "member_code") {
        record.member_code = value ? value : null;
      }
      clone[index] = record;
      return clone;
    });
  };

  const handleDeleteRecord = (index: number) => {
    setRecords((current) => current.filter((_, idx) => idx !== index));
  };

  const handleAddRecord = () => {
    setRecords((current) => [...current, { full_name: "", msisdn: null, member_code: null }]);
  };

  const handleImport = () => {
    if (records.length === 0) {
      const messageEn = "Add at least one member before importing.";
      const bilingual = toBilingual(
        messageEn,
        "Ongeramo nibura umunyamuryango umwe imbere yo kwinjiza."
      );
      setError(bilingual);
      toastError(bilingual);
      return;
    }

    if (invalidRows.length > 0) {
      const messageEn = "Resolve highlighted validation issues before importing.";
      const bilingual = toBilingual(messageEn, "Banze amakosa agaragara mbere yo kwinjiza.");
      setError(bilingual);
      toastError(bilingual);
      return;
    }

    startTransition(async () => {
      try {
        setError(null);
        setMessage(null);

        const payload = validRows.map((row) => ({
          ikimina_id: ikiminaId,
          full_name: row.record.full_name ?? "",
          msisdn: row.record.msisdn ?? "",
          member_code: row.record.member_code ?? null,
        }));

        const { error: fnError } = await supabase.functions.invoke("secure-import-members", {
          body: {
            ikiminaId,
            saccoId,
            rows: payload,
          },
        });

        if (fnError) {
          throw new Error(fnError.message ?? "Import failed");
        }

        const successEn = `Imported ${payload.length} member(s). Refresh to verify counts.`;
        const successRw = `Byinjije abanyamuryango ${payload.length}. Ongera usubize urupapuro.`;
        const bilingual = toBilingual(successEn, successRw);
        setMessage(bilingual);
        success(bilingual);
        setRecords(
          payload.map((row) => ({
            full_name: row.full_name,
            msisdn: row.msisdn,
            member_code: row.member_code,
          }))
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Import failed";
        const bilingual = toBilingual(message, "Kwinjiza byanze");
        setError(bilingual);
        toastError(bilingual);
      }
    });
  };

  const stepperSteps = useMemo(
    () => [
      {
        title: "Upload PDF",
        description:
          fileName && step > 0 ? `Selected ${fileName}` : "Drop or browse a member roster PDF",
      },
      {
        title: "Review & confirm",
        description: `${validRows.length} ready · ${invalidRows.length} need attention`,
      },
    ],
    [fileName, invalidRows.length, step, validRows.length]
  );

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => {
          if (!canImport) return;
          setOpen(true);
        }}
        disabled={!canImport}
        title={!canImport ? (disabledReason ?? "Read-only access") : undefined}
        className={cn(
          "interactive-scale rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-neutral-0 shadow-glass",
          !canImport && "cursor-not-allowed opacity-60"
        )}
      >
        AI PDF import
      </button>

      <Drawer
        open={open && canImport}
        onClose={reset}
        title="AI member import"
        description="Process scanned member rosters with OCR, validate results, and confirm import before syncing."
        size="lg"
        initialFocusRef={fileInputRef as React.RefObject<HTMLElement>}
      >
        <div className="relative flex h-full flex-col gap-5">
          {loading ? (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-[calc(var(--radius-xl)_*_1.1)] bg-black/40">
              <Skeleton className="h-6 w-48" aria-label="Processing PDF" />
              <Skeleton className="h-4 w-32" />
            </div>
          ) : null}

          <Stepper steps={stepperSteps} currentStep={step} onStepChange={setStep} />

          {message ? (
            <FormSummaryBanner
              status="success"
              title={message}
              description="Imported records will sync automatically once online."
            />
          ) : null}

          {error ? (
            <FormSummaryBanner
              status="error"
              title="Import requires attention"
              description={error}
              items={
                invalidRows.length > 0
                  ? [
                      `${invalidRows.length} row${invalidRows.length === 1 ? "" : "s"} need fixes before continuing.`,
                    ]
                  : undefined
              }
            />
          ) : null}

          {warnings.length > 0 && step === 1 ? (
            <FormSummaryBanner
              status="warning"
              title="Model warnings"
              description="Review and adjust the highlighted rows before confirming."
              items={warnings.map((warning, idx) => (
                <span key={`${warning}-${idx}`}>{warning}</span>
              ))}
            />
          ) : null}

          {step === 0 ? (
            <div className="space-y-4 text-sm text-neutral-0">
              <p>
                Upload a scanned or digital PDF containing ikimina member lists. The AI will extract
                rows for review.
              </p>
              <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/30 bg-white/5 p-10 text-center transition hover:bg-white/10">
                <span className="text-sm font-semibold">Drop PDF here or click to browse</span>
                <span className="text-xs text-neutral-2">Supported: .pdf (max 8MB)</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(event) => handleFile(event.target.files?.[0])}
                />
              </label>
              <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                The PDF is processed with OpenAI OCR. Member data is reviewed locally before saving.
              </p>
            </div>
          ) : (
            <div className="flex flex-1 flex-col gap-4 text-sm text-neutral-0">
              <FormLayout variant="double" className="text-xs">
                <FormField
                  label="Validation mask · Full name"
                  inputId="mask-full-name"
                  optionalLabel="Adjust"
                >
                  {({ id }) => (
                    <select
                      id={id}
                      value={masks.full_name}
                      onChange={(event) =>
                        setMasks((current) => ({ ...current, full_name: event.target.value }))
                      }
                      className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue"
                    >
                      {getMaskOptions("full_name").map((mask) => (
                        <option key={mask.id} value={mask.id}>
                          {mask.label}
                        </option>
                      ))}
                    </select>
                  )}
                </FormField>
                <FormField
                  label="Validation mask · MSISDN"
                  inputId="mask-msisdn"
                  optionalLabel="Adjust"
                >
                  {({ id }) => (
                    <select
                      id={id}
                      value={masks.msisdn}
                      onChange={(event) =>
                        setMasks((current) => ({ ...current, msisdn: event.target.value }))
                      }
                      className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue"
                    >
                      {getMaskOptions("msisdn").map((mask) => (
                        <option key={mask.id} value={mask.id}>
                          {mask.label}
                        </option>
                      ))}
                    </select>
                  )}
                </FormField>
                <FormField
                  label="Validation mask · Member code"
                  inputId="mask-member-code"
                  optionalLabel="Adjust"
                >
                  {({ id }) => (
                    <select
                      id={id}
                      value={masks.member_code}
                      onChange={(event) =>
                        setMasks((current) => ({ ...current, member_code: event.target.value }))
                      }
                      className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue"
                    >
                      {getMaskOptions("member_code").map((mask) => (
                        <option key={mask.id} value={mask.id}>
                          {mask.label}
                        </option>
                      ))}
                    </select>
                  )}
                </FormField>
              </FormLayout>

              <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-white/10">
                <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.2em] text-neutral-2">
                  <span>
                    Preview ({Math.min(processedRows.length, MAX_PREVIEW_ROWS)} of{" "}
                    {processedRows.length})
                  </span>
                  {processedRows.length > MAX_PREVIEW_ROWS ? <span>Truncated</span> : null}
                </div>
                <div className="max-h-[360px] overflow-auto">
                  <table className="w-full border-collapse text-xs">
                    <thead className="bg-white/5 text-left uppercase tracking-[0.2em] text-neutral-2">
                      <tr>
                        <th className="px-4 py-2">Full name</th>
                        <th className="px-4 py-2">MSISDN</th>
                        <th className="px-4 py-2">Member code</th>
                        <th className="px-4 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {processedRows.slice(0, MAX_PREVIEW_ROWS).map((row) => {
                        const fullNameCell = row.cells.full_name as ProcessedCell;
                        const msisdnCell = row.cells.msisdn as ProcessedCell;
                        const memberCodeCell = row.cells.member_code as ProcessedCell;
                        const invalid = row.errors.length > 0;
                        return (
                          <tr
                            key={`row-${row.index}`}
                            className={invalid ? "bg-red-500/10" : undefined}
                          >
                            <td className="px-4 py-2">
                              <input
                                value={records[row.index]?.full_name ?? ""}
                                onChange={(event) =>
                                  handleUpdateRecord(row.index, "full_name", event.target.value)
                                }
                                className="w-full rounded-xl border border-white/10 bg-white/10 px-2 py-1 text-xs text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue"
                                aria-invalid={!fullNameCell.valid}
                              />
                              {!fullNameCell.valid && fullNameCell.reason && (
                                <p className="mt-1 text-[11px] text-red-300">
                                  {fullNameCell.reason}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-2">
                              <input
                                value={records[row.index]?.msisdn ?? ""}
                                onChange={(event) =>
                                  handleUpdateRecord(row.index, "msisdn", event.target.value)
                                }
                                className="w-full rounded-xl border border-white/10 bg-white/10 px-2 py-1 text-xs text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue"
                                aria-invalid={!msisdnCell.valid}
                              />
                              {!msisdnCell.valid && msisdnCell.reason && (
                                <p className="mt-1 text-[11px] text-red-300">{msisdnCell.reason}</p>
                              )}
                            </td>
                            <td className="px-4 py-2">
                              <input
                                value={records[row.index]?.member_code ?? ""}
                                onChange={(event) =>
                                  handleUpdateRecord(row.index, "member_code", event.target.value)
                                }
                                className="w-full rounded-xl border border-white/10 bg-white/10 px-2 py-1 text-xs text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue"
                                aria-invalid={!memberCodeCell.valid}
                              />
                              {!memberCodeCell.valid && memberCodeCell.reason && (
                                <p className="mt-1 text-[11px] text-red-300">
                                  {memberCodeCell.reason}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-2 text-right">
                              <button
                                type="button"
                                className="rounded-xl border border-white/15 px-3 py-1 text-xs text-neutral-2 transition hover:border-white/30 hover:text-neutral-0"
                                onClick={() => handleDeleteRecord(row.index)}
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-neutral-2">
                <div>
                  <span className="font-semibold text-neutral-0">{validRows.length}</span> ready ·
                  <span className="ml-1 font-semibold text-amber-200">{invalidRows.length}</span>{" "}
                  need review
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-full border border-white/15 px-3 py-1 text-[11px] uppercase tracking-[0.35em] text-neutral-2 transition hover:border-white/30 hover:text-neutral-0"
                    onClick={handleAddRecord}
                  >
                    Add row
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-white/15 px-3 py-1 text-[11px] uppercase tracking-[0.35em] text-neutral-2 transition hover:border-white/30 hover:text-neutral-0"
                    onClick={() => setRecords([])}
                  >
                    Clear list
                  </button>
                </div>
              </div>
            </div>
          )}

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4 text-xs">
            <div className="text-neutral-2">
              {step === 0
                ? "Upload a PDF to preview members."
                : `${processedRows.length} row${processedRows.length === 1 ? "" : "s"} parsed.`}
            </div>
            <div className="flex items-center gap-2">
              {step === 1 ? (
                <button
                  type="button"
                  className="rounded-full border border-white/15 px-4 py-2 uppercase tracking-[0.3em] text-neutral-2 transition hover:border-white/30 hover:text-neutral-0"
                  onClick={() => setStep(0)}
                >
                  Back
                </button>
              ) : null}
              {step === 0 ? (
                <button
                  type="button"
                  className="rounded-full bg-white/15 px-4 py-2 uppercase tracking-[0.3em] text-neutral-0 transition hover:bg-white/25 disabled:opacity-60"
                  onClick={() => setStep(1)}
                  disabled={records.length === 0}
                >
                  Review extracted rows
                </button>
              ) : (
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-full bg-emerald-500/80 px-5 py-2 uppercase tracking-[0.3em] text-neutral-0 transition hover:bg-emerald-500 disabled:opacity-60"
                  onClick={handleImport}
                  disabled={pending}
                >
                  {pending ? "Importing…" : "Confirm import"}
                </button>
              )}
            </div>
          </footer>
        </div>
      </Drawer>
    </div>
  );
}
