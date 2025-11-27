"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  type KeyboardEvent,
  ReactNode,
  useCallback,
  useContext,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  AgentTaskItem,
  AgentTool,
  AtlasMapPoint,
  AtlasRequestRow,
  CandidateCompare3,
  CandidateSummary,
  KnowledgeDocument,
  KnowledgeUpload,
  MapCard,
  NegotiationMessage,
  NegotiationThread,
  PromptEditor,
  RequestTable,
  SLAClock,
  TaskList,
  ToolsGrid,
  Wizard,
  WizardStep,
} from "@/components/atlas";
import { toLinkHref } from "@/lib/link-helpers";

export type AgentSidecarTab =
  | "overview"
  | "instructions"
  | "learning"
  | "embeddings"
  | "documents"
  | "tools"
  | "tasks"
  | "logs";

export interface AgentLogEntry {
  id: string;
  summary: string;
  createdAt: string;
  actor?: string;
}

export interface AgentSidecarDataset {
  agentId: string;
  agentName: string;
  avatar?: string;
  status: string;
  environment: string;
  owner?: string;
  quickActions: { id: string; label: string; href?: string; onClick?: () => void }[];
  instructions: string[];
  prompt: string;
  requests: AtlasRequestRow[];
  negotiation: NegotiationMessage[];
  candidates: CandidateSummary[];
  map: { subtitle?: string; points: AtlasMapPoint[] };
  slaTarget: Date | string | number;
  knowledge: KnowledgeDocument[];
  tools: AgentTool[];
  tasks: AgentTaskItem[];
  wizard: WizardStep[];
  embeddings: {
    vectorCount: number;
    dimensions: number;
    coverage: string;
    lastEmbedded: string;
  };
  logs: AgentLogEntry[];
}

interface AgentSidecarContextValue extends AgentSidecarDataset {
  activeTab: AgentSidecarTab;
  setActiveTab: (tab: AgentSidecarTab) => void;
}

const AgentSidecarContext = createContext<AgentSidecarContextValue | undefined>(undefined);

export function useAgentSidecar() {
  const value = useContext(AgentSidecarContext);
  if (!value) {
    throw new Error("useAgentSidecar must be used within an AgentSidecarProvider");
  }
  return value;
}

export interface AgentSidecarProviderProps {
  children: ReactNode;
  dataset: AgentSidecarDataset;
  initialTab?: AgentSidecarTab;
}

export function AgentSidecarProvider({ children, dataset, initialTab = "overview" }: AgentSidecarProviderProps) {
  const [activeTab, setActiveTab] = useState<AgentSidecarTab>(initialTab);
  const contextValue = useMemo(
    () => ({
      ...dataset,
      activeTab,
      setActiveTab,
    }),
    [dataset, activeTab],
  );

  return <AgentSidecarContext.Provider value={contextValue}>{children}</AgentSidecarContext.Provider>;
}

const tabList: { key: AgentSidecarTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "instructions", label: "Instructions" },
  { key: "learning", label: "Learning" },
  { key: "embeddings", label: "Embeddings" },
  { key: "documents", label: "Documents" },
  { key: "tools", label: "Tools" },
  { key: "tasks", label: "Tasks" },
  { key: "logs", label: "Logs" },
];

export function AgentSidecar() {
  const {
    activeTab,
    setActiveTab,
    agentName,
    avatar,
    environment,
    owner,
    status,
    quickActions,
    instructions,
    prompt,
    requests,
    negotiation,
    candidates,
    map,
    slaTarget,
    knowledge,
    tools,
    tasks,
    wizard,
    embeddings,
    logs,
  } = useAgentSidecar();
  const tabRefs = useRef<Record<AgentSidecarTab, HTMLButtonElement | null>>({
    overview: null,
    instructions: null,
    learning: null,
    embeddings: null,
    documents: null,
    tools: null,
    tasks: null,
    logs: null,
  });
  const tablistId = useId();

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const currentIndex = tabList.findIndex((tab) => tab.key === activeTab);
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        const nextIndex = (currentIndex + 1) % tabList.length;
        const nextTab = tabList[nextIndex];
        setActiveTab(nextTab.key);
        tabRefs.current[nextTab.key]?.focus();
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        const prevIndex = (currentIndex - 1 + tabList.length) % tabList.length;
        const prevTab = tabList[prevIndex];
        setActiveTab(prevTab.key);
        tabRefs.current[prevTab.key]?.focus();
      }
      if (event.key === "Home") {
        event.preventDefault();
        const firstTab = tabList[0];
        setActiveTab(firstTab.key);
        tabRefs.current[firstTab.key]?.focus();
      }
      if (event.key === "End") {
        event.preventDefault();
        const lastTab = tabList[tabList.length - 1];
        setActiveTab(lastTab.key);
        tabRefs.current[lastTab.key]?.focus();
      }
    },
    [activeTab, setActiveTab],
  );

  const mapSubtitle = map.subtitle;
  const mapPoints = map.points;

  const renderContent = useCallback(() => {
    switch (activeTab) {
      case "overview":
        return (
          <div className="space-y-4">
            <SLAClock target={slaTarget} helperText="Time remaining to resolve the oldest request." />
            <RequestTable requests={requests} />
            <MapCard subtitle={mapSubtitle} points={mapPoints} />
          </div>
        );
      case "instructions":
        return (
          <div className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-100">Runbook</h4>
              <ol className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                {instructions.map((line, index) => (
                  <li key={line} className="flex gap-2">
                    <span className="font-semibold text-slate-400">{index + 1}.</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ol>
            </section>
            <PromptEditor value={prompt} helperText="Update the default instruction payload for Atlas handoffs." />
          </div>
        );
      case "learning":
        return (
          <div className="space-y-4">
            <NegotiationThread messages={negotiation} />
            <CandidateCompare3 candidates={candidates} />
          </div>
        );
      case "embeddings":
        return (
          <div className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-100">Vector status</h4>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm text-slate-600 dark:text-slate-300">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Vectors</dt>
                  <dd className="text-lg font-semibold text-slate-800 dark:text-white">{embeddings.vectorCount.toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Dimensions</dt>
                  <dd className="text-lg font-semibold text-slate-800 dark:text-white">{embeddings.dimensions}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Coverage</dt>
                  <dd className="text-sm text-slate-600 dark:text-slate-300">{embeddings.coverage}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Last embedded</dt>
                  <dd className="text-sm text-slate-600 dark:text-slate-300">
                    {new Date(embeddings.lastEmbedded).toLocaleString()}
                  </dd>
                </div>
              </dl>
            </section>
          </div>
        );
      case "documents":
        return <KnowledgeUpload documents={knowledge} />;
      case "tools":
        return <ToolsGrid tools={tools} />;
      case "tasks":
        return (
          <div className="space-y-4">
            <TaskList tasks={tasks} />
            <Wizard steps={wizard} />
          </div>
        );
      case "logs":
        return (
          <section className="space-y-3">
            {logs.map((log) => (
              <article
                key={log.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <header className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>{log.actor ?? "System"}</span>
                  <time dateTime={log.createdAt}>{new Date(log.createdAt).toLocaleString()}</time>
                </header>
                <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{log.summary}</p>
              </article>
            ))}
          </section>
        );
      default:
        return null;
    }
  }, [
    activeTab,
    slaTarget,
    requests,
    mapSubtitle,
    mapPoints,
    instructions,
    prompt,
    negotiation,
    candidates,
    knowledge,
    tools,
    tasks,
    wizard,
    embeddings,
    logs,
  ]);

  return (
    <aside className="flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-slate-50/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/60">
      <div className="border-b border-slate-200 bg-white/90 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/90">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-lg font-semibold text-white">
            {avatar ?? agentName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{environment}</p>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">{agentName}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {status} {owner ? `• ${owner}` : ""}
            </p>
          </div>
        </div>
        {quickActions.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {quickActions.map((action) => (
              action.href ? (
                <Link
                  key={action.id}
                  href={toLinkHref(action.href)}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-blue-300 hover:text-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-slate-700 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:text-blue-200 dark:focus-visible:ring-offset-slate-900"
                >
                  {action.label}
                </Link>
              ) : (
                <button
                  key={action.id}
                  type="button"
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-blue-300 hover:text-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:text-blue-200 dark:focus-visible:ring-offset-slate-900"
                  onClick={action.onClick}
                  disabled={!action.onClick}
                >
                  {action.label}
                </button>
              )
            ))}
          </div>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        <div
          className="border-b border-slate-200 bg-white/90 px-5 py-2 dark:border-slate-800 dark:bg-slate-900/90"
          role="tablist"
          aria-label="Agent sidecar tabs"
          id={tablistId}
          onKeyDown={handleKeyDown}
        >
          <div className="flex flex-wrap gap-2">
            {tabList.map((tab) => (
              <button
                key={tab.key}
                ref={(node) => {
                  tabRefs.current[tab.key] = node;
                }}
                type="button"
                role="tab"
                aria-selected={tab.key === activeTab}
                aria-controls={`${tab.key}-panel`}
                id={`${tab.key}-tab`}
                className={clsx(
                  "rounded-full px-3 py-1 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900",
                  tab.key === activeTab
                    ? "bg-blue-500 text-white shadow"
                    : "border border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600 dark:border-slate-700 dark:text-slate-300",
                )}
                tabIndex={tab.key === activeTab ? 0 : -1}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-8 pt-4" role="presentation">
          <div
            role="tabpanel"
            id={`${activeTab}-panel`}
            aria-labelledby={`${activeTab}-tab`}
            tabIndex={0}
            className="focus:outline-none"
          >
            {renderContent()}
          </div>
        </div>
      </div>
    </aside>
  );
}

export function useAgentSidecarDataset(pathname?: string): AgentSidecarDataset {
  const routerPath = usePathname();
  const currentPath = pathname ?? routerPath;
  return useMemo(() => {
    const now = new Date();
    const baseDataset: AgentSidecarDataset = {
      agentId: "atlas-demo-agent",
      agentName: "Atlas Negotiator",
      status: "Live",
      environment: "Production",
      owner: "Ops Automation",
      quickActions: [
        { id: "pause", label: "Pause traffic" },
        { id: "sync", label: "Sync knowledge" },
        { id: "handoff", label: "Escalate human" },
      ],
      avatar: undefined,
      instructions: [
        "Verify insurance policy eligibility before negotiating price.",
        "Cross-check pharmacy stock against ministry restrictions.",
        "Escalate to a human if dosage conflicts are detected.",
      ],
      prompt:
        "You are Atlas Negotiator, balancing payer and provider objectives. Respond with policy references and next best action.",
      requests: [
        {
          id: "req-1",
          channel: "chat",
          customer: "Sophie, Aetna",
          status: "assigned",
          etaMinutes: 6,
          summary: "Need prior auth for insulin supply",
        },
        {
          id: "req-2",
          channel: "voice",
          customer: "Dr. Issa",
          status: "escalated",
          etaMinutes: 3,
          summary: "Negotiating out-of-network MRI",
        },
        {
          id: "req-3",
          channel: "api",
          customer: "Claims webhook",
          status: "new",
          etaMinutes: 12,
          summary: "Fraud check on duplicate invoices",
        },
      ],
      negotiation: [
        {
          id: "msg-1",
          actor: "agent",
          timestamp: new Date(now.getTime() - 1000 * 60 * 9).toISOString(),
          body: "Confirmed policy allows 20% variance with medical director approval.",
          sentiment: "positive",
        },
        {
          id: "msg-2",
          actor: "driver",
          timestamp: new Date(now.getTime() - 1000 * 60 * 5).toISOString(),
          body: "Provider is pushing for 35% uplift citing urgent case load.",
          sentiment: "negative",
        },
        {
          id: "msg-3",
          actor: "agent",
          timestamp: new Date(now.getTime() - 1000 * 60 * 2).toISOString(),
          body: "Anchoring at 22% with commitment to accelerate payout within 48 hours.",
          sentiment: "positive",
        },
      ],
      candidates: [
        {
          id: "cand-1",
          label: "Reference Atlas guardrail",
          score: 8.7,
          rationale: "Balances reimbursement speed and cost savings with policy citation 12.3.",
          cost: "Saves $2.4k",
          selected: true,
        },
        {
          id: "cand-2",
          label: "Escalate to human",
          score: 6.1,
          rationale: "Triggers compliance review due to flagged pattern.",
          cost: "+2 human hours",
          selected: false,
        },
        {
          id: "cand-3",
          label: "Offer loyalty credit",
          score: 5.2,
          rationale: "Keeps provider satisfied but deviates from policy.",
          cost: "Costs $1.2k",
          selected: false,
        },
      ],
      map: {
        subtitle: "Live facilities negotiating",
        points: [
          { id: "pt-1", label: "Casablanca", status: "online", x: 24, y: 48 },
          { id: "pt-2", label: "Rabat", status: "pending", x: 36, y: 32 },
          { id: "pt-3", label: "Marrakesh", status: "offline", x: 18, y: 68 },
        ],
      },
      slaTarget: new Date(now.getTime() + 1000 * 60 * 14),
      knowledge: [
        {
          id: "doc-1",
          name: "Insurance Policy Playbook.pdf",
          size: "4.2 MB",
          status: "ready",
          updatedAt: new Date(now.getTime() - 1000 * 60 * 45).toISOString(),
        },
        {
          id: "doc-2",
          name: "Regulatory Guardrails.xlsx",
          size: "712 KB",
          status: "processing",
          updatedAt: new Date(now.getTime() - 1000 * 60 * 12).toISOString(),
        },
      ],
      tools: [
        {
          id: "tool-1",
          name: "Prior Auth Verifier",
          description: "Checks payer rules in real time across Atlas markets.",
          category: "Compliance",
          enabled: true,
        },
        {
          id: "tool-2",
          name: "Policy Summariser",
          description: "Summarises lengthy policy PDFs into guardrail bullets.",
          category: "Knowledge",
          enabled: true,
        },
        {
          id: "tool-3",
          name: "Pharmacy Stock Fetch",
          description: "Syncs MoH stock ledgers and expiry windows for pharmacies.",
          category: "Data",
          enabled: false,
        },
        {
          id: "tool-4",
          name: "Atlas Replay",
          description: "Streams the last 10 conversations with dispute tags.",
          category: "Observability",
          enabled: false,
        },
      ],
      tasks: [
        {
          id: "task-1",
          title: "Upload June formulary updates",
          status: "in-progress",
          assignee: "Salma",
          due: new Date(now.getTime() + 1000 * 60 * 60 * 6).toISOString(),
        },
        {
          id: "task-2",
          title: "Confirm payout workflow with finance",
          status: "todo",
          assignee: "Anas",
          due: new Date(now.getTime() + 1000 * 60 * 60 * 24).toISOString(),
        },
        {
          id: "task-3",
          title: "Evaluate embeddings drift",
          status: "done",
          assignee: "Ops QA",
          due: new Date(now.getTime() - 1000 * 60 * 60 * 2).toISOString(),
        },
      ],
      wizard: [
        {
          id: "step-1",
          title: "Sync policies",
          description: "Import the latest payer contracts and Atlas guardrails.",
          status: "complete",
        },
        {
          id: "step-2",
          title: "Validate embeddings",
          description: "Run drift detection across pharmacy SKUs.",
          status: "current",
        },
        {
          id: "step-3",
          title: "Launch negotiation",
          description: "Schedule daily stand-ups with compliance.",
          status: "upcoming",
        },
      ],
      embeddings: {
        vectorCount: 182_320,
        dimensions: 1536,
        coverage: "78% of insurance + pharmacy corpus aligned with Atlas specs.",
        lastEmbedded: new Date(now.getTime() - 1000 * 60 * 33).toISOString(),
      },
      logs: [
        {
          id: "log-1",
          summary: "Embedded 36 new pharmacy protocols from Ministry circular.",
          createdAt: new Date(now.getTime() - 1000 * 60 * 15).toISOString(),
          actor: "Embedding worker",
        },
        {
          id: "log-2",
          summary: "Atlas guardrail override approved for urgent MRI case.",
          createdAt: new Date(now.getTime() - 1000 * 60 * 45).toISOString(),
          actor: "Safety desk",
        },
        {
          id: "log-3",
          summary: "Tools sync triggered via API from analytics workspace.",
          createdAt: new Date(now.getTime() - 1000 * 60 * 90).toISOString(),
        },
      ],
    };

    if (currentPath.includes("learning")) {
      return {
        ...baseDataset,
        wizard: baseDataset.wizard.map((step) =>
          step.id === "step-2" ? { ...step, status: "complete" } : step,
        ),
        tasks: baseDataset.tasks.map((task) =>
          task.id === "task-1" ? { ...task, status: "done" } : task,
        ),
      };
    }

    return baseDataset;
  }, [currentPath]);
}
