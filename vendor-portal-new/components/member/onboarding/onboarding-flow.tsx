"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Camera, CheckCircle2, FileUp, Loader2 } from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import {
  FormField,
  FormLayout,
  FormSummaryBanner,
  type FormSummaryStatus,
} from "@/components/ui/form";
import { Stepper } from "@/components/ui/stepper";
import {
  enqueueOnboardingSubmission,
  getOnboardingQueueStats,
  type OnboardingQueueStats,
} from "@/lib/offline/onboarding-queue";
import { requestBackgroundSync } from "@/lib/offline/sync";
import type { OnboardingOcrResult, OnboardingPayload } from "@/lib/member/onboarding";

type FormState = Pick<OnboardingPayload, "whatsapp_msisdn" | "momo_msisdn">;

type SummaryBannerState = {
  status: FormSummaryStatus;
  title: string;
  description?: string;
  items?: ReactNode[];
  kind?: "queue";
} | null;

const EMPTY_QUEUE_STATS: OnboardingQueueStats = {
  total: 0,
  pending: 0,
  syncing: 0,
  failed: 0,
};

export function OnboardingFlow() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>({ whatsapp_msisdn: "", momo_msisdn: "" });
  const [ocr, setOcr] = useState<OnboardingOcrResult | null>(null);
  const [documentStatus, setDocumentStatus] = useState<"idle" | "uploading">("idle");
  const [fieldErrors, setFieldErrors] = useState<{ whatsapp?: string; momo?: string }>({});
  const [summaryBanner, setSummaryBanner] = useState<SummaryBannerState>(null);
  const [isSubmitting, startSubmit] = useTransition();
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  const [queueCount, setQueueCount] = useState(0);
  const [queueBannerActive, setQueueBannerActive] = useState(false);
  const router = useRouter();

  const clearQueueBanner = useCallback(() => {
    setQueueBannerActive(false);
    setSummaryBanner((current) => (current?.kind === "queue" ? null : current));
  }, []);

  const applyQueueBanner = useCallback(
    (count: number, description?: string) => {
      if (count <= 0) {
        clearQueueBanner();
        return;
      }

      setQueueBannerActive(true);
      setSummaryBanner({
        kind: "queue",
        status: "info",
        title: count === 1 ? "Submission queued for sync" : `${count} submissions queued for sync`,
        description:
          description ??
          (isOnline
            ? "We're syncing your queued submissions now."
            : "We'll sync automatically once you're back online."),
      });
    },
    [clearQueueBanner, isOnline]
  );

  const refreshQueueStats = useCallback(async () => {
    try {
      const stats = await getOnboardingQueueStats();
      setQueueCount(stats.pending + stats.failed);
      return stats;
    } catch {
      setQueueCount(0);
      return EMPTY_QUEUE_STATS;
    }
  }, []);

  const updateSummary = useCallback(
    (banner: SummaryBannerState) => {
      if (queueBannerActive) {
        if (!banner || banner.kind !== "queue") {
          return;
        }
      }
      setSummaryBanner(banner);
    },
    [queueBannerActive]
  );

  const stepperSteps = useMemo(
    () => [
      {
        title: "Contact numbers",
        description:
          form.whatsapp_msisdn && form.momo_msisdn
            ? `WhatsApp ${form.whatsapp_msisdn} · MoMo ${form.momo_msisdn}`
            : "WhatsApp and MoMo numbers",
      },
      {
        title: "Identity document",
        description: ocr ? "ID processed" : "Upload an ID photo",
      },
      {
        title: "Review & confirm",
        description: "Verify contact and identity details",
      },
    ],
    [form.momo_msisdn, form.whatsapp_msisdn, ocr]
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const stats = await refreshQueueStats();
      if (!cancelled && stats.pending + stats.failed > 0) {
        applyQueueBanner(stats.pending + stats.failed);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applyQueueBanner, refreshQueueStats]);

  useEffect(() => {
    if (queueBannerActive) {
      applyQueueBanner(queueCount);
    }
  }, [applyQueueBanner, queueBannerActive, queueCount]);

  const validateContact = () => {
    const errors: { whatsapp?: string; momo?: string } = {};
    const msisdnPattern = /^\+?[0-9]{10,15}$/;
    if (!form.whatsapp_msisdn.trim()) {
      errors.whatsapp = "WhatsApp number is required.";
    } else if (!msisdnPattern.test(form.whatsapp_msisdn.trim())) {
      errors.whatsapp = "Enter a valid international number (e.g. +2507…).";
    }
    if (!form.momo_msisdn.trim()) {
      errors.momo = "MoMo number is required.";
    } else if (!msisdnPattern.test(form.momo_msisdn.trim())) {
      errors.momo = "Enter a valid international number (e.g. +2507…).";
    }
    setFieldErrors(errors);
    return errors;
  };

  const handleNext = () => {
    if (step === 0) {
      const errors = validateContact();
      if (errors.whatsapp || errors.momo) {
        const issues = Object.values(errors).filter(Boolean) as string[];
        updateSummary({
          status: "error",
          title: "Fix contact details",
          description: "Provide valid WhatsApp and MoMo numbers to continue.",
          items: issues,
        });
        return;
      }
      updateSummary(null);
      setStep(1);
      return;
    }

    if (step === 1) {
      if (documentStatus === "uploading") {
        updateSummary({
          status: "info",
          title: "Processing identity document",
          description: "Please wait until the ID finishes uploading.",
        });
        return;
      }
      if (!ocr) {
        updateSummary({
          status: "warning",
          title: "Upload an identity document",
          description: "Capture or upload an ID so we can pre-fill the member profile.",
        });
        return;
      }
      updateSummary({
        status: "info",
        title: "Review the extracted information",
        description: "Confirm the contact details and ID values before submitting.",
      });
      setStep(2);
      return;
    }
  };

  const handleBack = () => {
    updateSummary(null);
    setStep((index) => Math.max(0, index - 1));
  };

  const submit = () => {
    startSubmit(async () => {
      const payload: OnboardingPayload = {
        whatsapp_msisdn: form.whatsapp_msisdn,
        momo_msisdn: form.momo_msisdn,
        ocr_json: ocr ?? undefined,
      };

      if (!isOnline) {
        try {
          await enqueueOnboardingSubmission(payload);
          const stats = await refreshQueueStats();
          applyQueueBanner(stats.pending + stats.failed);
          await requestBackgroundSync();
        } catch (error) {
          clearQueueBanner();
          updateSummary({
            status: "error",
            title: "Failed to queue submission",
            description:
              error instanceof Error ? error.message : "Retry once connectivity is restored.",
          });
        }
        return;
      }

      clearQueueBanner();
      updateSummary({
        status: "info",
        title: "Submitting onboarding",
        description: "We are finalizing enrollment. This may take a few seconds.",
      });

      const response = await fetch("/api/member/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        updateSummary({
          status: "error",
          title: "Submission failed",
          description: "Retry in a few moments or contact support if the issue persists.",
        });
        return;
      }

      setQueueBannerActive(false);
      updateSummary({
        status: "success",
        title: "Member onboarded",
        description: "Redirecting to the member workspace…",
      });
      router.push("/member");
    });
  };

  const handleOcr = (result: OnboardingOcrResult | null) => {
    setOcr(result);
    if (result) {
      updateSummary({
        status: "success",
        title: "Identity document processed",
        description: "Review the detected fields before continuing.",
      });
    }
  };

  const contactStep = (
    <FormLayout variant="single" className="max-w-xl space-y-6">
      <FormField
        label="WhatsApp number"
        inputId="whatsapp-number"
        required
        description="We use WhatsApp for onboarding updates."
        error={fieldErrors.whatsapp}
      >
        {({ id, describedBy }) => (
          <input
            id={id}
            className="w-full rounded-[calc(var(--radius-xl)_*_0.9)] border border-white/20 bg-black/30 px-4 py-3 text-base text-neutral-0 transition focus:border-emerald-400 focus:outline-none"
            placeholder="e.g. +2507…"
            value={form.whatsapp_msisdn}
            onChange={(event) => {
              const value = event.target.value;
              setForm((prev) => ({ ...prev, whatsapp_msisdn: value }));
              setFieldErrors((prev) => ({ ...prev, whatsapp: undefined }));
            }}
            aria-invalid={Boolean(fieldErrors.whatsapp)}
            aria-describedby={describedBy}
          />
        )}
      </FormField>
      <FormField
        label="MoMo number"
        inputId="momo-number"
        required
        description="We send disbursements to this number."
        error={fieldErrors.momo}
      >
        {({ id, describedBy }) => (
          <input
            id={id}
            className="w-full rounded-[calc(var(--radius-xl)_*_0.9)] border border-white/20 bg-black/30 px-4 py-3 text-base text-neutral-0 transition focus:border-emerald-400 focus:outline-none"
            placeholder="e.g. +2507…"
            value={form.momo_msisdn}
            onChange={(event) => {
              const value = event.target.value;
              setForm((prev) => ({ ...prev, momo_msisdn: value }));
              setFieldErrors((prev) => ({ ...prev, momo: undefined }));
            }}
            aria-invalid={Boolean(fieldErrors.momo)}
            aria-describedby={describedBy}
          />
        )}
      </FormField>
    </FormLayout>
  );

  const documentStep = (
    <DocumentUploader onUploaded={handleOcr} onStatusChange={setDocumentStatus} />
  );

  const reviewStep = <ReviewPanel form={form} ocr={ocr} />;

  const stepContent = [contactStep, documentStep, reviewStep][step];

  const queueMessage =
    queueCount > 0
      ? `${queueCount} offline submission${queueCount === 1 ? "" : "s"} awaiting sync`
      : isOnline
        ? "Offline submissions are queued automatically."
        : "Offline mode: submissions will queue until you're back online.";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Member onboarding"
        description="Guide new members through contact verification, identity capture, and final confirmation."
        metadata={<span className="text-xs text-neutral-3">{queueMessage}</span>}
      />

      <Stepper
        steps={stepperSteps}
        currentStep={step}
        onStepChange={(index) => setStep((current) => (index <= current ? index : current))}
      />

      {summaryBanner ? (
        <FormSummaryBanner
          status={summaryBanner.status}
          title={summaryBanner.title}
          description={summaryBanner.description}
          items={summaryBanner.items}
        />
      ) : null}

      <div className="rounded-[calc(var(--radius-xl)_*_1.1)] border border-white/15 bg-white/10 p-6 text-neutral-0 shadow-glass">
        {stepContent}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold uppercase tracking-[0.3em] text-neutral-0 transition hover:border-white/40 hover:text-neutral-0 disabled:opacity-40"
          onClick={handleBack}
          disabled={step === 0 || isSubmitting}
        >
          Back
        </button>
        {step < stepperSteps.length - 1 ? (
          <button
            type="button"
            className="rounded-full bg-emerald-500/80 px-5 py-2 text-sm font-semibold uppercase tracking-[0.3em] text-neutral-0 transition hover:bg-emerald-500 disabled:opacity-50"
            onClick={handleNext}
            disabled={isSubmitting}
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            className="flex items-center gap-2 rounded-full bg-emerald-500/80 px-6 py-2 text-sm font-semibold uppercase tracking-[0.3em] text-neutral-0 transition hover:bg-emerald-500 disabled:opacity-50"
            onClick={submit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <CheckCircle2 className="h-4 w-4" aria-hidden />
            )}
            Finish onboarding
          </button>
        )}
      </footer>
    </div>
  );
}

interface DocumentUploaderProps {
  onUploaded: (result: OnboardingOcrResult | null) => void;
  onStatusChange?: (status: "idle" | "uploading") => void;
}

function DocumentUploader({ onUploaded, onStatusChange }: DocumentUploaderProps) {
  const [isUploading, startUpload] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<OnboardingOcrResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = (file: File | null) => {
    if (!file) {
      return;
    }
    setError(null);
    onStatusChange?.("uploading");

    const formData = new FormData();
    formData.append("document", file);

    startUpload(async () => {
      try {
        const response = await fetch("/api/member/ocr/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? "Upload failed. Try again.");
        }

        const data = (await response.json()) as { ocr: OnboardingOcrResult };
        setPreview(data.ocr);
        onUploaded(data.ocr);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed. Try again.";
        setPreview(null);
        setError(message);
        onUploaded(null);
      } finally {
        onStatusChange?.("idle");
      }
    });
  };

  return (
    <div className="space-y-4 text-neutral-0">
      {error ? (
        <FormSummaryBanner status="error" title="Document upload failed" description={error} />
      ) : null}
      {isUploading ? (
        <FormSummaryBanner
          status="info"
          title="Processing document"
          description="We are extracting details from the uploaded ID."
        />
      ) : null}
      {preview && !isUploading && !error ? (
        <FormSummaryBanner
          status="success"
          title="Identity detected"
          description="Review the extracted fields below before continuing."
        />
      ) : null}

      <div className="flex flex-col items-center justify-center gap-3 rounded-[calc(var(--radius-xl)_*_1.1)] border border-dashed border-white/25 bg-white/5 p-8 text-center">
        <Camera className="h-10 w-10" aria-hidden />
        <span className="text-lg font-semibold">Capture or upload your ID</span>
        <span className="text-sm text-white/70">
          We support National ID, Driver’s License, or Passport.
        </span>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-neutral-0 transition hover:border-white/40 hover:text-neutral-0"
        >
          <FileUp className="h-4 w-4" aria-hidden /> Choose file
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => upload(event.target.files?.[0] ?? null)}
        />
      </div>

      {preview ? <Preview ocr={preview} /> : null}
    </div>
  );
}

interface ReviewPanelProps {
  form: OnboardingPayload;
  ocr: OnboardingOcrResult | null;
}

function ReviewPanel({ form, ocr }: ReviewPanelProps) {
  return (
    <div className="space-y-6 text-neutral-0">
      <FormSummaryBanner
        status="info"
        title="Confirm the details below"
        description="We’ll queue the submission if you’re offline and sync once you reconnect."
      />
      <section>
        <h3 className="text-lg font-semibold">Contact</h3>
        <dl className="mt-2 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-white/70">WhatsApp</dt>
            <dd className="text-base font-semibold">{form.whatsapp_msisdn || "—"}</dd>
          </div>
          <div>
            <dt className="text-white/70">MoMo</dt>
            <dd className="text-base font-semibold">{form.momo_msisdn || "—"}</dd>
          </div>
        </dl>
      </section>
      <section>
        <h3 className="text-lg font-semibold">Identity</h3>
        {ocr ? (
          <dl className="mt-2 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-white/70">Name</dt>
              <dd className="text-base font-semibold">{ocr.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-white/70">ID number</dt>
              <dd className="text-base font-semibold">{ocr.idNumber ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-white/70">Date of birth</dt>
              <dd className="text-base font-semibold">{ocr.dob ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-white/70">Sex</dt>
              <dd className="text-base font-semibold">{ocr.sex ?? "—"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-white/70">Address</dt>
              <dd className="text-base font-semibold">{ocr.address ?? "—"}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-white/70">
            Upload an ID document to see the extracted fields.
          </p>
        )}
      </section>
    </div>
  );
}

function Preview({ ocr }: { ocr: OnboardingOcrResult | null }) {
  if (!ocr) {
    return null;
  }

  return (
    <div className="rounded-[calc(var(--radius-xl)_*_1.1)] border border-white/15 bg-white/6 p-4 text-sm text-neutral-0">
      <p className="font-semibold">Detected information</p>
      <ul className="mt-2 space-y-1 text-white/80">
        <li>Name: {ocr.name ?? "—"}</li>
        <li>ID: {ocr.idNumber ?? "—"}</li>
        <li>DOB: {ocr.dob ?? "—"}</li>
        <li>Sex: {ocr.sex ?? "—"}</li>
        <li>Address: {ocr.address ?? "—"}</li>
      </ul>
    </div>
  );
}
