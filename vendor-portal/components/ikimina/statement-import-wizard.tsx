"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useToast } from "@/providers/toast-provider";
import { useConfirmDialog } from "@/providers/confirm-provider";
import { DEFAULT_STATEMENT_MASKS, processRow, type ProcessedRow } from "@/lib/imports/validation";
import { parseTabularFile } from "@/lib/imports/file-parser";
import { Skeleton } from "@/components/ui/skeleton";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useTranslation } from "@/providers/i18n-provider";

const REQUIRED_FIELDS = [
  { key: "occurredAt", label: "Occurred at", hint: "ISO date or 2024-09-01 08:53" },
  { key: "txnId", label: "Transaction ID", hint: "Unique statement reference" },
  { key: "msisdn", label: "MSISDN", hint: "07########" },
  { key: "amount", label: "Amount", hint: "Positive number" },
] as const satisfies ReadonlyArray<{
  key: "occurredAt" | "txnId" | "msisdn" | "amount";
  label: string;
  hint: string;
}>;

const OPTIONAL_FIELDS = [
  { key: "reference", label: "Reference", hint: "DISTRICT.SACCO.IKIMINA(.MEMBER)" },
] as const satisfies ReadonlyArray<{
  key: "reference";
  label: string;
  hint: string;
}>;

interface StatementImportWizardProps {
  saccoId: string;
  ikiminaId?: string;
  variant?: StatementWizardVariant;
  canImport?: boolean;
  disabledReason?: string;
}

type CsvRow = Record<string, string | null>;

type Mapping = Record<string, string>;

type StatementRow = {
  occurredAt: string;
  txnId: string;
  msisdn: string;
  amount: number;
  reference?: string | null;
};

type StatementWizardVariant = "generic" | "momo";

type ImportMode = "file" | "sms";

const createInitialStatementMasks = (variant: StatementWizardVariant) =>
  variant === "momo"
    ? { ...DEFAULT_STATEMENT_MASKS, occurredAt: "day-first" }
    : { ...DEFAULT_STATEMENT_MASKS };

type ImportResult = {
  inserted: number;
  duplicates: number;
  posted: number;
  unallocated: number;
  clientDuplicates?: number;
  rowCount?: number;
  reportUrl?: string;
};

export function StatementImportWizard({
  saccoId,
  ikiminaId,
  variant = "generic",
  canImport = true,
  disabledReason,
}: StatementImportWizardProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [importMode, setImportMode] = useState<ImportMode>("file");
  const [fileName, setFileName] = useState<string | null>(null);
  const [_headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [masks, setMasks] = useState(() => createInitialStatementMasks(variant));
  const [parsing, setParsing] = useState(false);
  const [smsInput, setSmsInput] = useState("");
  const [smsParsing, setSmsParsing] = useState(false);
  const [_smsError, setSmsError] = useState<string | null>(null);
  useEffect(() => {
    setMasks(createInitialStatementMasks(variant));
  }, [variant]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const _handleMappingChange = useCallback((fieldKey: string, column: string) => {
    setError(null);
    setMapping((current) => {
      const next = { ...current };
      for (const [key, value] of Object.entries(next)) {
        if (key !== fieldKey && value === column) {
          delete next[key];
        }
      }
      if (!column) {
        delete next[fieldKey];
      } else {
        next[fieldKey] = column;
      }
      return next;
    });
  }, []);
  const { success, error: toastError } = useToast();

  const toBilingual = (english: string, kinyarwanda: string) => `${english} / ${kinyarwanda}`;

  const notifyError = (english: string, kinyarwanda: string) => {
    toastError(toBilingual(english, kinyarwanda));
  };

  const notifySuccess = (english: string, kinyarwanda: string) => {
    success(toBilingual(english, kinyarwanda));
  };
  const confirmDialog = useConfirmDialog();
  const mappingComplete = useMemo(
    () => REQUIRED_FIELDS.every((field) => Boolean(mapping[field.key])),
    [mapping]
  );
  const _amountFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-RW", {
        style: "currency",
        currency: "RWF",
        maximumFractionDigits: 0,
      }),
    []
  );

  const processedRows = useMemo<Array<ProcessedRow<StatementRow> & { index: number }>>(() => {
    if (rows.length === 0 || !mappingComplete) {
      return [];
    }

    return rows.map((row, index) => {
      const fieldConfigs = [
        ...REQUIRED_FIELDS.map((field) => ({
          key: field.key,
          maskId: masks[field.key],
          columnKey: mapping[field.key] ?? null,
        })),
        ...OPTIONAL_FIELDS.map((field) => ({
          key: field.key,
          maskId: masks[field.key],
          columnKey: mapping[field.key] ?? null,
        })),
      ];

      const processed = processRow(fieldConfigs, row, (entries) => {
        const occurredAtValue = entries.occurredAt?.value;
        const txnValue = entries.txnId?.value;
        const msisdnValue = entries.msisdn?.value;
        const amountValue = entries.amount?.value;
        const referenceValue = entries.reference?.value ?? null;

        return {
          occurredAt: occurredAtValue ? occurredAtValue.toString() : "",
          txnId: txnValue ? txnValue.toString() : "",
          msisdn: msisdnValue ? msisdnValue.toString() : "",
          amount: typeof amountValue === "number" ? amountValue : Number(amountValue ?? 0),
          reference:
            referenceValue === null || referenceValue === "" ? null : referenceValue.toString(),
        } satisfies StatementRow;
      });

      return { ...processed, index };
    });
  }, [rows, mapping, masks, mappingComplete]);

  const validRows = useMemo(
    () => processedRows.filter((row) => row.errors.length === 0),
    [processedRows]
  );

  const _invalidRows = useMemo(
    () => processedRows.filter((row) => row.errors.length > 0),
    [processedRows]
  );

  const _parserFeedback = useMemo(() => {
    const txnCounter = new Map<string, number>();
    let missingReference = 0;
    let autoMatch = 0;
    let invalidMsisdn = 0;
    let invalidDate = 0;

    for (const row of processedRows) {
      if (row.record.txnId) {
        txnCounter.set(row.record.txnId, (txnCounter.get(row.record.txnId) ?? 0) + 1);
      }

      if (!row.record.reference) {
        missingReference += 1;
      } else if (row.record.reference.split(".").filter(Boolean).length >= 3) {
        autoMatch += 1;
      }

      if (row.cells.msisdn && !row.cells.msisdn.valid) {
        invalidMsisdn += 1;
      }

      if (row.cells.occurredAt && !row.cells.occurredAt.valid) {
        invalidDate += 1;
      }
    }

    const duplicateTxnIds = new Set<string>();
    txnCounter.forEach((count, txnId) => {
      if (count > 1) {
        duplicateTxnIds.add(txnId);
      }
    });

    const duplicateRows = processedRows.filter((row) =>
      duplicateTxnIds.has(row.record.txnId)
    ).length;

    return {
      total: processedRows.length,
      duplicates: duplicateTxnIds.size,
      duplicateRows,
      duplicateTxnIds,
      missingReference,
      autoMatch,
      invalidMsisdn,
      invalidDate,
    };
  }, [processedRows]);

  const reset = () => {
    setOpen(false);
    setStep(1);
    setImportMode("file");
    setResult(null);
    setMessage(null);
    setError(null);
    setFileName(null);
    setHeaders([]);
    setRows([]);
    setMapping({});
    setMasks(createInitialStatementMasks(variant));
    setSmsInput("\n");
    setSmsError(null);
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    setMessage(null);
    setError(null);
    setParsing(true);
    setFileName(file.name);
    setMasks(createInitialStatementMasks(variant));
    try {
      const { headers: nextHeaders, rows: nextRows } = await parseTabularFile(file);
      setHeaders(nextHeaders);
      setRows(nextRows);
      const autoMap: Mapping = {};
      for (const field of nextHeaders) {
        const lower = field.toLowerCase();
        if (lower.includes("date") || lower.includes("occur"))
          autoMap.occurredAt = autoMap.occurredAt ?? field;
        if (lower.includes("txn") || lower.includes("id")) autoMap.txnId = autoMap.txnId ?? field;
        if ((lower.includes("msisdn") || lower.includes("phone")) && !autoMap.msisdn)
          autoMap.msisdn = field;
        if ((lower.includes("amount") || lower.includes("amt")) && !autoMap.amount)
          autoMap.amount = field;
        if ((lower.includes("reference") || lower.includes("ref")) && !autoMap.reference)
          autoMap.reference = field;
      }
      setMapping(autoMap);
      setStep(2);
    } catch (parseError) {
      const msg = parseError instanceof Error ? parseError.message : "Failed to parse file";
      setError(toBilingual(msg, "Kwinjiza byanze"));
      notifyError(msg, "Kwinjiza byanze");
    } finally {
      setParsing(false);
    }
  };

  const handleSmsParse = async () => {
    const trimmed = smsInput
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (trimmed.length === 0) {
      setSmsError(
        toBilingual("Paste one or more SMS messages first.", "Banza ushyiremo ubutumwa bwa SMS")
      );
      return;
    }

    setSmsError(null);
    setSmsParsing(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/imports/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saccoId,
          entries: trimmed.map((rawText) => ({ rawText })),
        }),
      });

      const payload = (await response.json()) as {
        success?: boolean;
        error?: string;
        results?: Array<{
          parsed: {
            txnId: string;
            occurredAt: string;
            msisdn: string;
            amount: number;
            reference?: string | null;
          } | null;
        }>;
        summary?: { errors?: number };
      };

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? "Unable to parse SMS messages");
      }

      const parsedResults = (payload.results ?? []).filter((item) => item.parsed);

      if (parsedResults.length === 0) {
        setSmsError(toBilingual("No SMS messages were parsed.", "Nta SMS yasobanutse"));
        setSmsParsing(false);
        return;
      }

      const rowsFromSms: CsvRow[] = parsedResults.map((item) => ({
        occurredAt: item.parsed!.occurredAt,
        txnId: item.parsed!.txnId,
        msisdn: item.parsed!.msisdn,
        amount: String(item.parsed!.amount),
        reference: item.parsed!.reference ?? "",
      }));

      setHeaders(["occurredAt", "txnId", "msisdn", "amount", "reference"]);
      setRows(rowsFromSms);
      setMapping({
        occurredAt: "occurredAt",
        txnId: "txnId",
        msisdn: "msisdn",
        amount: "amount",
        reference: "reference",
      });
      setMasks(createInitialStatementMasks(variant));
      setStep(2);

      if (payload.summary?.errors && payload.summary.errors > 0) {
        setSmsError(
          toBilingual(
            `${payload.summary.errors} message(s) could not be parsed.`,
            `${payload.summary.errors} ubutumwa ntibwashoboye gusesengurwa.`
          )
        );
      } else {
        setSmsError(null);
      }
    } catch (smsError) {
      console.error("Failed to parse SMS batch", smsError);
      setSmsError(
        toBilingual("Unable to parse one or more SMS messages.", "Gusesengura SMS byanze")
      );
      setSmsParsing(false);
      return;
    }

    setSmsParsing(false);
  };

  const handleConfirm = async () => {
    const accepted = await confirmDialog({
      title: "Confirm statement import",
      description: toBilingual(
        `Import ${validRows.length} valid row(s) for reconciliation? (${processedRows.length} total)`,
        `Kwinjiza imirongo ${validRows.length} yo guhuza (${processedRows.length} yose)`
      ),
      confirmLabel: "Import",
      cancelLabel: "Cancel",
    });

    if (!accepted) return;

    startTransition(async () => {
      try {
        setMessage(null);
        setError(null);
        const payload = validRows.map((row) => {
          const occurredAtSource = row.record.occurredAt;
          let occurredAt = occurredAtSource;
          try {
            occurredAt = new Date(occurredAtSource).toISOString();
          } catch (parseError) {
            console.warn("Falling back to raw occurredAt", parseError);
          }
          return {
            occurredAt,
            txnId: row.record.txnId,
            msisdn: row.record.msisdn,
            amount: row.record.amount,
            reference: row.record.reference,
          } satisfies StatementRow;
        });

        const response = await fetch("/api/imports/statement", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            saccoId,
            ikiminaId,
            rows: payload,
          }),
        });

        const resultPayload = (await response.json()) as
          | (ImportResult & { success?: boolean; error?: string })
          | null;

        if (!response.ok || !resultPayload?.success) {
          throw new Error(resultPayload?.error ?? "Import failed");
        }

        setResult(resultPayload);
        const inserted = resultPayload.inserted ?? payload.length;
        const posted = resultPayload.posted ?? 0;
        const unallocated = resultPayload.unallocated ?? 0;
        const duplicates = resultPayload.duplicates ?? 0;
        setMessage(
          toBilingual(
            `Imported ${inserted} of ${processedRows.length} row(s) · ${posted} posted · ${unallocated} unallocated · ${duplicates} duplicates.`,
            `Byinjije imirongo ${inserted} muri ${processedRows.length} · ${posted} byemejwe · ${unallocated} bitaragabanywa · ${duplicates} byisubiyemo.`
          )
        );
        notifySuccess("Statement import complete", "Kwinjiza raporo byarangiye");
        setStep(3);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Import failed";
        console.error(err);
        setError(toBilingual(message, "Kwinjiza byanze"));
        notifyError(message, "Kwinjiza byanze");
      }
    });
  };

  return (
    <div className="space-y-3">
      <Button
        type="button"
        onClick={() => {
          if (!canImport) return;
          setOpen(true);
        }}
        disabled={!canImport}
        title={!canImport ? (disabledReason ?? "Read-only access") : undefined}
        className="w-full sm:w-auto"
      >
        {t("statement.trigger", "Import statements")}
      </Button>

      <Modal
        open={open && canImport}
        onClose={reset}
        size="xl"
        labelledBy="statement-import-heading"
        className="glass relative w-full max-w-2xl rounded-3xl p-6 text-neutral-0"
      >
        {() => (
          <div className="relative space-y-6">
            {(parsing || smsParsing) && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-3xl bg-black/40">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            )}
            <header className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-neutral-2">
                  Statement import
                </p>
                <h2 id="statement-import-heading" className="text-lg font-semibold">
                  Step {step} · {fileName ?? "Upload"}
                </h2>
              </div>
              <button className="text-sm text-neutral-2 hover:text-neutral-0" onClick={reset}>
                <span>{t("common.close", "Close")}</span>
                <span aria-hidden className="ml-1">
                  ✕
                </span>
              </button>
            </header>

            {step === 1 && (
              <div className="mt-6 space-y-4 text-sm text-neutral-0">
                <SegmentedControl
                  value={importMode}
                  onValueChange={(next) => {
                    if (typeof next !== "string") return;
                    setImportMode(next as ImportMode);
                  }}
                  options={[
                    {
                      value: "file",
                      label: t("statement.mode.file", "Upload file"),
                      description: t("statement.mode.fileHint", "CSV or Excel export"),
                    },
                    {
                      value: "sms",
                      label: t("statement.mode.sms", "Paste SMS"),
                      description: t("statement.mode.smsHint", "MTN MoMo notifications"),
                    },
                  ]}
                  columns={2}
                  aria-label={t("statement.mode.label", "Choose import mode")}
                />

                {importMode === "file" ? (
                  <>
                    <p>
                      {t(
                        "statement.upload.intro",
                        "Upload bank or MoMo statements exported as CSV or Excel. Include a header row."
                      )}
                    </p>
                    <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/30 bg-white/5 p-10 text-center transition hover:bg-white/10">
                      <span className="text-sm font-semibold">
                        {t("statement.upload.dropCta", "Drop file here or click to browse")}
                      </span>
                      <span className="text-xs text-neutral-2">
                        {t("statement.upload.supported", "Supported: .csv, .xlsx")}
                      </span>
                      <input
                        type="file"
                        accept=".csv,.xlsx,.xls,.xlsm,.xlsb"
                        className="hidden"
                        onChange={(event) => handleFile(event.target.files?.[0])}
                      />
                    </label>
                    {error && (
                      <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">
                        {error}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <label className="block text-xs uppercase tracking-[0.3em] text-neutral-2">
                      {t("statement.sms.heading", "Paste SMS log")}
                    </label>
                    <textarea
                      value={smsInput}
                      onChange={(event) => setSmsInput(event.target.value)}
                      className="h-40 w-full rounded-2xl border border-white/10 bg-white/10 p-3 text-sm text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue"
                      placeholder={t(
                        "statement.sms.placeholder",
                        "Paste MoMo alert text messages separated by new lines"
                      )}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-2">
                      <span>{t("statement.sms.hint", "We’ll parse MTN alerts automatically")}</span>
                      <button
                        type="button"
                        className="rounded-full border border-white/15 px-3 py-1 text-xs uppercase tracking-[0.3em] text-neutral-2 hover:border-white/30 hover:text-neutral-0"
                        onClick={() => setSmsInput("")}
                      >
                        {t("common.clear", "Clear")}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {step === 2 && importMode === "file" && (
              <div className="mt-6 space-y-5">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-neutral-2">
                  <p className="text-sm text-neutral-0">
                    {t("statement.preview.intro", "Preview and map your columns before importing.")}
                  </p>
                  <p className="mt-2">
                    {t(
                      "statement.preview.instructions",
                      "Match all required fields. Optional fields improve reconciliation accuracy."
                    )}
                  </p>
                </div>

                <div className="space-y-4">
                  {processedRows.slice(0, 5).map((row, _idx) => (
                    <div
                      key={row.index}
                      className="rounded-2xl border border-white/10 bg-white/5 p-4"
                    >
                      <header className="mb-3 flex items-center justify-between text-xs uppercase tracking-[0.3em] text-neutral-2">
                        <span>
                          {t("statement.preview.row", "Row {row}", { row: row.index + 1 })}
                        </span>
                        {row.errors.length > 0 && (
                          <span className="rounded-full bg-red-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-red-300">
                            {t("statement.preview.hasErrors", "Needs attention")}
                          </span>
                        )}
                      </header>

                      <div className="grid gap-3 text-sm text-neutral-0 sm:grid-cols-2">
                        {REQUIRED_FIELDS.map((field) => (
                          <div key={field.key}>
                            <label className="text-xs uppercase tracking-[0.3em] text-neutral-2">
                              {field.label}
                            </label>
                            <p className="mt-1 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm">
                              {row.cells[field.key]?.value ?? "—"}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 grid gap-3 text-sm text-neutral-0 sm:grid-cols-2">
                        {OPTIONAL_FIELDS.map((field) => (
                          <div key={field.key}>
                            <label className="text-xs uppercase tracking-[0.3em] text-neutral-2">
                              {field.label}
                            </label>
                            <p className="mt-1 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm">
                              {row.cells[field.key]?.value ?? "—"}
                            </p>
                          </div>
                        ))}
                      </div>

                      {row.errors.length > 0 && (
                        <ul className="mt-4 space-y-2">
                          {row.errors.map((error, errorIdx) => (
                            <li
                              key={`${row.index}-error-${errorIdx}`}
                              className="rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-200"
                            >
                              {error}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={reset}
                    className="border border-white/15 bg-transparent text-neutral-0 hover:border-white/30"
                  >
                    {t("common.back", "Back")}
                  </Button>
                  <Button type="button" onClick={handleConfirm} disabled={parsing || pending}>
                    {parsing || pending
                      ? t("common.working", "Working…")
                      : t("common.import", "Import")}
                  </Button>
                </div>
              </div>
            )}

            {step === 2 && importMode === "sms" && (
              <div className="mt-6 space-y-4 text-sm text-neutral-0">
                <p className="text-sm text-neutral-0">
                  {t(
                    "statement.sms.instructions",
                    "We'll extract amounts, dates, and member references. Review the preview before confirming."
                  )}
                </p>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap text-xs text-neutral-2">
                    {smsInput}
                  </pre>
                </div>
                <div className="flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={reset}
                    className="border border-white/15 bg-transparent text-neutral-0 hover:border-white/30"
                  >
                    {t("common.back", "Back")}
                  </Button>
                  <Button type="button" onClick={handleSmsParse} disabled={smsParsing}>
                    {smsParsing ? t("common.working", "Working…") : t("common.import", "Import")}
                  </Button>
                </div>
              </div>
            )}

            {step === 3 && result && (
              <div className="mt-6 space-y-5">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex flex-col">
                      <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">
                        {t("statement.results.summary", "Import summary")}
                      </span>
                      <span className="text-lg font-semibold text-neutral-0">{message}</span>
                    </div>
                    <div className="ml-auto flex gap-2 text-xs">
                      <Link
                        href={result.reportUrl ?? "#"}
                        className="inline-flex items-center gap-1 rounded-full border border-white/15 px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-neutral-2 transition hover:border-white/30 hover:text-neutral-0"
                      >
                        {t("statement.results.download", "Download report")}
                      </Link>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <Button type="button" variant="secondary" onClick={reset}>
                    {t("common.done", "Done")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
