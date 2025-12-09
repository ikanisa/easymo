"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, LayoutDashboard, RefreshCcw } from "lucide-react";
import { logError } from "@/lib/observability/logger";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AdminPanelError({ error, reset }: ErrorProps) {
  useEffect(() => {
    logError("admin_panel_error", { 
      error,
      message: error.message,
      digest: error.digest,
      route: "admin"
    });
  }, [error]);

  return (
    <div
      className="flex min-h-[50vh] flex-col items-center justify-center gap-6 p-6 text-center"
      role="alert"
      aria-live="assertive"
    >
      <div className="glass rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur max-w-lg w-full">
        <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-red-500/20">
          <AlertTriangle className="h-7 w-7 text-red-400" aria-hidden="true" />
        </div>
        
        <h2 className="mb-2 text-lg font-semibold text-neutral-0">
          Admin panel error
        </h2>
        
        <p className="mx-auto mb-5 text-sm leading-relaxed text-neutral-2">
          We encountered an error while loading the admin panel. This could be due to insufficient
          permissions or a temporary system issue.
        </p>
        
        {error.digest && (
          <p className="mb-5 rounded-lg bg-white/5 px-3 py-2 font-mono text-xs text-neutral-3">
            Error ID: {error.digest}
          </p>
        )}
        
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="interactive-scale inline-flex items-center justify-center gap-2 rounded-full bg-kigali px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-kigali/90 focus:outline-none focus:ring-2 focus:ring-kigali focus:ring-offset-2 focus:ring-offset-nyungwe"
          >
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            Try again
          </button>
          
          <Link
            href="/dashboard"
            className="interactive-scale inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-semibold text-neutral-0 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-nyungwe"
          >
            <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
            Return to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
