import {
  buildEndpointPath,
  defineBackgroundTriggers,
  defineHttpControllers,
  type ControllerDefinition,
  type EndpointDefinition,
} from "./utils";

const controllerDefinitions = defineHttpControllers({
  chat: {
    basePath: "" as const,
    endpoints: {
      respond: { method: "POST" as const, segment: "respond" as const },
    },
  },
  health: {
    basePath: "health" as const,
    endpoints: {
      status: { method: "GET" as const, segment: "" as const },
    },
  },
  ai: {
    basePath: "ai" as const,
    endpoints: {
      brokerOrchestrate: { method: "POST" as const, segment: "broker/orchestrate" as const },
      settlementRun: { method: "POST" as const, segment: "settlement/run" as const },
      attributionRun: { method: "POST" as const, segment: "attribution/run" as const },
      reconciliationRun: { method: "POST" as const, segment: "reconciliation/run" as const },
      supportRun: { method: "POST" as const, segment: "support/run" as const },
    },
  },
  aiTasks: {
    basePath: "ai/tasks" as const,
    endpoints: {
      schedule: { method: "POST" as const, segment: "schedule" as const },
      runDue: { method: "POST" as const, segment: "run-due" as const },
    },
  },
  agentAdmin: {
    basePath: "admin/agents" as const,
    endpoints: {
      list: { method: "GET" as const, segment: "" as const },
      create: { method: "POST" as const, segment: "" as const },
      get: { method: "GET" as const, segment: ":id" as const },
      update: { method: "PATCH" as const, segment: ":id" as const },
      listRevisions: { method: "GET" as const, segment: ":id/revisions" as const },
      createRevision: { method: "POST" as const, segment: ":id/revisions" as const },
      publish: { method: "POST" as const, segment: ":id/publish" as const },
      listDocuments: { method: "GET" as const, segment: ":id/documents" as const },
      createDocument: { method: "POST" as const, segment: ":id/documents" as const },
      listTasks: { method: "GET" as const, segment: ":id/tasks" as const },
      createTask: { method: "POST" as const, segment: ":id/tasks" as const },
    },
  },
  tools: {
    basePath: "tools" as const,
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
} as const satisfies Record<string, ControllerDefinition<Record<string, EndpointDefinition>>>);

export type AgentCoreRoutes = typeof controllerDefinitions;
export type AgentCoreControllerKey = keyof AgentCoreRoutes;
export type AgentCoreEndpointKey<Controller extends AgentCoreControllerKey> = keyof AgentCoreRoutes[Controller]["endpoints"];

export const agentCoreRoutes = controllerDefinitions;

export const getAgentCoreControllerBasePath = <Controller extends AgentCoreControllerKey>(controller: Controller) =>
  agentCoreRoutes[controller].basePath;

export const getAgentCoreEndpointSegment = <
  Controller extends AgentCoreControllerKey,
  Endpoint extends AgentCoreEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const controllerRoutes = agentCoreRoutes[controller] as ControllerDefinition<Record<string, EndpointDefinition>>;
  const endpoints = controllerRoutes.endpoints as Record<string, EndpointDefinition>;
  return endpoints[endpoint as string].segment;
};

export const getAgentCoreEndpointMethod = <
  Controller extends AgentCoreControllerKey,
  Endpoint extends AgentCoreEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const controllerRoutes = agentCoreRoutes[controller] as ControllerDefinition<Record<string, EndpointDefinition>>;
  const endpoints = controllerRoutes.endpoints as Record<string, EndpointDefinition>;
  return endpoints[endpoint as string].method;
};

export const getAgentCoreEndpointPath = <
  Controller extends AgentCoreControllerKey,
  Endpoint extends AgentCoreEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const base = getAgentCoreControllerBasePath(controller);
  const segment = getAgentCoreEndpointSegment(controller, endpoint);
  return buildEndpointPath(base, segment);
};

export const agentCoreBackgroundTriggers = defineBackgroundTriggers({
  /**
   * Tasks are executed via explicit HTTP calls. This placeholder exists to document
   * that there is no dedicated background trigger beyond the HTTP surface.
   */
} as const);

export const agentCoreControllerBasePath = "" as const;

export const getAgentCoreRouteSegment = <Key extends AgentCoreEndpointKey<"chat">>(key: Key) =>
  getAgentCoreEndpointSegment("chat", key);

export const getAgentCoreRouteMethod = <Key extends AgentCoreEndpointKey<"chat">>(key: Key) =>
  getAgentCoreEndpointMethod("chat", key);

export const getAgentCoreRoutePath = <Key extends AgentCoreEndpointKey<"chat">>(key: Key) =>
  buildEndpointPath(agentCoreControllerBasePath, controllerDefinitions.chat.endpoints[key].segment);
