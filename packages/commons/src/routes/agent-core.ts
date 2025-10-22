import { buildEndpointPath, type HttpMethod } from "./utils";
import type { AgentPermission } from "../types";

const controllerDefinitions = Object.freeze({
  chat: { basePath: "" as const },
  tools: { basePath: "tools" as const },
  health: { basePath: "health" as const },
  agentAdmin: { basePath: "admin/agents" as const },
  ai: { basePath: "ai" as const },
  aiTasks: { basePath: "ai/tasks" as const },
});

export type AgentCoreControllers = typeof controllerDefinitions;
export type AgentCoreControllerKey = keyof AgentCoreControllers;

const routeDefinitions = Object.freeze({
  respond: { controller: "chat", method: "POST", segment: "respond" },
  toolsListLeads: { controller: "tools", method: "GET", segment: "leads", permissions: ["lead.read"] as const },
  toolsFetchLead: { controller: "tools", method: "POST", segment: "fetch-lead", permissions: ["lead.read"] as const },
  toolsLogLead: { controller: "tools", method: "POST", segment: "log-lead", permissions: ["lead.write"] as const },
  toolsCreateCall: { controller: "tools", method: "POST", segment: "create-call", permissions: ["call.write"] as const },
  toolsSetDisposition: {
    controller: "tools",
    method: "POST",
    segment: "set-disposition",
    permissions: ["disposition.write"] as const,
  },
  toolsRegisterOptOut: {
    controller: "tools",
    method: "POST",
    segment: "register-opt-out",
    permissions: ["lead.optOut"] as const,
  },
  toolsCollectPayment: {
    controller: "tools",
    method: "POST",
    segment: "collect-payment",
    permissions: ["payment.collect"] as const,
  },
  toolsWarmTransfer: {
    controller: "tools",
    method: "POST",
    segment: "warm-transfer",
    permissions: ["call.transfer"] as const,
  },
  health: { controller: "health", method: "GET", segment: "" },
  agentAdminList: { controller: "agentAdmin", method: "GET", segment: "" },
  agentAdminCreate: { controller: "agentAdmin", method: "POST", segment: "" },
  agentAdminGet: { controller: "agentAdmin", method: "GET", segment: ":id" },
  agentAdminUpdate: { controller: "agentAdmin", method: "PATCH", segment: ":id" },
  agentAdminListRevisions: { controller: "agentAdmin", method: "GET", segment: ":id/revisions" },
  agentAdminCreateRevision: { controller: "agentAdmin", method: "POST", segment: ":id/revisions" },
  agentAdminPublishRevision: { controller: "agentAdmin", method: "POST", segment: ":id/publish" },
  agentAdminListDocuments: { controller: "agentAdmin", method: "GET", segment: ":id/documents" },
  agentAdminCreateDocument: { controller: "agentAdmin", method: "POST", segment: ":id/documents" },
  agentAdminListTasks: { controller: "agentAdmin", method: "GET", segment: ":id/tasks" },
  agentAdminCreateTask: { controller: "agentAdmin", method: "POST", segment: ":id/tasks" },
  aiBrokerOrchestrate: {
    controller: "ai",
    method: "POST",
    segment: "broker/orchestrate",
    serviceScopes: ["ai:broker.orchestrate"] as const,
  },
  aiSettlementRun: {
    controller: "ai",
    method: "POST",
    segment: "settlement/run",
    serviceScopes: ["ai:settlement"] as const,
  },
  aiAttributionRun: {
    controller: "ai",
    method: "POST",
    segment: "attribution/run",
    serviceScopes: ["ai:attribution"] as const,
  },
  aiReconciliationRun: {
    controller: "ai",
    method: "POST",
    segment: "reconciliation/run",
    serviceScopes: ["ai:reconciliation"] as const,
  },
  aiSupportRun: {
    controller: "ai",
    method: "POST",
    segment: "support/run",
    serviceScopes: ["ai:support"] as const,
  },
  aiTasksSchedule: {
    controller: "aiTasks",
    method: "POST",
    segment: "schedule",
    serviceScopes: ["tasks:schedule"] as const,
  },
  aiTasksRunDue: {
    controller: "aiTasks",
    method: "POST",
    segment: "run-due",
    serviceScopes: ["tasks:run"] as const,
  },
} as const satisfies Record<
  string,
  {
    controller: AgentCoreControllerKey;
    method: HttpMethod;
    segment: string;
    permissions?: readonly AgentPermission[];
    serviceScopes?: readonly string[];
  }
>);
export type AgentCoreRoutes = typeof routeDefinitions;
export type AgentCoreRouteKey = keyof AgentCoreRoutes;

export const agentCoreControllerBasePath = controllerDefinitions.chat.basePath;

export const agentCoreControllerBasePath = "" as const;

export const getAgentCoreControllerBasePath = <Key extends AgentCoreControllerKey>(key: Key) =>
  controllerDefinitions[key].basePath;

export const getAgentCoreRouteController = <Key extends AgentCoreRouteKey>(key: Key) =>
  agentCoreRoutes[key].controller;

export const getAgentCoreRouteSegment = <Key extends AgentCoreRouteKey>(key: Key) =>
  agentCoreRoutes[key].segment;

export const getAgentCoreRouteMethod = <Key extends AgentCoreEndpointKey<"chat">>(key: Key) =>
  getAgentCoreEndpointMethod("chat", key);

export const getAgentCoreRoutePath = <Key extends AgentCoreRouteKey>(key: Key) => {
  const definition = agentCoreRoutes[key];
  const basePath = getAgentCoreControllerBasePath(definition.controller);
  return buildEndpointPath(basePath, definition.segment);
};

export const getAgentCoreRoutePermissions = <Key extends AgentCoreRouteKey>(key: Key) => {
  const definition = agentCoreRoutes[key];
  return "permissions" in definition ? definition.permissions ?? [] : [];
};

export const getAgentCoreRouteServiceScopes = <Key extends AgentCoreRouteKey>(key: Key) => {
  const definition = agentCoreRoutes[key];
  return "serviceScopes" in definition ? definition.serviceScopes ?? [] : [];
};
