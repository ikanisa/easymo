import { cn } from "@/lib/utils";

export interface MissedContributorItem {
  id: string;
  full_name: string;
  msisdn: string | null;
  member_code: string | null;
  ikimina_id: string | null;
  ikimina_name: string | null;
  days_since: number | null;
}

interface MissedContributorsListProps {
  contributors: MissedContributorItem[];
}

const formatDays = (days: number | null) => {
  if (days === null) {
    return "No recorded contribution";
  }
  if (days === Number.POSITIVE_INFINITY) {
    return "No recorded contribution";
  }
  if (days === 0) {
    return "Contributed today";
  }
  if (days === 1) {
    return "Missed yesterday";
  }
  return `Missed ${days} days`; // e.g., Missed 35 days
};

const maskMsisdn = (value: string | null) => {
  if (!value) return "—";
  if (value.length < 4) return value;
  return `${value.slice(0, 4)} ✱✱✱✱ ${value.slice(-3)}`;
};

export function MissedContributorsList({ contributors }: MissedContributorsListProps) {
  if (contributors.length === 0) {
    return null;
  }

  return (
    <ul className="space-y-3">
      {contributors.map((contributor) => (
        <li
          key={contributor.id}
          className={cn(
            "flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-neutral-0",
            "shadow-glass"
          )}
        >
          <div className="space-y-1">
            <p className="font-semibold">{contributor.full_name}</p>
            <p className="text-xs text-neutral-2">
              {contributor.ikimina_name ?? "Unknown group"}
              {contributor.member_code ? ` · ${contributor.member_code}` : ""}
            </p>
            <p className="text-[11px] text-neutral-2">{maskMsisdn(contributor.msisdn)}</p>
          </div>
          <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-neutral-0">
            {formatDays(contributor.days_since)}
          </span>
        </li>
      ))}
    </ul>
  );
}
