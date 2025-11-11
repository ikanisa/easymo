"use client";

import { useMemo } from "react";

export function Header() {
  const operatorInitials = useMemo(() => {
    const label = process.env.NEXT_PUBLIC_ENVIRONMENT_LABEL ?? "Staging";
    return label
      .split(" ")
      .map((part) => part.charAt(0).toUpperCase())
      .slice(0, 2)
      .join("");
  }, []);

  return (
    <header className="h-16 border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-6">
        <div>
          <p className="text-sm font-medium text-gray-500">Environment</p>
          <p className="text-base font-semibold text-gray-900">
            {process.env.NEXT_PUBLIC_ENVIRONMENT_LABEL ?? "Staging"}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-500">{new Date().toLocaleString()}</div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
            {operatorInitials || "EA"}
          </div>
        </div>
      </div>
    </header>
  );
}
