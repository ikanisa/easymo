"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RefreshCcw } from "lucide-react";
import { logError } from "@/lib/observability/logger";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    logError("segment_error", { error });
  }, [error]);

  return (
    <div
      className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-6 text-center"
      role="alert"
      aria-live="assertive"
    >
      <div className="glass rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur">
        <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20">
          <AlertTriangle className="h-8 w-8 text-red-400" aria-hidden />
        </div>
        <h2 className="mb-3 text-xl font-semibold text-neutral-0">Something went wrong</h2>
        <p className="mx-auto mb-6 max-w-md text-sm leading-relaxed text-neutral-2">
          We encountered an unexpected error while loading this page. You can try again or return to
          the dashboard.
        </p>
        {error.digest && (
          <p className="mb-6 rounded-lg bg-white/5 px-3 py-2 font-mono text-xs text-neutral-3">
            Error ID: {error.digest}
          </p>
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="interactive-scale inline-flex items-center justify-center gap-2 rounded-full bg-kigali px-6 py-3 text-sm font-semibold text-ink transition hover:bg-kigali/90 focus:outline-none focus:ring-2 focus:ring-kigali focus:ring-offset-2 focus:ring-offset-nyungwe"
          >
            <RefreshCcw className="h-4 w-4" aria-hidden />
            Try again
          </button>
          <Link
            href="/dashboard"
            className="interactive-scale inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-neutral-0 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-nyungwe"
          >
            <Home className="h-4 w-4" aria-hidden />
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
