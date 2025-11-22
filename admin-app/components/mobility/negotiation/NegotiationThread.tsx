"use client";

import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";

export interface NegotiationMessage {
  id: string;
  author: "agent" | "vendor" | "system" | "manual";
  authorName?: string | null;
  body: string;
  timestamp?: string | null;
  price?: number | null;
  status?: string | null;
}

interface NegotiationThreadProps {
  messages: NegotiationMessage[];
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}

function formatTimestamp(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  }).format(date);
}

function formatPrice(price?: number | null) {
  if (price == null || Number.isNaN(price)) return null;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "RWF", maximumFractionDigits: 0 }).format(price);
  } catch (error) {
    return `${price}`;
  }
}

export function NegotiationThread({ messages, isLoading, emptyTitle, emptyDescription }: NegotiationThreadProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Negotiation thread</CardTitle>
        </CardHeader>
        <CardContent>
          <LoadingState title="Loading negotiation log" description="Pulling vendor replies and agent prompts." />
        </CardContent>
      </Card>
    );
  }

  if (!messages.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Negotiation thread</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            title={emptyTitle ?? "No negotiation messages yet"}
            description={emptyDescription ?? "Send a manual WhatsApp nudge or extend the SLA to buy more time."}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-50">Negotiation thread</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-4">
          {messages.map((message) => {
            const price = formatPrice(message.price ?? undefined);
            const timestamp = formatTimestamp(message.timestamp);
            const badgeVariant =
              message.author === "agent"
                ? "blue"
                : message.author === "vendor"
                  ? "green"
                  : message.author === "manual"
                    ? "yellow"
                    : "slate";
            return (
              <li key={message.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    <Badge variant={badgeVariant}>
                      {message.author === "agent"
                        ? "Agent"
                        : message.author === "vendor"
                          ? message.authorName ?? "Vendor"
                          : message.author === "manual"
                            ? "Manual nudge"
                            : "System"}
                    </Badge>
                    <span>{message.authorName && message.author !== "vendor" ? message.authorName : null}</span>
                  </div>
                  {timestamp ? (
                    <span className="text-xs text-slate-500 dark:text-slate-400">{timestamp}</span>
                  ) : null}
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{message.body}</p>
                <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                  {price ? <span>Offer: {price}</span> : null}
                  {message.status ? <span className="capitalize">Status: {message.status.replace(/_/g, " ")}</span> : null}
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
