import {
  buildEndpointPath,
  defineHttpControllers,
  type ControllerDefinition,
  type EndpointDefinition,
} from "./utils";

const agentCoreRouteDefinitions = defineHttpControllers({
  chat: {
    basePath: "" as const,
    description: "Chat interface used by frontline agents",
    endpoints: {
      respond: { method: "POST" as const, segment: "respond" as const, description: "Generate an agent reply" },
    },
  },
  ai: {
    basePath: "ai" as const,
    description: "AI workflows exposed for orchestrators",
    endpoints: {
      brokerOrchestrate: {
        method: "POST" as const,
        segment: "broker/orchestrate" as const,
        description: "Kick off the broker orchestrator flow",
      },
      settlement: { method: "POST" as const, segment: "settlement/run" as const },
      attribution: { method: "POST" as const, segment: "attribution/run" as const },
      reconciliation: { method: "POST" as const, segment: "reconciliation/run" as const },
      support: { method: "POST" as const, segment: "support/run" as const },
      soraGenerate: {
        method: "POST" as const,
        segment: "sora/generate" as const,
        description: "Queue a governed Sora generation job",
      },
    },
  },
  tasks: {
    basePath: "ai/tasks" as const,
    description: "Task scheduler for deferred agent actions",
    endpoints: {
      schedule: { method: "POST" as const, segment: "schedule" as const },
      runDue: { method: "POST" as const, segment: "run-due" as const },
    },
  },
  admin: {
    basePath: "admin/agents" as const,
    description: "Administrative endpoints for agent management",
    endpoints: {
      list: { method: "GET" as const, segment: "" as const },
      create: { method: "POST" as const, segment: "" as const },
      get: { method: "GET" as const, segment: ":id" as const },
      update: { method: "PATCH" as const, segment: ":id" as const },
      listRevisions: { method: "GET" as const, segment: ":id/revisions" as const },
      createRevision: { method: "POST" as const, segment: ":id/revisions" as const },
      publishRevision: { method: "POST" as const, segment: ":id/publish" as const },
      listDocuments: { method: "GET" as const, segment: ":id/documents" as const },
      createDocument: { method: "POST" as const, segment: ":id/documents" as const },
      listTasks: { method: "GET" as const, segment: ":id/tasks" as const },
      createTask: { method: "POST" as const, segment: ":id/tasks" as const },
    },
  },
  tools: {
    basePath: "tools" as const,
    description: "Operational tooling for live agents",
    endpoints: {
      listLeads: { method: "GET" as const, segment: "leads" as const },
      fetchLead: { method: "POST" as const, segment: "fetch-lead" as const },
      logLead: { method: "POST" as const, segment: "log-lead" as const },
      createCall: { method: "POST" as const, segment: "create-call" as const },
      setDisposition: { method: "POST" as const, segment: "set-disposition" as const },
      registerOptOut: { method: "POST" as const, segment: "register-opt-out" as const },
      collectPayment: { method: "POST" as const, segment: "collect-payment" as const },
      warmTransfer: { method: "POST" as const, segment: "warm-transfer" as const },
    },
  },
  health: {
    basePath: "health" as const,
    endpoints: {
      status: { method: "GET" as const, segment: "" as const },
    },
  },
} as const satisfies Record<string, ControllerDefinition<Record<string, EndpointDefinition>>>);

export type AgentCoreRoutes = typeof agentCoreRouteDefinitions;
export type AgentCoreControllerKey = keyof AgentCoreRoutes;
export type AgentCoreEndpointKey<Controller extends AgentCoreControllerKey> = keyof AgentCoreRoutes[Controller]["endpoints"];
export type AgentCoreRouteKey = AgentCoreEndpointKey<"chat">;

export const agentCoreRoutes = agentCoreRouteDefinitions;

export const getAgentCoreControllerBasePath = <Controller extends AgentCoreControllerKey>(controller: Controller) =>
  agentCoreRoutes[controller].basePath;

export const getAgentCoreEndpointSegment = <
  Controller extends AgentCoreControllerKey,
  Endpoint extends AgentCoreEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const controllerRoutes = agentCoreRoutes[controller] as AgentCoreRoutes[Controller];
  const endpoints = controllerRoutes.endpoints as Record<AgentCoreEndpointKey<Controller>, EndpointDefinition>;
  return endpoints[endpoint].segment;
};

export const getAgentCoreEndpointMethod = <
  Controller extends AgentCoreControllerKey,
  Endpoint extends AgentCoreEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const controllerRoutes = agentCoreRoutes[controller] as AgentCoreRoutes[Controller];
  const endpoints = controllerRoutes.endpoints as Record<AgentCoreEndpointKey<Controller>, EndpointDefinition>;
  return endpoints[endpoint].method;
};

export const getAgentCoreEndpointPath = <
  Controller extends AgentCoreControllerKey,
  Endpoint extends AgentCoreEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const base = getAgentCoreControllerBasePath(controller);
  const segment = getAgentCoreEndpointSegment(controller, endpoint);
  return buildEndpointPath(base, segment);
};

const agentCoreServiceScopes = Object.freeze({
  aiBrokerOrchestrate: ["ai:broker.orchestrate"],
  aiSettlementRun: ["ai:settlement"],
  aiAttributionRun: ["ai:attribution"],
  aiReconciliationRun: ["ai:reconciliation"],
  aiSupportRun: ["ai:support"],
  aiSoraGenerate: ["ai:sora.generate"],
  aiTasksSchedule: ["tasks:schedule"],
  aiTasksRunDue: ["tasks:run"],
} satisfies Record<string, readonly string[]>);

export const getAgentCoreRouteServiceScopes = (key: string): readonly string[] =>
  agentCoreServiceScopes[key] ?? [];
