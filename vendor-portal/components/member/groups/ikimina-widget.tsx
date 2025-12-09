import type { MemberGroupRow } from "@/lib/member/data";
import { Landmark, Users, CalendarClock } from "lucide-react";
import Link from "next/link";

interface IkiminaWidgetProps {
  group: MemberGroupRow;
}

export function IkiminaWidget({ group }: IkiminaWidgetProps) {
  const createdAtLabel = group.created_at ? new Date(group.created_at).toLocaleDateString() : "—";
  return (
    <article className="flex flex-col gap-3 rounded-3xl bg-white/10 p-5 text-neutral-0 shadow-glass backdrop-blur-xl transition-all duration-interactive ease-interactive hover:bg-white/12">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-2xl font-semibold tracking-tight">{group.name}</h3>
          <p className="mt-1 flex items-center gap-2 text-sm text-white/70">
            <Landmark className="h-4 w-4" aria-hidden />
            <span>{group.code}</span>
          </p>
        </div>
        <Link
          href={`/member/groups/${group.id}`}
          className="rounded-full bg-white/20 px-3 py-1 text-sm font-semibold text-neutral-0 transition-all duration-interactive ease-interactive hover:bg-white/30"
        >
          View
        </Link>
      </header>
      <dl className="grid grid-cols-3 gap-4 text-sm">
        <div className="space-y-1">
          <dt className="text-white/70">Status</dt>
          <dd className="font-semibold capitalize">{group.status.toLowerCase()}</dd>
        </div>
        <div className="space-y-1">
          <dt className="text-white/70">Members</dt>
          <dd className="flex items-center gap-2 font-semibold">
            <Users className="h-4 w-4" aria-hidden />
            <span>—</span>
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="text-white/70">Created</dt>
          <dd className="flex items-center gap-2 font-semibold">
            <CalendarClock className="h-4 w-4" aria-hidden />
            <span>{createdAtLabel}</span>
          </dd>
        </div>
      </dl>
      <footer className="flex items-center gap-3">
        <Link
          href={`/member/groups/${group.id}`}
          className="flex-1 rounded-2xl bg-white/20 py-3 text-center text-base font-semibold text-neutral-0 transition-all duration-interactive ease-interactive hover:bg-white/30"
        >
          Details
        </Link>
        <Link
          href={`/member/pay?group=${group.id}`}
          className="flex-1 rounded-2xl bg-emerald-500/80 py-3 text-center text-base font-semibold text-neutral-0 transition-all duration-interactive ease-interactive hover:bg-emerald-500"
        >
          Pay USSD
        </Link>
      </footer>
    </article>
  );
}
