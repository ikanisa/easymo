"use client";

import { clsx } from "clsx";
import type { ReactNode } from "react";

export interface PaymentStatusWidgetProps {
  totalVolume: string;
  growthLabel?: string;
  momoShare: string;
  cardShare: string;
  pendingCount: number;
  disputesCount: number;
  cta?: ReactNode;
  className?: string;
}

export function PaymentStatusWidget({
  totalVolume,
  growthLabel,
  momoShare,
  cardShare,
  pendingCount,
  disputesCount,
  cta,
  className,
}: PaymentStatusWidgetProps) {
  return (
    <article
      className={clsx(
        "rounded-3xl border border-slate-200/70 bg-gradient-to-br from-white via-slate-50 to-slate-100 p-5 shadow-[0_25px_60px_rgba(15,23,42,0.12)]",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
            Payment volume
          </p>
          <h3 className="mt-2 text-4xl font-semibold text-slate-900">{totalVolume}</h3>
          {growthLabel ? (
            <p className="mt-1 text-sm font-medium text-emerald-600">{growthLabel}</p>
          ) : null}
        </div>
        {cta}
      </header>
      <dl className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
          <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
            Mobile money
          </dt>
          <dd className="text-2xl font-semibold text-emerald-900">{momoShare}</dd>
        </div>
        <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3">
          <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
            Revolut & card
          </dt>
          <dd className="text-2xl font-semibold text-sky-900">{cardShare}</dd>
        </div>
      </dl>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Pending settlements: <span className="font-semibold">{pendingCount}</span>
        </div>
        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          Disputes: <span className="font-semibold">{disputesCount}</span>
        </div>
      </div>
    </article>
  );
}
