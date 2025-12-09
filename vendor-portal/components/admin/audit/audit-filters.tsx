"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/providers/i18n-provider";

export interface AuditFiltersState {
  action: string;
  entity: string;
  actor: string;
  from: string;
  to: string;
}

interface AuditFiltersProps {
  initial: AuditFiltersState;
}

export function AuditFilters({ initial }: AuditFiltersProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<AuditFiltersState>(initial);

  const canReset = useMemo(
    () => Object.values(state).some((value) => value.trim().length > 0),
    [state]
  );

  const update = <K extends keyof AuditFiltersState>(key: K, value: AuditFiltersState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const search = new URLSearchParams();
    Object.entries(state).forEach(([key, value]) => {
      if (value && value.trim().length > 0) {
        search.set(key, value.trim());
      }
    });
    startTransition(() => {
      router.replace(`?${search.toString()}`);
    });
  };

  const handleReset = () => {
    if (!canReset) return;
    setState({ action: "", entity: "", actor: "", from: "", to: "" });
    startTransition(() => {
      router.replace("?");
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs uppercase tracking-[0.3em] text-neutral-3">
            {t("admin.audit.filters.action", "Action")}
          </span>
          <input
            type="text"
            value={state.action}
            onChange={(event) => update("action", event.target.value)}
            placeholder="OCR_ACCEPTED"
            className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs uppercase tracking-[0.3em] text-neutral-3">
            {t("admin.audit.filters.entity", "Entity")}
          </span>
          <input
            type="text"
            value={state.entity}
            onChange={(event) => update("entity", event.target.value)}
            placeholder="MEMBER_PROFILE"
            className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs uppercase tracking-[0.3em] text-neutral-3">
            {t("admin.audit.filters.actor", "Actor")}
          </span>
          <input
            type="text"
            value={state.actor}
            onChange={(event) => update("actor", event.target.value)}
            placeholder="user@domain"
            className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs uppercase tracking-[0.3em] text-neutral-3">
              {t("admin.audit.filters.from", "From")}
            </span>
            <input
              type="date"
              value={state.from}
              onChange={(event) => update("from", event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs uppercase tracking-[0.3em] text-neutral-3">
              {t("admin.audit.filters.to", "To")}
            </span>
            <input
              type="date"
              value={state.to}
              onChange={(event) => update("to", event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue"
            />
          </label>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="interactive-scale rounded-full bg-kigali px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-ink shadow-glass disabled:opacity-60"
        >
          {pending ? t("common.applying", "Applying…") : t("common.apply", "Apply")}
        </button>
        <button
          type="button"
          onClick={handleReset}
          disabled={!canReset || pending}
          className="rounded-full border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-neutral-3 transition hover:border-white/30 hover:text-neutral-0 disabled:opacity-60"
        >
          {t("common.reset", "Reset")}
        </button>
      </div>
    </form>
  );
}
