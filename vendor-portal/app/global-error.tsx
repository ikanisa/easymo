"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCcw, Home } from "lucide-react";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-6">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong!</h2>

            <p className="text-gray-600 mb-8">
              We apologize for the inconvenience. An unexpected error has occurred. Our team has
              been notified.
            </p>

            <div className="flex flex-col space-y-3">
              <button
                onClick={() => reset()}
                className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                <RefreshCcw className="mr-2 h-4 w-4" />
                Try again
              </button>

              <button
                onClick={() => (window.location.href = "/")}
                className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                <Home className="mr-2 h-4 w-4" />
                Go to Dashboard
              </button>
            </div>

            {process.env.NODE_ENV !== "production" && (
              <div className="mt-8 text-left">
                <details className="bg-gray-100 p-4 rounded text-xs overflow-auto max-h-48">
                  <summary className="cursor-pointer font-medium text-gray-700 mb-2">
                    Error Details
                  </summary>
                  <pre className="whitespace-pre-wrap text-red-600">
                    {error.message}
                    {error.stack}
                  </pre>
                </details>
              </div>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
