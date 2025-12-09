"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RefreshCcw, ArrowLeft } from "lucide-react";
import { logError } from "@/lib/observability/logger";
import { useRouter } from "next/navigation";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function MainLayoutError({ error, reset }: ErrorProps) {
  const router = useRouter();

  useEffect(() => {
    logError("main_layout_error", { 
      error,
      message: error.message,
      stack: error.stack,
      digest: error.digest
    });
  }, [error]);

  const handleGoBack = () => {
    router.back();
  };

  return (
    <div
      className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-6 text-center"
      role="alert"
      aria-live="assertive"
    >
      <div className="glass rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur max-w-2xl w-full">
        <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20">
          <AlertTriangle className="h-8 w-8 text-red-400" aria-hidden="true" />
        </div>
        
        <h2 className="mb-3 text-xl font-semibold text-neutral-0">
          Something went wrong
        </h2>
        
        <p className="mx-auto mb-6 max-w-md text-sm leading-relaxed text-neutral-2">
          We encountered an unexpected error while loading this page. This could be a temporary issue.
          You can try reloading the page, go back, or return to the dashboard.
        </p>
        
        {error.digest && (
          <div className="mb-6 rounded-lg bg-white/5 p-3">
            <p className="font-mono text-xs text-neutral-3 mb-1">Error ID: {error.digest}</p>
            {process.env.NODE_ENV === 'development' && error.message && (
              <p className="font-mono text-xs text-neutral-4 mt-2 text-left overflow-auto max-h-32">
                {/* Sanitize error message to avoid exposing sensitive details */}
                {error.message.replace(/\/[\w/.-]+/g, '[path]')}
              </p>
            )}
          </div>
        )}
        
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="interactive-scale inline-flex items-center justify-center gap-2 rounded-full bg-kigali px-6 py-3 text-sm font-semibold text-ink transition hover:bg-kigali/90 focus:outline-none focus:ring-2 focus:ring-kigali focus:ring-offset-2 focus:ring-offset-nyungwe"
          >
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            Try again
          </button>
          
          <button
            type="button"
            onClick={handleGoBack}
            className="interactive-scale inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-neutral-0 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-nyungwe"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Go back
          </button>
          
          <Link
            href="/dashboard"
            className="interactive-scale inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-neutral-0 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-nyungwe"
          >
            <Home className="h-4 w-4" aria-hidden="true" />
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
