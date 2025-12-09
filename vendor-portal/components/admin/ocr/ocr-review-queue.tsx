"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useTranslation } from "@/providers/i18n-provider";
import { useToast } from "@/providers/toast-provider";
import { resolveOcrReview } from "@/app/(main)/admin/actions";
import { StatusChip } from "@/components/common/status-chip";

export interface OcrReviewItem {
  userId: string;
  saccoId: string | null;
  saccoName: string | null;
  msisdn: string | null;
  idType: string | null;
  idNumber: string | null;
  confidence: number | null;
  ocrFields: Record<string, unknown> | null;
  documentUrl: string | null;
  updatedAt: string | null;
}

interface OcrReviewQueueProps {
  items: OcrReviewItem[];
}

const CONFIDENCE_THRESHOLD = 0.82;

export function OcrReviewQueue({ items }: OcrReviewQueueProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [entries, setEntries] = useState(items);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [note, setNote] = useState("");

  const selected = entries[selectedIndex] ?? null;
  const confidenceStatus = selected?.confidence ?? null;

  useEffect(() => {
    if (entries.length === 0) {
      setSelectedIndex(0);
      return;
    }
    setSelectedIndex((index) => Math.max(0, Math.min(index, entries.length - 1)));
  }, [entries.length]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!selected) return;
      if (event.key.toLowerCase() === "a") {
        event.preventDefault();
        handleDecision("accept");
      }
      if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        handleDecision("rescan");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, note, entries]);

  const handleDecision = (decision: "accept" | "rescan") => {
    if (!selected) return;
    startTransition(async () => {
      const result = await resolveOcrReview({
        memberUserId: selected.userId,
        decision,
        note: decision === "rescan" ? note : undefined,
      });
      if (result.status === "error") {
        toast.error(result.message ?? t("common.operationFailed", "Operation failed"));
        return;
      }
      toast.success(result.message ?? t("admin.ocr.reviewCompleted", "Review recorded"));
      setEntries((prev) => prev.filter((item) => item.userId !== selected.userId));
      setNote("");
    });
  };

  const detailFields = useMemo(() => {
    if (!selected) return [] as Array<{ key: string; value: string }>;
    const fields = selected.ocrFields ?? {};
    return Object.entries(fields)
      .filter(
        ([key]) =>
          ![
            "source",
            "response_id",
            "model",
            "received_at",
            "confidence",
            "status",
            "reviewed_at",
            "reviewer",
            "note",
          ].includes(key)
      )
      .map(([key, value]) => ({ key, value: String(value ?? "") }));
  }, [selected]);

  if (entries.length === 0) {
    return (
      <p className="text-sm text-neutral-2">
        {t("admin.ocr.empty", "No OCR submissions require review right now.")}
      </p>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
      <aside className="space-y-3">
        {entries.map((entry, index) => {
          const isActive = index === selectedIndex;
          const statusTone =
            (entry.confidence ?? 0) >= CONFIDENCE_THRESHOLD ? "success" : "warning";
          return (
            <button
              key={entry.userId}
              type="button"
              onClick={() => {
                setSelectedIndex(index);
                setNote("");
              }}
              className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition ${
                isActive
                  ? "border-kigali bg-kigali/10 text-neutral-0"
                  : "border-white/10 bg-white/5 text-neutral-1 hover:border-white/20"
              }`}
            >
              <p className="font-semibold text-neutral-0">
                {entry.saccoName ?? t("admin.ocr.unknownSacco", "Unassigned")}
              </p>
              <p className="text-xs text-neutral-3">{entry.msisdn ?? "—"}</p>
              <div className="mt-2">
                <StatusChip tone={statusTone}>
                  {entry.confidence !== null
                    ? t("admin.ocr.confidence", "Confidence {{value}}", {
                        value: Math.round(entry.confidence * 100),
                      })
                    : t("admin.ocr.confidenceUnknown", "No confidence")}
                </StatusChip>
              </div>
            </button>
          );
        })}
      </aside>

      {selected && (
        <section className="space-y-6">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-neutral-0">
                {selected.saccoName ?? t("admin.ocr.unknownSacco", "Unassigned")}
              </p>
              <p className="text-xs text-neutral-3">
                {selected.msisdn ?? "—"} ·{" "}
                {selected.updatedAt ? new Date(selected.updatedAt).toLocaleString() : "—"}
              </p>
            </div>
            <StatusChip
              tone={
                confidenceStatus && confidenceStatus >= CONFIDENCE_THRESHOLD ? "success" : "warning"
              }
            >
              {confidenceStatus !== null
                ? t("admin.ocr.confidence", "Confidence {{value}}", {
                    value: Math.round(confidenceStatus * 100),
                  })
                : t("admin.ocr.confidenceUnknown", "No confidence")}
            </StatusChip>
          </header>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40">
              {selected.documentUrl ? (
                <Image
                  src={selected.documentUrl}
                  alt={t("admin.ocr.documentPreview", "ID document preview")}
                  width={640}
                  height={420}
                  className="h-full w-full object-contain"
                />
              ) : (
                <p className="p-6 text-sm text-neutral-2">
                  {t("admin.ocr.noImage", "No ID image available. Request a rescan.")}
                </p>
              )}
            </div>
            <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t("admin.ocr.idType", "ID type")}>{selected.idType ?? "—"}</Field>
                <Field label={t("admin.ocr.idNumber", "ID number")}>
                  {selected.idNumber ?? "—"}
                </Field>
              </div>
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.3em] text-neutral-3">
                  {t("admin.ocr.extracted", "Extracted fields")}
                </p>
                <dl className="grid gap-2 sm:grid-cols-2">
                  {detailFields.map((field) => (
                    <div
                      key={field.key}
                      className="rounded-xl border border-white/10 bg-white/10 p-3 text-xs text-neutral-0"
                    >
                      <dt className="uppercase tracking-[0.2em] text-neutral-3">{field.key}</dt>
                      <dd className="mt-1 text-sm text-neutral-0">{field.value || "—"}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.3em] text-neutral-3">
                {t("admin.ocr.reviewNote", "Review note (for rescans)")}
              </span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue"
              />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => handleDecision("accept")}
                disabled={pending}
                className="interactive-scale rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-neutral-0 shadow-glass disabled:opacity-60"
              >
                {pending
                  ? t("common.processing", "Processing…")
                  : t("admin.ocr.accept", "Accept (A)")}
              </button>
              <button
                type="button"
                onClick={() => handleDecision("rescan")}
                disabled={pending}
                className="interactive-scale rounded-full bg-rose-500 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-neutral-0 shadow-glass disabled:opacity-60"
              >
                {pending
                  ? t("common.processing", "Processing…")
                  : t("admin.ocr.rescan", "Request rescan (R)")}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.3em] text-neutral-3">{label}</p>
      <p className="mt-1 text-sm text-neutral-0">{children}</p>
    </div>
  );
}
