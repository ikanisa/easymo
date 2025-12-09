"use client";

import { useEffect, useState } from "react";
import { fetchGroupMembers, type GroupMember } from "@/lib/api/groups";
import { Users, ArrowLeft, AlertCircle } from "lucide-react";
import Link from "next/link";
import { logError } from "@/lib/observability/logger";

/**
 * Members List Page Component
 *
 * Displays a list of members for a specific group. Access is restricted to
 * current group members through Row-Level Security (RLS) enforcement on the API.
 *
 * @component
 *
 * Features:
 * - Fetches and displays group members with key information
 * - Handles loading, error, and empty states
 * - Provides accessible navigation back to group detail
 * - Implements WCAG 2.1 AA compliance with semantic HTML and ARIA labels
 *
 * @param props - Component props
 * @param props.params - Route parameters
 * @param props.params.id - UUID of the group
 *
 * @accessibility
 * - Uses semantic HTML elements (main, header, article)
 * - Implements ARIA landmarks and labels for screen readers
 * - Provides keyboard-accessible navigation
 * - Maintains sufficient color contrast ratios
 * - Includes loading and error state announcements
 */

interface MembersPageProps {
  params: { id: string };
}

export default function MembersPage({ params }: MembersPageProps) {
  const { id: groupId } = params;

  const [members, setMembers] = useState<GroupMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    /**
     * Fetches group members from the API
     * Handles authentication and authorization errors appropriately
     */
    const loadMembers = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await fetchGroupMembers(groupId);
        setMembers(data.members);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to load members";
        setError(errorMessage);
        logError("member.groups.fetch_failed", { error: err, groupId });
      } finally {
        setIsLoading(false);
      }
    };

    loadMembers();
  }, [groupId]);

  /**
   * Formats a date string to a localized date format
   * @param dateString - ISO 8601 date string
   * @returns Formatted date string or fallback
   */
  const formatDate = (dateString: string | null): string => {
    if (!dateString) return "—";
    try {
      return new Date(dateString).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "—";
    }
  };

  return (
    <main className="space-y-6 text-neutral-0">
      {/* Page Header with Navigation */}
      <header className="space-y-4">
        <Link
          href={`/member/groups/${groupId}`}
          className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors"
          aria-label="Back to group details"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Back to Group</span>
        </Link>

        <div className="flex items-center gap-3">
          <Users className="h-8 w-8 text-emerald-500" aria-hidden="true" />
          <h1 className="text-3xl font-semibold">Group Members</h1>
        </div>
      </header>

      {/* Loading State */}
      {isLoading && (
        <div
          className="rounded-3xl border border-white/15 bg-white/8 p-8 text-center"
          role="status"
          aria-live="polite"
        >
          <div
            className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-emerald-500"
            aria-hidden="true"
          />
          <p className="mt-4 text-white/70">Loading members...</p>
          <span className="sr-only">Loading group members</span>
        </div>
      )}

      {/* Error State */}
      {!isLoading && error && (
        <div
          className="rounded-3xl border border-red-500/30 bg-red-500/10 p-6"
          role="alert"
          aria-live="assertive"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <h2 className="font-semibold text-red-500">Unable to Load Members</h2>
              <p className="mt-1 text-sm text-red-400">{error}</p>
              {error.includes("Access denied") && (
                <p className="mt-2 text-sm text-white/70">
                  You need to be an approved member of this group to view the members list.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Members List */}
      {!isLoading && !error && (
        <section aria-labelledby="members-heading">
          <h2 id="members-heading" className="sr-only">
            List of group members
          </h2>

          {members.length === 0 ? (
            // Empty State
            <div className="rounded-3xl border border-dashed border-white/20 bg-white/4 p-8 text-center">
              <Users className="mx-auto h-12 w-12 text-white/30" aria-hidden="true" />
              <p className="mt-4 text-white/70">No members found in this group yet.</p>
            </div>
          ) : (
            // Members Grid
            <div className="space-y-4">
              <p className="text-sm text-white/70" aria-live="polite">
                Showing {members.length} member{members.length !== 1 ? "s" : ""}
              </p>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {members.map((member) => (
                  <article
                    key={member.id}
                    className="rounded-3xl border border-white/15 bg-white/8 p-5 shadow-glass"
                  >
                    <header className="space-y-1">
                      <h3 className="text-lg font-semibold">{member.full_name}</h3>
                      <p className="text-sm text-white/70">
                        Code: <span className="font-mono">{member.member_code}</span>
                      </p>
                    </header>

                    <dl className="mt-4 space-y-2 text-sm">
                      <div>
                        <dt className="inline text-white/70">Phone: </dt>
                        <dd className="inline font-mono">{member.msisdn}</dd>
                      </div>

                      <div>
                        <dt className="inline text-white/70">Status: </dt>
                        <dd className="inline">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                              member.status.toLowerCase() === "active"
                                ? "bg-emerald-500/20 text-emerald-400"
                                : "bg-white/20 text-white/70"
                            }`}
                          >
                            {member.status.charAt(0).toUpperCase() +
                              member.status.slice(1).toLowerCase()}
                          </span>
                        </dd>
                      </div>

                      <div>
                        <dt className="inline text-white/70">Joined: </dt>
                        <dd className="inline">{formatDate(member.joined_at)}</dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
