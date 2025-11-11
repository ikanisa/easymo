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
    <header className="dashboard-shell__header" role="banner">
      <div className="dashboard-shell__header-inner">
        <div>
          <p className="dashboard-shell__meta-label">Environment</p>
          <p className="dashboard-shell__meta-value">
            {process.env.NEXT_PUBLIC_ENVIRONMENT_LABEL ?? "Staging"}
          </p>
        </div>
        <div className="dashboard-shell__header-meta">
          <div className="dashboard-shell__timestamp">{new Date().toLocaleString()}</div>
          <div className="dashboard-shell__avatar">{operatorInitials || "EA"}</div>
        </div>
      </div>
    </header>
  );
}
