"use client";

import { useTransition } from "react";
import type { MemberGroupRow, MemberJoinRequestRow } from "@/lib/member/data";
import Link from "next/link";
import { Users } from "lucide-react";
import { useRouter } from "next/navigation";

interface GroupGridProps {
  groups: MemberGroupRow[];
  joinRequests: MemberJoinRequestRow[];
}

export function GroupGrid({ groups, joinRequests }: GroupGridProps) {
  const [isSubmitting, startTransition] = useTransition();
  const router = useRouter();

  const submitJoinRequest = (groupId: string, saccoId: string) => {
    startTransition(async () => {
      const response = await fetch(`/api/member/groups/${groupId}/join-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saccoId }),
      });

      if (!response.ok) {
        console.error("Failed to create join request");
        return;
      }

      router.refresh();
    });
  };

  const getStatus = (groupId: string) =>
    joinRequests.find((request) => request.group_id === groupId)?.status ?? null;

  if (groups.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-white/20 bg-white/4 p-6 text-center text-white/70">
        No groups available yet. Try linking a SACCO first.
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {groups.map((group) => {
        const status = getStatus(group.id);
        return (
          <article
            key={group.id}
            className="rounded-3xl border border-white/15 bg-white/8 p-5 text-neutral-0 shadow-glass"
          >
            <header className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold">{group.name}</h3>
                <p className="text-sm text-white/70">Code: {group.code}</p>
              </div>
              <Link
                href={`/member/groups/${group.id}`}
                className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-neutral-0"
              >
                Overview
              </Link>
            </header>
            <div className="mt-3 flex items-center gap-2 text-sm text-white/80">
              <Users className="h-4 w-4" aria-hidden />
              <span>Status: {group.status.toLowerCase()}</span>
            </div>
            <footer className="mt-4 flex items-center gap-3">
              <button
                className="flex-1 rounded-2xl bg-emerald-500/80 px-4 py-2 text-sm font-semibold text-neutral-0 transition-all duration-interactive ease-interactive hover:bg-emerald-500 disabled:opacity-60"
                onClick={() => submitJoinRequest(group.id, group.sacco_id)}
                disabled={Boolean(status) || isSubmitting}
              >
                {status
                  ? status.charAt(0).toUpperCase() + status.slice(1)
                  : isSubmitting
                    ? "Sending…"
                    : "Ask to Join"}
              </button>
              <Link
                href={`/member/pay?group=${group.id}`}
                className="rounded-2xl bg-white/15 px-4 py-2 text-sm font-semibold text-neutral-0 hover:bg-white/25"
              >
                Pay
              </Link>
            </footer>
          </article>
        );
      })}
    </div>
  );
}
