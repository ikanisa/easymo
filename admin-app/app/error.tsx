"use client";

import { useEffect } from "react";
import { captureException } from "@/lib/client/sentry";

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Surface the error for observability tools; console is a baseline.
    // eslint-disable-next-line no-console
    console.error("global_error_boundary", {
      message: error?.message,
      stack: error?.stack,
      digest: (error as any)?.digest,
    });
    captureException(error, { where: 'global_error_boundary' });
  }, [error]);

  return (
    <html>
      <body>
        <div style={{ maxWidth: 720, margin: "3rem auto", padding: "1rem" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Something went wrong</h1>
          <p style={{ color: "#555" }}>
            An unexpected error occurred. You can try again, or go back to the
            previous page.
          </p>
          <div style={{ marginTop: "1rem" }}>
            <button
              onClick={() => reset()}
              style={{
                background: "#111",
                color: "#fff",
                border: 0,
                padding: "0.5rem 0.75rem",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
