"use client";

import { useEffect } from "react";
import { captureException } from "@/lib/client/sentry";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // Log comprehensive error details for debugging
    console.error("global_error_boundary_root", {
      message: error?.message,
      stack: error?.stack,
      digest: error?.digest,
      name: error?.name,
      cause: (error as any)?.cause,
      timestamp: new Date().toISOString(),
    });

    // Capture to Sentry with digest for correlation
    captureException(error, {
      where: "global_error_boundary_root",
      digest: error?.digest,
      errorName: error?.name,
    });
  }, [error]);

  return (
    <html>
      <body>
        <div style={{ maxWidth: 720, margin: "3rem auto", padding: "1rem" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "1rem" }}>
            Application Error
          </h1>
          <p style={{ color: "#666", marginBottom: "1rem" }}>
            An unexpected error occurred. Our team has been notified.
          </p>
          {process.env.NODE_ENV === "development" && error?.digest && (
            <div
              style={{
                background: "#f5f5f5",
                padding: "0.75rem",
                borderRadius: 4,
                marginBottom: "1rem",
                fontFamily: "monospace",
                fontSize: "0.875rem",
              }}
            >
              <strong>Error Digest:</strong> {error.digest}
            </div>
          )}
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={() => reset()}
              style={{
                background: "#2563eb",
                color: "#fff",
                border: 0,
                padding: "0.625rem 1rem",
                borderRadius: 6,
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              Try again
            </button>
            <button
              onClick={() => (window.location.href = "/")}
              style={{
                background: "#6b7280",
                color: "#fff",
                border: 0,
                padding: "0.625rem 1rem",
                borderRadius: 6,
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              Go home
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
