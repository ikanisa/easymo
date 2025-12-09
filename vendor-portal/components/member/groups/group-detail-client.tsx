"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MemberGroupRow, MemberSaccoSummary } from "@/lib/member/data";
import { submitJoinRequest } from "@/lib/api/groups";
import { Users, ArrowRight, CheckCircle, AlertCircle } from "lucide-react";

/**
 * Group Detail Client Component
 *
 * Displays group information with interactive features including:
 * - Join request submission
 * - Navigation to members list
 * - Status feedback with ARIA announcements
 *
 * @component
 *
 * @param props - Component props
 * @param props.group - Group data
 * @param props.sacco - Associated SACCO data
 *
 * @accessibility
 * - Uses semantic HTML with proper heading hierarchy
 * - Implements ARIA live regions for status updates
 * - Provides keyboard-accessible controls
 * - Maintains WCAG 2.1 AA color contrast ratios
 */

interface GroupDetailClientProps {
  group: MemberGroupRow;
  sacco: MemberSaccoSummary | null;
}

export function GroupDetailClient({ group, sacco }: GroupDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [joinStatus, setJoinStatus] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });

  /**
   * Handles join request submission
   * Shows success/error feedback and refreshes the page data on success
   */
  const handleJoinRequest = async () => {
    setJoinStatus({ type: null, message: "" });

    startTransition(async () => {
      try {
        await submitJoinRequest(group.id);
        setJoinStatus({
          type: "success",
          message: "Join request submitted successfully! You'll be notified when approved.",
        });

        // Refresh server-side data after successful submission
        router.refresh();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to submit join request";
        setJoinStatus({
          type: "error",
          message,
        });
      }
    });
  };

  return (
    <div className="space-y-6 text-neutral-0">
      {/* Page Header */}
      <header className="space-y-2">
        <p className="text-sm text-white/70">{sacco ? sacco.name : "SACCO"}</p>
        <h1 className="text-3xl font-semibold">{group.name}</h1>
        <p className="text-sm text-white/70">Group code: {group.code}</p>
      </header>

      {/* Join Status Notification */}
      {joinStatus.type && (
        <div
          role="alert"
          aria-live="polite"
          className={`rounded-3xl border p-4 ${
            joinStatus.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10"
              : "border-red-500/30 bg-red-500/10"
          }`}
        >
          <div className="flex items-start gap-3">
            {joinStatus.type === "success" ? (
              <CheckCircle
                className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5"
                aria-hidden="true"
              />
            ) : (
              <AlertCircle
                className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5"
                aria-hidden="true"
              />
            )}
            <p
              className={`text-sm ${
                joinStatus.type === "success" ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {joinStatus.message}
            </p>
          </div>
        </div>
      )}

      {/* Group Summary Section */}
      <section
        aria-labelledby="summary-heading"
        className="rounded-3xl border border-white/15 bg-white/8 p-6"
      >
        <h2 id="summary-heading" className="text-2xl font-semibold">
          Summary
        </h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-white/70">Status</dt>
            <dd className="text-lg font-semibold capitalize">{group.status.toLowerCase()}</dd>
          </div>
          <div>
            <dt className="text-white/70">Created</dt>
            <dd className="text-lg font-semibold">
              {group.created_at ? new Date(group.created_at).toLocaleDateString() : "—"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-white/70">SACCO</dt>
            <dd className="text-lg font-semibold">
              {sacco ? `${sacco.name} · ${sacco.district}` : "—"}
            </dd>
          </div>
        </dl>
      </section>

      {/* Members Section with Actions */}
      <section
        aria-labelledby="members-heading"
        className="rounded-3xl border border-white/15 bg-white/8 p-6"
      >
        <div className="flex items-center justify-between gap-4">
          <h2 id="members-heading" className="text-2xl font-semibold">
            Members
          </h2>
          <Link
            href={`/member/groups/${group.id}/members`}
            className="inline-flex items-center gap-2 rounded-2xl bg-white/15 px-4 py-2 text-sm font-semibold text-neutral-0 transition-colors hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-neutral-900"
            aria-label="View all group members"
          >
            <Users className="h-4 w-4" aria-hidden="true" />
            <span>View Members</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="mt-4 space-y-3">
          <p className="text-sm text-white/70">
            View the full list of group members and their contact information.
          </p>

          {/* Join Request Button */}
          <div>
            <button
              onClick={handleJoinRequest}
              disabled={isPending}
              className="rounded-2xl bg-emerald-500/80 px-6 py-2.5 text-sm font-semibold text-neutral-0 transition-all duration-interactive ease-interactive hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-neutral-900 disabled:opacity-60 disabled:cursor-not-allowed"
              aria-label="Request to join this group"
            >
              {isPending ? "Submitting..." : "Request to Join"}
            </button>
            <p className="mt-2 text-xs text-white/60">
              Submit a request to join this group. Staff will review and approve your request.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
