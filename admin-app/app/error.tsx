"use client";

import { useEffect } from "react";
import { captureException } from "@/lib/client/sentry";

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Surface the error for observability tools with full context
    console.error("error_boundary", {
      message: error?.message,
      stack: error?.stack,
      digest: error?.digest,
      name: error?.name,
      cause: (error as any)?.cause,
      timestamp: new Date().toISOString(),
    });
    
    // Capture to Sentry with digest for server-side correlation
    captureException(error, {
      where: "error_boundary",
      digest: error?.digest,
      errorName: error?.name,
    });
  }, [error]);

  return (
    <div style={{ maxWidth: 720, margin: "3rem auto", padding: "1rem" }}>
      <h1 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.75rem" }}>
        Something went wrong
      </h1>
      <p style={{ color: "#666", marginBottom: "1rem" }}>
        An unexpected error occurred. You can try again, or go back to the
        previous page.
      </p>
      {process.env.NODE_ENV === "development" && error?.digest && (
        <div
          style={{
            background: "#fef3c7",
            border: "1px solid #fbbf24",
            padding: "0.75rem",
            borderRadius: 4,
            marginBottom: "1rem",
            fontSize: "0.875rem",
          }}
        >
          <strong>Debug Info:</strong>
          <div style={{ fontFamily: "monospace", marginTop: "0.25rem" }}>
            Digest: {error.digest}
          </div>
          <div style={{ marginTop: "0.5rem", fontSize: "0.8rem", color: "#78716c" }}>
            Search server logs for this digest to find the full error details.
          </div>
        </div>
      )}
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
        <button
          onClick={() => reset()}
          style={{
            background: "#2563eb",
            color: "#fff",
            border: 0,
            padding: "0.5rem 0.75rem",
            borderRadius: 6,
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          Try again
        </button>
        <button
          onClick={() => window.history.back()}
          style={{
            background: "#6b7280",
            color: "#fff",
            border: 0,
            padding: "0.5rem 0.75rem",
            borderRadius: 6,
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          Go back
        </button>
      </div>
    </div>
  );
}
