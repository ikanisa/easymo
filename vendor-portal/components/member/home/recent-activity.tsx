import type { MemberJoinRequestRow } from "@/lib/member/data";

interface RecentActivityProps {
  joinRequests: MemberJoinRequestRow[];
}

export function RecentActivity({ joinRequests }: RecentActivityProps) {
  if (joinRequests.length === 0) {
    return (
      <div className="rounded-3xl border border-white/15 bg-white/6 p-5 text-center text-white/80">
        No recent activity yet. Submit a join request to get started.
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {joinRequests.slice(0, 5).map((request) => (
        <li
          key={request.id}
          className="rounded-3xl border border-white/10 bg-white/8 p-4 text-neutral-0 shadow-sm"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-base font-semibold capitalize">{request.status}</p>
            <span className="text-sm text-white/70">{renderRelativeTime(request.created_at)}</span>
          </div>
          {request.note ? <p className="mt-2 text-sm text-white/80">{request.note}</p> : null}
        </li>
      ))}
    </ul>
  );
}

function renderRelativeTime(timestamp: string | null): string {
  if (!timestamp) {
    return "just now";
  }

  const createdAt = new Date(timestamp).getTime();
  if (Number.isNaN(createdAt)) {
    return "just now";
  }

  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const diffMinutes = Math.round((Date.now() - createdAt) / (1000 * 60));

  if (Math.abs(diffMinutes) < 60) {
    return rtf.format(-diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return rtf.format(-diffHours, "hour");
  }

  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 30) {
    return rtf.format(-diffDays, "day");
  }

  const diffMonths = Math.round(diffDays / 30);
  return rtf.format(-diffMonths, "month");
}
