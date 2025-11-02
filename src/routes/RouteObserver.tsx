import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

import { browserLogger } from "@/lib/observability/browser";

function generateSpanId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(16).slice(2);
}

export const RouteObserver = () => {
  const location = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const spanId = generateSpanId();
    const start = performance.now();
    browserLogger.navigationStart(location.pathname, navigationType, spanId);

    let completed = false;

    const finalize = () => {
      if (completed) return;
      completed = true;
      const duration = performance.now() - start;
      browserLogger.navigationComplete(location.pathname, navigationType, spanId, duration);
    };

    const rafHandle = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(finalize);
    });

    return () => {
      if (!completed) {
        finalize();
      }
      window.cancelAnimationFrame(rafHandle);
    };
  }, [location.key, location.pathname, navigationType]);

  return null;
};

export default RouteObserver;
