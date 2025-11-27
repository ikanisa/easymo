"use client";

import { ReactNode } from "react";

import { AgentSidecar, AgentSidecarProvider, useAgentSidecarDataset } from "@/components/agent/Sidecar";

export default function AgentsLayout({ children }: { children: ReactNode }) {
  const dataset = useAgentSidecarDataset();

  return (
    <AgentSidecarProvider dataset={dataset}>
      <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-slate-50/40 xl:flex-row">
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
        <div className="border-t border-slate-200/80 bg-white/80 backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/60 xl:h-auto xl:w-[380px] xl:flex-shrink-0 xl:border-l">
          <AgentSidecar />
        </div>
      </div>
    </AgentSidecarProvider>
  );
}

