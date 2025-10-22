import { buildEndpointPath } from "./utils";

const controllerBasePath = "" as const;

const routeDefinitions = Object.freeze({
  respond: {
    method: "POST" as const,
    segment: "respond" as const,
  },
});

export type AgentCoreRoutes = typeof routeDefinitions;
export type AgentCoreRouteKey = keyof AgentCoreRoutes;

export const agentCoreControllerBasePath = controllerBasePath;

export const agentCoreRoutes = routeDefinitions;

export const getAgentCoreRouteSegment = <Key extends AgentCoreRouteKey>(key: Key) =>
  agentCoreRoutes[key].segment;

export const getAgentCoreRouteMethod = <Key extends AgentCoreRouteKey>(key: Key) =>
  agentCoreRoutes[key].method;

export const getAgentCoreRoutePath = <Key extends AgentCoreRouteKey>(key: Key) =>
  buildEndpointPath(agentCoreControllerBasePath, agentCoreRoutes[key].segment);
