import { buildEndpointPath, type HttpMethod } from "./utils";

const controllerDefinitions = Object.freeze({
  reconciliation: { basePath: "reconciliation" as const },
  health: { basePath: "health" as const },
});

export type ReconciliationServiceControllers = typeof controllerDefinitions;
export type ReconciliationServiceControllerKey = keyof ReconciliationServiceControllers;

const routeDefinitions = Object.freeze({
  mobileMoney: {
    controller: "reconciliation",
    method: "POST" as HttpMethod,
    segment: "mobile-money",
    scopes: ["reconciliation:write"] as const,
  },
  health: { controller: "health", method: "GET" as HttpMethod, segment: "" },
} as const satisfies Record<
  string,
  {
    controller: ReconciliationServiceControllerKey;
    method: HttpMethod;
    segment: string;
    scopes?: readonly string[];
  }
>);

export type ReconciliationServiceRoutes = typeof routeDefinitions;
export type ReconciliationServiceRouteKey = keyof ReconciliationServiceRoutes;

export const reconciliationServiceRoutes = routeDefinitions;

export const getReconciliationServiceControllerBasePath = <
  Key extends ReconciliationServiceControllerKey
>(key: Key) => controllerDefinitions[key].basePath;

export const getReconciliationServiceRouteSegment = <
  Key extends ReconciliationServiceRouteKey
>(key: Key) => reconciliationServiceRoutes[key].segment;

export const getReconciliationServiceRouteMethod = <Key extends ReconciliationServiceRouteKey>(key: Key) =>
  reconciliationServiceRoutes[key].method;

export const getReconciliationServiceRoutePath = <Key extends ReconciliationServiceRouteKey>(key: Key) => {
  const definition = reconciliationServiceRoutes[key];
  const basePath = getReconciliationServiceControllerBasePath(definition.controller);
  return buildEndpointPath(basePath, definition.segment);
};

export const getReconciliationServiceRouteRequiredScopes = <
  Key extends ReconciliationServiceRouteKey
>(key: Key) => {
  const definition = reconciliationServiceRoutes[key];
  return "scopes" in definition ? definition.scopes ?? [] : [];
};
