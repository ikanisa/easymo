"use client";

import { useEffect, useState } from "react";

type Preference = "reduce" | "default";

export interface MotionPreferenceToggleProps {
  onChange?: (preference: Preference) => void;
}

export function MotionPreferenceToggle({ onChange }: MotionPreferenceToggleProps) {
  const [preference, setPreference] = useState<Preference>(() => {
    if (typeof window === "undefined") {
      return "default";
    }
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "reduce" : "default";
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (event: MediaQueryListEvent) => {
      const next = event.matches ? "reduce" : "default";
      setPreference(next);
      onChange?.(next);
    };
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [onChange]);

  return (
    <div className="flex items-center gap-2" role="group" aria-label="Motion preferences">
      <button
        type="button"
        className={`rounded-full border px-3 py-2 text-sm ${
          preference === "default"
            ? "border-emerald-600 text-emerald-700"
            : "border-slate-400 text-slate-500"
        }`}
        onClick={() => {
          setPreference("default");
          onChange?.("default");
        }}
      >
        Enable motion
      </button>
      <button
        type="button"
        className={`rounded-full border px-3 py-2 text-sm ${
          preference === "reduce"
            ? "border-emerald-600 text-emerald-700"
            : "border-slate-400 text-slate-500"
        }`}
        onClick={() => {
          setPreference("reduce");
          onChange?.("reduce");
        }}
      >
        Reduce motion
      </button>
    </div>
  );
}
