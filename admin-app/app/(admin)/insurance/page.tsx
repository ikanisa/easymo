"use client";

import { useCallback, useMemo, useState } from "react";
import clsx from "clsx";
import {
  SLAClock,
  RequestTable,
  NegotiationThread,
  CandidateCompare3,
  MapCard,
  PromptEditor,
  KnowledgeUpload,
  ToolsGrid,
  TaskList,
  Wizard,
  type AgentTool,
  type AgentTaskItem,
  type KnowledgeDocument,
} from "@/components/atlas";
import { useAgentSidecarDataset } from "@/components/agent/Sidecar";

interface FilterOption {
  id: string;
  label: string;
}

const filterOptions: FilterOption[] = [
  { id: "all", label: "All flows" },
  { id: "prior-auth", label: "Prior auth" },
  { id: "negotiation", label: "Negotiations" },
  { id: "pharmacy", label: "Pharmacy" },
  { id: "compliance", label: "Compliance" },
  { id: "fraud", label: "Fraud" },
];

const quickActions = [
  { id: "new-case", label: "Log new case" },
  { id: "atlas-sync", label: "Atlas sync" },
  { id: "export", label: "Export report" },
];

export default function InsuranceCommandCenterPage() {
  const dataset = useAgentSidecarDataset();
  const [activeFilter, setActiveFilter] = useState<string>(filterOptions[0]?.id ?? "all");
  const [tools, setTools] = useState<AgentTool[]>(dataset.tools);
  const [tasks, setTasks] = useState<AgentTaskItem[]>(dataset.tasks);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>(dataset.knowledge);
  const [prompt, setPrompt] = useState(dataset.prompt);

  const handleToggleTool = useCallback((tool: AgentTool) => {
    setTools((prev) =>
      prev.map((item) =>
        item.id === tool.id
          ? {
              ...item,
              enabled: !item.enabled,
            }
          : item,
      ),
    );
  }, []);

  const handleToggleTask = useCallback((task: AgentTaskItem) => {
    setTasks((prev) =>
      prev.map((item) =>
        item.id === task.id
          ? {
              ...item,
              status: item.status === "done" ? "in-progress" : item.status === "in-progress" ? "todo" : "done",
            }
          : item,
      ),
    );
  }, []);

  const handleUpload = useCallback((files: FileList) => {
    const uploaded: KnowledgeDocument[] = Array.from(files).map((file, index) => ({
      id: `${file.name}-${file.size}-${index}`,
      name: file.name,
      size: `${Math.max(file.size / 1024 / 1024, 0.01).toFixed(2)} MB`,
      status: "processing",
      updatedAt: new Date().toISOString(),
    }));
    setDocuments((prev) => [...uploaded, ...prev]);
  }, []);

  const handlePromptSubmit = useCallback((value: string) => {
    setPrompt(value);
  }, []);

  const filteredRequests = useMemo(() => {
    if (activeFilter === "all") return dataset.requests;
    if (activeFilter === "prior-auth") {
      return dataset.requests.filter((request) => request.summary.toLowerCase().includes("auth"));
    }
    if (activeFilter === "negotiation") {
      return dataset.requests.filter((request) => request.summary.toLowerCase().includes("negotiat"));
    }
    if (activeFilter === "pharmacy") {
      return dataset.requests.filter((request) => request.summary.toLowerCase().includes("pharmacy"));
    }
    if (activeFilter === "compliance") {
      return dataset.requests.filter((request) => request.status === "escalated");
    }
    if (activeFilter === "fraud") {
      return dataset.requests.filter((request) => request.summary.toLowerCase().includes("fraud"));
    }
    return dataset.requests;
  }, [activeFilter, dataset.requests]);

  const widgets = useMemo(
    () => [
      <SLAClock
        key="sla"
        target={dataset.slaTarget}
        helperText="Target: resolve escalations within 15 minutes."
        className="h-full"
      />,
      <RequestTable key="requests" requests={filteredRequests} title="Open work" className="h-full" />,
      <NegotiationThread key="thread" messages={dataset.negotiation} className="h-full" />,
      <CandidateCompare3 key="candidates" candidates={dataset.candidates} className="h-full" />,
      <MapCard
        key="map"
        title="Regional coverage"
        subtitle={dataset.map.subtitle}
        points={dataset.map.points}
        className="h-full"
      />,
      <PromptEditor
        key="prompt"
        value={prompt}
        onSubmit={handlePromptSubmit}
        helperText="Atlas prompt used for first response."
        className="h-full"
      />,
      <KnowledgeUpload key="knowledge" documents={documents} onUpload={handleUpload} className="h-full" />,
      <ToolsGrid key="tools" tools={tools} onToggle={handleToggleTool} className="h-full" />,
      <TaskList key="tasks" tasks={tasks} onToggle={handleToggleTask} className="h-full" />,
      <Wizard key="wizard" steps={dataset.wizard} className="h-full" />,
      <div
        key="metrics"
        className="flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Compliance posture</p>
          <p className="mt-2 text-4xl font-semibold text-slate-900 dark:text-white">99.2%</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Atlas guardrails matched on last 200 conversations.</p>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-500 dark:text-slate-400">
          <div>
            <dt>Escalations</dt>
            <dd className="text-lg font-semibold text-slate-900 dark:text-white">3</dd>
          </div>
          <div>
            <dt>Overrides</dt>
            <dd className="text-lg font-semibold text-slate-900 dark:text-white">1</dd>
          </div>
        </dl>
      </div>,
      <div
        key="timeline"
        className="flex h-full flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Daily timeline</p>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-100">Negotiation outcomes</h3>
        </div>
        <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <li>
            <span className="font-semibold text-emerald-600 dark:text-emerald-300">08:30</span> — Accepted Atlas anchor for MRI case.
          </li>
          <li>
            <span className="font-semibold text-emerald-600 dark:text-emerald-300">10:10</span> — Pharmacy rebate renegotiated with 12% savings.
          </li>
          <li>
            <span className="font-semibold text-amber-600 dark:text-amber-300">12:45</span> — Awaiting underwriting for high-cost claim.
          </li>
          <li>
            <span className="font-semibold text-rose-600 dark:text-rose-300">15:20</span> — Manual review triggered for flagged dosage conflict.
          </li>
        </ul>
      </div>,
    ],
    [
      dataset.candidates,
      dataset.map.points,
      dataset.map.subtitle,
      dataset.negotiation,
      dataset.slaTarget,
      dataset.wizard,
      filteredRequests,
      handlePromptSubmit,
      handleToggleTask,
      handleToggleTool,
      handleUpload,
      documents,
      prompt,
      tasks,
      tools,
    ],
  );

  return (
    <div className="flex flex-1 flex-col bg-slate-50">
      <div className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/80 backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/70">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-500">Insurance operations</p>
              <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Atlas insurance cockpit</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Blend payer negotiation, pharmacy supply, and compliance guardrails in a single Atlas-grade workspace.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {quickActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-blue-300 hover:text-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-slate-700 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:text-blue-200 dark:focus-visible:ring-offset-slate-900"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2" role="toolbar" aria-label="Insurance filters">
            {filterOptions.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setActiveFilter(filter.id)}
                className={clsx(
                  "rounded-full px-3 py-1 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900",
                  activeFilter === filter.id
                    ? "bg-blue-500 text-white shadow"
                    : "border border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600 dark:border-slate-700 dark:text-slate-300",
                )}
                aria-pressed={activeFilter === filter.id}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {widgets.map((widget, index) => (
            <div key={index} className="flex h-full flex-col">
              {widget}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

