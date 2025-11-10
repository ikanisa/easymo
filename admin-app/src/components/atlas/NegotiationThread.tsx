"use client";

import clsx from "clsx";

export interface NegotiationMessage {
  id: string;
  actor: "agent" | "driver" | "customer" | "system" | string;
  timestamp: string;
  body: string;
  sentiment?: "positive" | "neutral" | "negative";
}

export interface NegotiationThreadProps {
  messages: NegotiationMessage[];
  title?: string;
  className?: string;
}

const actorCopy: Record<string, string> = {
  agent: "Agent",
  driver: "Driver",
  customer: "Customer",
  system: "System",
};

const sentimentTone: Record<string, string> = {
  positive: "bg-emerald-100 text-emerald-800",
  neutral: "bg-slate-100 text-slate-700",
  negative: "bg-rose-100 text-rose-700",
};

export function NegotiationThread({ messages, title = "Negotiation thread", className }: NegotiationThreadProps) {
  return (
    <section
      className={clsx(
        "flex h-full flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900",
        className,
      )}
    >
      <header>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-100">{title}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">Chronological view with live sentiment.</p>
      </header>
      <ol className="flex flex-1 flex-col gap-3 overflow-y-auto pr-1" aria-live="polite">
        {messages.map((message) => {
          const tone = sentimentTone[message.sentiment ?? "neutral"] ?? sentimentTone.neutral;
          return (
            <li
              key={message.id}
              className="rounded-xl border border-slate-100/80 bg-slate-50/80 p-3 dark:border-slate-800/70 dark:bg-slate-800/50"
            >
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                  {actorCopy[message.actor] ?? message.actor}
                </span>
                <time dateTime={message.timestamp} className="text-slate-400 dark:text-slate-500">
                  {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </time>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">{message.body}</p>
              {message.sentiment ? (
                <span className={clsx("mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-medium", tone)}>
                  {message.sentiment}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

