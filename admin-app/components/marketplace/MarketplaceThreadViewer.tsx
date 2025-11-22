"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import type { MarketplaceAgentSession } from "@/lib/marketplace/types";
import { cn } from "@/lib/utils";

interface MarketplaceThreadViewerProps {
  sessions: MarketplaceAgentSession[];
  isLoading?: boolean;
  title?: string;
  description?: string;
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) return "—";
  try {
    const date = new Date(value);
    return new Intl.DateTimeFormat("en-GB", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return value;
  }
}

function extractQuoteSummary(session: MarketplaceAgentSession) {
  if (!session.quotes.length) {
    return "Awaiting vendor responses";
  }
  const bestQuote = session.quotes
    .filter((quote) => typeof (quote.offerData as any)?.total_minor === "number")
    .slice()
    .sort(
      (a, b) =>
        ((a.offerData as any)?.total_minor ?? Number.POSITIVE_INFINITY) -
        ((b.offerData as any)?.total_minor ?? Number.POSITIVE_INFINITY),
    )[0];
  if (!bestQuote) {
    return `${session.quotes.length} quotes received`;
  }
  const formatter = new Intl.NumberFormat("en-RW", {
    style: "currency",
    currency: "RWF",
    maximumFractionDigits: 0,
  });
  return `${session.quotes.length} quotes · ${formatter.format((bestQuote.offerData as any)?.total_minor ?? 0)}`;
}

export function MarketplaceThreadViewer({
  sessions,
  isLoading,
  title = "Live threads",
  description = "Monitor multi-vendor conversations sourced from WhatsApp and Supabase.",
}: MarketplaceThreadViewerProps) {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(
    sessions[0]?.id ?? null,
  );

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? sessions[0],
    [activeSessionId, sessions],
  );

  if (isLoading) {
    return (
      <LoadingState
        title="Loading conversations"
        description="Fetching WhatsApp threads and vendor responses from Supabase."
      />
    );
  }

  if (!sessions.length) {
    return (
      <EmptyState
        title="No active threads"
        description="Once agents begin negotiating with suppliers the full conversation history will appear here."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="lg:w-72">
        <div className="mb-2 space-y-1">
          <h3 className="text-base font-semibold text-[color:var(--color-foreground)]">{title}</h3>
          <p className="text-sm text-[color:var(--color-muted)]">{description}</p>
        </div>
        <div className="space-y-2">
          {sessions.map((session) => {
            const statusAccent =
              session.status === "completed"
                ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                : session.status === "negotiating"
                  ? "bg-blue-50 text-blue-600 border-blue-200"
                  : "bg-slate-50 text-slate-600 border-slate-200";
            return (
              <button
                key={session.id}
                onClick={() => setActiveSessionId(session.id)}
                className={cn(
                  "w-full rounded-2xl border px-4 py-3 text-left transition",
                  statusAccent,
                  activeSession?.id === session.id
                    ? "ring-2 ring-[color:var(--color-accent)]"
                    : "hover:border-[color:var(--color-accent)]/60",
                )}
                type="button"
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold capitalize">{session.status}</span>
                  <span className="text-xs text-[color:var(--color-muted)]">
                    {formatTimestamp(session.startedAt)}
                  </span>
                </div>
                <div className="mt-1 text-xs text-[color:var(--color-muted)]">
                  {session.customer.msisdn ?? "Unknown customer"}
                </div>
                <div className="mt-2 text-xs font-medium text-[color:var(--color-foreground)]">
                  {extractQuoteSummary(session)}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {activeSession ? (
        <div className="flex-1 rounded-3xl border border-[color:var(--color-border)] bg-white/60 p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--color-border)] pb-3">
            <div>
              <h4 className="text-lg font-semibold text-[color:var(--color-foreground)]">
                {activeSession.customer.msisdn ?? "Marketplace session"}
              </h4>
              <p className="text-sm text-[color:var(--color-muted)]">
                Flow: {activeSession.flowType ?? "—"}
              </p>
            </div>
            <Badge variant="outline">{activeSession.agentType}</Badge>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-[color:var(--color-border)]/60 bg-[color:var(--color-surface)]/70 p-3 text-sm">
              <h5 className="font-semibold text-[color:var(--color-foreground)]">Request details</h5>
              <dl className="mt-2 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <dt className="text-[color:var(--color-muted)]">Status</dt>
                  <dd className="font-medium capitalize">{activeSession.status}</dd>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <dt className="text-[color:var(--color-muted)]">Items</dt>
                  <dd className="text-right">
                    {Array.isArray((activeSession.requestData as any)?.items)
                      ? (activeSession.requestData as any).items
                          .map((item: any) =>
                            `${item.quantity ?? ""} ${item.name ?? "Item"}`.trim(),
                          )
                          .join(", ")
                      : "—"}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <dt className="text-[color:var(--color-muted)]">Location</dt>
                  <dd className="text-right">
                    {activeSession.customer.location
                      ? `${activeSession.customer.location.lat.toFixed(4)}, ${activeSession.customer.location.lng.toFixed(4)}`
                      : "—"}
                  </dd>
                </div>
              </dl>
            </div>
            <div className="rounded-2xl border border-[color:var(--color-border)]/60 bg-[color:var(--color-surface)]/70 p-3 text-sm">
              <h5 className="font-semibold text-[color:var(--color-foreground)]">Quote leaderboard</h5>
              {activeSession.quotes.length ? (
                <ul className="mt-2 space-y-2">
                  {activeSession.quotes.map((quote) => (
                    <li key={quote.id} className="rounded-xl border border-[color:var(--color-border)]/40 bg-white/70 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{quote.vendorName ?? "Unknown vendor"}</span>
                        <span className="text-xs text-[color:var(--color-muted)]">
                          {formatTimestamp(quote.respondedAt)}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-[color:var(--color-muted)]">
                        {quote.status}
                        {typeof (quote.offerData as any)?.total_minor === "number"
                          ? ` · ${(quote.offerData as any).total_minor.toLocaleString("en-RW")}`
                          : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-[color:var(--color-muted)]">No quotes yet.</p>
              )}
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-[color:var(--color-border)] bg-white/80 p-4">
            <h5 className="text-sm font-semibold text-[color:var(--color-foreground)]">Conversation timeline</h5>
            {activeSession.conversation?.messages.length ? (
              <ol className="mt-3 space-y-3 text-sm">
                {activeSession.conversation.messages.map((message) => (
                  <li
                    key={message.id}
                    className={cn(
                      "flex gap-3 rounded-xl border border-[color:var(--color-border)]/40 px-3 py-2",
                      message.direction === "assistant"
                        ? "bg-[color:var(--color-accent)]/10"
                        : "bg-[color:var(--color-surface)]/80",
                    )}
                  >
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-xs text-[color:var(--color-muted)]">
                        <span className="font-medium text-[color:var(--color-foreground)]">
                          {message.direction === "assistant"
                            ? message.agentDisplayName ?? "EasyMO agent"
                            : activeSession.customer.msisdn ?? "Customer"}
                        </span>
                        <span>{formatTimestamp(message.createdAt)}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-[color:var(--color-foreground)]">
                        {message.content}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState
                title="No messages yet"
                description="Vendor and customer messages will surface as soon as the WhatsApp thread is linked to this session."
              />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
