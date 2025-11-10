"use client";

import clsx from "clsx";

export interface CandidateSummary {
  id: string;
  label: string;
  score: number;
  rationale: string;
  cost?: string;
  selected?: boolean;
}

export interface CandidateCompare3Props {
  candidates: CandidateSummary[];
  onSelect?: (candidate: CandidateSummary) => void;
  className?: string;
}

export function CandidateCompare3({ candidates, onSelect, className }: CandidateCompare3Props) {
  return (
    <section
      className={clsx(
        "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900",
        className,
      )}
      aria-label="Candidate comparison"
    >
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-100">Candidate comparison</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Scorecards for the top three negotiation paths.</p>
        </div>
      </header>
      <div className="grid gap-3 sm:grid-cols-3">
        {candidates.map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            className={clsx(
              "group flex flex-col items-start gap-2 rounded-xl border px-4 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900",
              candidate.selected
                ? "border-blue-500 bg-blue-50 text-blue-900 dark:border-blue-400/80 dark:bg-blue-500/10 dark:text-blue-100"
                : "border-slate-200 bg-slate-50/60 text-slate-700 hover:border-blue-200 hover:bg-white dark:border-slate-800/70 dark:bg-slate-800/60 dark:text-slate-200",
            )}
            onClick={onSelect ? () => onSelect(candidate) : undefined}
            disabled={!onSelect}
            aria-pressed={candidate.selected}
          >
            <div className="flex w-full items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                {candidate.label}
              </span>
              <span className="text-sm font-semibold tabular-nums">{candidate.score.toFixed(1)}</span>
            </div>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{candidate.rationale}</p>
            {candidate.cost ? (
              <span className="text-xs font-medium text-slate-400 dark:text-slate-500">{candidate.cost}</span>
            ) : null}
          </button>
        ))}
      </div>
    </section>
  );
}

