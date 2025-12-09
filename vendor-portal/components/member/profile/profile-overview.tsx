"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  type MemberGroupRow,
  type MemberJoinRequestRow,
  type MemberLoanApplication,
  type MemberProfileRow,
  type MemberSaccoRow,
} from "@/lib/member/data";
import { useAtlasAssistant } from "@/providers/atlas-assistant-provider";
import { useToast } from "@/providers/toast-provider";
import { Input } from "@/components/ui/input";

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "rw", label: "Kinyarwanda" },
  { value: "fr", label: "Français" },
] as const;

type LanguageValue = (typeof LANGUAGE_OPTIONS)[number]["value"];

type TabKey = "Accounts" | "Loans" | "Documents" | "Activity";

const TABS: TabKey[] = ["Accounts", "Loans", "Documents", "Activity"];

const LOAN_STAGES: Array<{
  key: string;
  label: string;
  tone: "info" | "success" | "warning" | "neutral";
}> = [
  { key: "DRAFT", label: "Draft", tone: "neutral" },
  { key: "SUBMITTED", label: "Submitted", tone: "info" },
  { key: "RECEIVED", label: "Received", tone: "info" },
  { key: "UNDER_REVIEW", label: "Under review", tone: "info" },
  { key: "APPROVED", label: "Approved", tone: "success" },
  { key: "DISBURSED", label: "Disbursed", tone: "success" },
  { key: "DECLINED", label: "Declined", tone: "warning" },
  { key: "CANCELLED", label: "Cancelled", tone: "neutral" },
];

const currencyFormatter = new Intl.NumberFormat("en-RW", {
  style: "currency",
  currency: "RWF",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("en-RW", {
  dateStyle: "medium",
  timeStyle: "short",
});

interface ProfileOverviewProps {
  profile: MemberProfileRow | null;
  email: string | null;
  saccos: MemberSaccoRow[];
  groups: MemberGroupRow[];
  joinRequests: MemberJoinRequestRow[];
  loans: MemberLoanApplication[];
}

interface FormState {
  whatsapp: string;
  momo: string;
  lang: LanguageValue;
}

interface DiffEntry {
  field: string;
  current: string;
  next: string;
}

export function ProfileOverview({
  profile,
  email,
  saccos,
  groups,
  joinRequests,
  loans,
}: ProfileOverviewProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("Accounts");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerStep, setDrawerStep] = useState<"form" | "review" | "submitting" | "complete">(
    "form"
  );
  const [formState, setFormState] = useState<FormState>({ whatsapp: "", momo: "", lang: "en" });
  const [diff, setDiff] = useState<DiffEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { setContext } = useAtlasAssistant();
  const { success, error: toastError } = useToast();
  const router = useRouter();

  const metrics = useMemo(
    () => [
      { label: "Linked SACCOs", value: saccos.length },
      { label: "Active groups", value: groups.length },
      {
        label: "Pending approvals",
        value: joinRequests.filter((request) => request.status !== "approved").length,
      },
      {
        label: "Loan requests",
        value: loans.length,
      },
    ],
    [groups.length, joinRequests, loans.length, saccos.length]
  );

  const initialForm = useMemo<FormState>(
    () => ({
      whatsapp: profile?.whatsapp_msisdn ?? "",
      momo: profile?.momo_msisdn ?? "",
      lang: resolveLanguage(profile?.lang),
    }),
    [profile]
  );

  useEffect(() => {
    setFormState(initialForm);
  }, [initialForm]);

  useEffect(() => {
    const activeLoans = loans.filter(
      (loan) => loan.status !== "DECLINED" && loan.status !== "CANCELLED"
    ).length;
    setContext({
      title: "Member profile",
      subtitle: profile
        ? `${profile.whatsapp_msisdn || "No WhatsApp"} · ${profile.momo_msisdn || "No MoMo"}`
        : "Profile not completed",
      metadata: {
        Email: email ?? "—",
        SACCOs: String(saccos.length),
        Groups: String(groups.length),
        "Join requests": String(joinRequests.length),
        "Active loans": String(activeLoans),
      },
    });
  }, [email, groups.length, joinRequests.length, loans, profile, saccos.length, setContext]);

  useEffect(() => () => setContext(null), [setContext]);

  const loanStageSummary = useMemo(() => {
    const accumulator = new Map<
      string,
      {
        key: string;
        label: string;
        tone: "info" | "success" | "warning" | "neutral";
        items: MemberLoanApplication[];
      }
    >();
    for (const stage of LOAN_STAGES) {
      accumulator.set(stage.key, { ...stage, items: [] });
    }
    for (const loan of loans) {
      if (!accumulator.has(loan.status)) {
        accumulator.set(loan.status, {
          key: loan.status,
          label: toTitleCase(loan.status),
          tone: "neutral",
          items: [],
        });
      }
      accumulator.get(loan.status)!.items.push(loan);
    }
    return Array.from(accumulator.values());
  }, [loans]);

  const timeline = useMemo(() => {
    return [...joinRequests]
      .sort((a, b) => {
        const first = a.created_at ? new Date(a.created_at).getTime() : 0;
        const second = b.created_at ? new Date(b.created_at).getTime() : 0;
        return second - first;
      })
      .map((entry) => ({
        id: entry.id,
        status: entry.status,
        createdAt: entry.created_at,
        saccoId: entry.sacco_id,
        groupId: entry.group_id,
        note: entry.note ?? null,
      }));
  }, [joinRequests]);

  const handleDrawerOpen = () => {
    setFormState(initialForm);
    setDiff([]);
    setError(null);
    setDrawerStep("form");
    setDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setDrawerOpen(false);
    setDrawerStep("form");
    setError(null);
  };

  const handleFormChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setFormState((current) => ({ ...current, [name]: value }));
  };

  const handleFormSubmit = (event: FormEvent) => {
    event.preventDefault();
    const changes: DiffEntry[] = [];
    if (normalizeValue(formState.whatsapp) !== normalizeValue(initialForm.whatsapp)) {
      changes.push({
        field: "WhatsApp number",
        current: displayValue(initialForm.whatsapp),
        next: displayValue(formState.whatsapp),
      });
    }
    if (normalizeValue(formState.momo) !== normalizeValue(initialForm.momo)) {
      changes.push({
        field: "MoMo number",
        current: displayValue(initialForm.momo),
        next: displayValue(formState.momo),
      });
    }
    if (formState.lang !== initialForm.lang) {
      const currentLabel =
        LANGUAGE_OPTIONS.find((option) => option.value === initialForm.lang)?.label ?? "Not set";
      const nextLabel =
        LANGUAGE_OPTIONS.find((option) => option.value === formState.lang)?.label ??
        formState.lang.toUpperCase();
      changes.push({ field: "Preferred language", current: currentLabel, next: nextLabel });
    }

    if (changes.length === 0) {
      setError("No changes to review yet. Update a field before continuing.");
      return;
    }

    setDiff(changes);
    setError(null);
    setDrawerStep("review");
  };

  const handleConfirm = async () => {
    setDrawerStep("submitting");
    setError(null);
    try {
      const response = await fetch("/api/member/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          whatsapp_msisdn: formState.whatsapp,
          momo_msisdn: formState.momo,
          preferred_language: formState.lang,
          ocr_json: profile?.ocr_json ?? null,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Failed to update profile");
      }

      success("Profile updated successfully");
      setDrawerStep("complete");
      router.refresh();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Unable to update profile";
      toastError(message);
      setError(message);
      setDrawerStep("review");
    }
  };

  return (
    <section className="space-y-8 text-neutral-0">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-black/10">
        <div className="flex flex-col gap-6 md:flex-row md:justify-between">
          <div className="flex-1 space-y-3">
            <p className="text-xs uppercase tracking-[0.3em] text-white/50">Contact details</p>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <DetailField label="Email" value={email ?? "—"} />
              <DetailField label="WhatsApp" value={profile?.whatsapp_msisdn ?? "—"} />
              <DetailField label="MoMo" value={profile?.momo_msisdn ?? "—"} />
              <DetailField
                label="Preferred language"
                value={
                  LANGUAGE_OPTIONS.find((option) => option.value === resolveLanguage(profile?.lang))
                    ?.label ?? "English"
                }
              />
            </dl>
            <button
              type="button"
              onClick={handleDrawerOpen}
              className="mt-2 inline-flex w-fit items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              Manage advanced settings
            </button>
          </div>
          <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4 md:max-w-lg">
            {metrics.map((metric) => (
              <div
                key={metric.label}
                className="rounded-2xl border border-white/10 bg-white/10 p-4 text-center"
              >
                <p className="text-xs uppercase tracking-[0.3em] text-white/50">{metric.label}</p>
                <p className="mt-2 text-2xl font-semibold text-white">{metric.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
        <nav aria-label="Profile detail tabs" className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-semibold transition",
                activeTab === tab
                  ? "bg-atlas-blue text-white shadow-atlas"
                  : "bg-white/10 text-white/70 hover:bg-white/20"
              )}
            >
              {tab}
            </button>
          ))}
        </nav>
        <div className="mt-6">
          {activeTab === "Accounts" && <AccountsPanel saccos={saccos} groups={groups} />}
          {activeTab === "Loans" && <LoansPanel stages={loanStageSummary} />}
          {activeTab === "Documents" && <DocumentsPanel profile={profile} />}
          {activeTab === "Activity" && <ActivityPanel timeline={timeline} />}
        </div>
      </div>

      {drawerOpen && (
        <AdvancedSettingsDrawer
          step={drawerStep}
          formState={formState}
          onChange={handleFormChange}
          onSubmit={handleFormSubmit}
          onClose={handleDrawerClose}
          onBack={() => {
            setError(null);
            setDrawerStep("form");
          }}
          diff={diff}
          error={error}
          onConfirm={handleConfirm}
        />
      )}
    </section>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.3em] text-white/50">{label}</dt>
      <dd className="mt-1 text-base text-white">{value}</dd>
    </div>
  );
}

function AccountsPanel({ saccos, groups }: { saccos: MemberSaccoRow[]; groups: MemberGroupRow[] }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-white/10 bg-white/8 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70">
          Linked SACCOs
        </h3>
        {saccos.length === 0 ? (
          <p className="mt-3 text-sm text-white/60">
            No SACCOs linked yet. Link a SACCO to discover ikimina groups.
          </p>
        ) : (
          <ul className="mt-3 space-y-3 text-sm">
            {saccos.map((sacco) => (
              <li key={sacco.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="font-semibold text-white">{sacco.name}</p>
                <p className="text-xs text-white/60">
                  {sacco.district} · {sacco.province}
                </p>
                {sacco.category && (
                  <span className="mt-2 inline-flex rounded-full bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-white/70">
                    {sacco.category}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="rounded-2xl border border-white/10 bg-white/8 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70">
          Ikimina groups
        </h3>
        {groups.length === 0 ? (
          <p className="mt-3 text-sm text-white/60">You have not joined any groups yet.</p>
        ) : (
          <ul className="mt-3 space-y-3 text-sm">
            {groups.map((group) => (
              <li key={group.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="font-semibold text-white">{group.name ?? "Unnamed group"}</p>
                <p className="text-xs text-white/60">{group.code ?? "No code"}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function LoansPanel({
  stages,
}: {
  stages: Array<{
    key: string;
    label: string;
    tone: "info" | "success" | "warning" | "neutral";
    items: MemberLoanApplication[];
  }>;
}) {
  const total = stages.reduce((sum, stage) => sum + stage.items.length, 0);
  if (total === 0) {
    return (
      <p className="text-sm text-white/60">
        No loan applications yet. Explore products from the Loans pipeline.
      </p>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
      {stages.map((stage) => (
        <article key={stage.key} className="rounded-2xl border border-white/10 bg-white/8 p-4">
          <header className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-white">{stage.label}</h4>
            <span
              className={cn(
                "rounded-full px-2 py-1 text-xs font-semibold uppercase tracking-[0.2em]",
                stage.tone === "success"
                  ? "bg-emerald-500/20 text-emerald-200"
                  : stage.tone === "warning"
                    ? "bg-amber-500/20 text-amber-100"
                    : stage.tone === "info"
                      ? "bg-sky-500/20 text-sky-100"
                      : "bg-white/10 text-white/70"
              )}
            >
              {stage.items.length}
            </span>
          </header>
          <ul className="mt-3 space-y-2 text-xs text-white/80">
            {stage.items.slice(0, 4).map((loan) => (
              <li key={loan.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="font-semibold text-sm text-white">
                  {loan.productName ?? "Loan request"}
                </p>
                <p className="mt-1 text-xs text-white/60">
                  {currencyFormatter.format(loan.requestedAmount ?? 0)} · {loan.tenorMonths ?? "?"}{" "}
                  months
                </p>
                <p className="text-[11px] uppercase tracking-[0.3em] text-white/40">
                  Updated {loan.statusUpdatedAt ? relativeDate(loan.statusUpdatedAt) : "Recently"}
                </p>
              </li>
            ))}
            {stage.items.length > 4 && (
              <li className="rounded-xl border border-dashed border-white/20 p-3 text-center text-white/50">
                +{stage.items.length - 4} more in {stage.label.toLowerCase()}
              </li>
            )}
          </ul>
        </article>
      ))}
    </div>
  );
}

function DocumentsPanel({ profile }: { profile: MemberProfileRow | null }) {
  if (!profile) {
    return (
      <p className="text-sm text-white/60">
        Complete onboarding to upload identification documents.
      </p>
    );
  }

  const documents = Array.isArray(profile.id_files)
    ? (profile.id_files as Array<{ type?: string; url?: string }>)
    : [];

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-white/10 bg-white/8 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70">
          Identity details
        </h3>
        <dl className="mt-3 grid gap-4 text-sm sm:grid-cols-2">
          <DetailField label="ID type" value={profile.id_type ?? "—"} />
          <DetailField label="ID number" value={profile.id_number ?? "—"} />
          <DetailField label="OCR status" value={resolveOcrStatus(profile)} />
          <DetailField
            label="Last updated"
            value={profile.updated_at ? relativeDate(profile.updated_at) : "—"}
          />
        </dl>
      </section>
      <section className="rounded-2xl border border-white/10 bg-white/8 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70">
          Uploaded documents
        </h3>
        {documents.length === 0 ? (
          <p className="mt-2 text-sm text-white/60">No documents uploaded yet.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {documents.map((document, index) => (
              <li key={index} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="font-semibold text-white">
                  {document.type ?? `Document ${index + 1}`}
                </p>
                {document.url && (
                  <a
                    href={document.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-sky-200 underline"
                  >
                    View file
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ActivityPanel({
  timeline,
}: {
  timeline: Array<{
    id: string;
    status: string;
    createdAt: string | null;
    saccoId: string;
    groupId: string;
    note: string | null;
  }>;
}) {
  if (timeline.length === 0) {
    return <p className="text-sm text-white/60">No activity recorded yet.</p>;
  }

  return (
    <ol className="space-y-3">
      {timeline.map((entry) => (
        <li key={entry.id} className="rounded-2xl border border-white/10 bg-white/8 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-white">{toTitleCase(entry.status)}</p>
            <p className="text-xs text-white/50">
              {entry.createdAt ? dateFormatter.format(new Date(entry.createdAt)) : "—"}
            </p>
          </div>
          <p className="mt-2 text-xs text-white/60">SACCO: {entry.saccoId || "—"}</p>
          <p className="text-xs text-white/60">Group: {entry.groupId || "—"}</p>
          {entry.note && <p className="mt-2 text-sm text-white/80">{entry.note}</p>}
        </li>
      ))}
    </ol>
  );
}

interface AdvancedSettingsDrawerProps {
  step: "form" | "review" | "submitting" | "complete";
  formState: FormState;
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onSubmit: (event: FormEvent) => void;
  onClose: () => void;
  onBack: () => void;
  diff: DiffEntry[];
  error: string | null;
  onConfirm: () => void;
}

function AdvancedSettingsDrawer({
  step,
  formState,
  onChange,
  onSubmit,
  onClose,
  onBack,
  diff,
  error,
  onConfirm,
}: AdvancedSettingsDrawerProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-neutral-950/95 p-6 text-neutral-0 shadow-2xl">
        <header className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Advanced settings</h2>
            <p className="text-sm text-white/60">Update contact numbers and preferred language.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/10 p-2 text-white/70 transition hover:bg-white/20"
            aria-label="Close advanced settings"
          >
            ×
          </button>
        </header>

        {step === "form" && (
          <form onSubmit={onSubmit} className="mt-6 space-y-4 text-sm">
            <Input
              label="WhatsApp number"
              name="whatsapp"
              value={formState.whatsapp}
              onChange={onChange}
              placeholder="e.g. 25078..."
              required
            />
            <Input
              label="MoMo number"
              name="momo"
              value={formState.momo}
              onChange={onChange}
              placeholder="e.g. 25078..."
              required
            />
            <label className="flex flex-col gap-2 text-sm text-neutral-0">
              <span className="text-xs uppercase tracking-[0.3em] text-white/50">
                Preferred language
              </span>
              <select
                name="lang"
                value={formState.lang}
                onChange={onChange}
                className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-atlas-blue"
              >
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {error && <p className="text-sm text-amber-300">{error}</p>}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/70 transition hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-atlas-blue px-4 py-2 text-sm font-semibold text-white shadow-atlas transition hover:bg-atlas-blue-dark"
              >
                Review changes
              </button>
            </div>
          </form>
        )}

        {step === "review" && (
          <div className="mt-6 space-y-4 text-sm">
            <p className="text-white/70">Confirm the updates below before applying them.</p>
            <dl className="space-y-3">
              {diff.map((entry) => (
                <div
                  key={entry.field}
                  className="rounded-2xl border border-white/10 bg-white/5 p-3"
                >
                  <dt className="text-xs uppercase tracking-[0.3em] text-white/40">
                    {entry.field}
                  </dt>
                  <dd className="mt-1 text-sm text-white">
                    <span className="text-white/50">Current:</span> {entry.current}
                  </dd>
                  <dd className="text-sm text-atlas-blue">
                    <span className="text-white/50">New:</span> {entry.next}
                  </dd>
                </div>
              ))}
            </dl>
            {error && <p className="text-sm text-amber-300">{error}</p>}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={onBack}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/70 transition hover:bg-white/10"
              >
                Back
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="rounded-xl bg-atlas-blue px-4 py-2 text-sm font-semibold text-white shadow-atlas transition hover:bg-atlas-blue-dark"
              >
                Confirm &amp; update
              </button>
            </div>
          </div>
        )}

        {step === "submitting" && (
          <div className="mt-6 space-y-3 text-sm text-white/70">
            <p>Applying updates…</p>
            <p className="text-xs text-white/40">
              Please wait while we secure your profile changes.
            </p>
          </div>
        )}

        {step === "complete" && (
          <div className="mt-6 space-y-4 text-sm">
            <p className="text-white">Your profile was updated successfully.</p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-atlas-blue px-4 py-2 text-sm font-semibold text-white shadow-atlas transition hover:bg-atlas-blue-dark"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Helpers

function resolveLanguage(value: string | null | undefined): LanguageValue {
  const normalized = (value ?? "en").toLowerCase();
  return LANGUAGE_OPTIONS.some((option) => option.value === normalized)
    ? (normalized as LanguageValue)
    : "en";
}

function relativeDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / (1000 * 60));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return dateFormatter.format(date);
}

function displayValue(value: string) {
  return value && value.length > 0 ? value : "—";
}

function normalizeValue(value: string) {
  return value.replace(/\s+/g, "");
}

function toTitleCase(value: string) {
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function resolveOcrStatus(profile: MemberProfileRow) {
  const status = (profile.ocr_json as Record<string, unknown> | null)?.status;
  if (typeof status === "string" && status.length > 0) {
    return toTitleCase(status);
  }
  return profile.id_number ? "Verified manually" : "Pending";
}
