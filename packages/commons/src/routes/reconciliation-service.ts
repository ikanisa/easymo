import {
  buildEndpointPath,
  defineHttpControllers,
  type ControllerDefinition,
  type EndpointDefinition,
} from "./utils";

const reconciliationServiceRouteDefinitions = defineHttpControllers({
  reconciliation: {
    basePath: "reconciliation" as const,
    description: "Financial reconciliation workflows",
    endpoints: {
      mobileMoney: {
        method: "POST" as const,
        segment: "mobile-money" as const,
        notes: "Accepts multipart/form-data or application/json payloads",
      },
    },
  },
  health: {
    basePath: "health" as const,
    endpoints: {
      status: { method: "GET" as const, segment: "" as const },
    },
  },
} as const satisfies Record<string, ControllerDefinition<Record<string, EndpointDefinition>>>);

export type ReconciliationServiceRoutes = typeof reconciliationServiceRouteDefinitions;
export type ReconciliationServiceControllerKey = keyof ReconciliationServiceRoutes;
export type ReconciliationServiceEndpointKey<Controller extends ReconciliationServiceControllerKey> =
  keyof ReconciliationServiceRoutes[Controller]["endpoints"];

export const reconciliationServiceRoutes = reconciliationServiceRouteDefinitions;

export const getReconciliationServiceControllerBasePath = <Controller extends ReconciliationServiceControllerKey>(
  controller: Controller,
) => reconciliationServiceRoutes[controller].basePath;

export const getReconciliationServiceEndpointSegment = <
  Controller extends ReconciliationServiceControllerKey,
  Endpoint extends ReconciliationServiceEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const controllerRoutes = reconciliationServiceRoutes[controller] as ReconciliationServiceRoutes[Controller];
  const endpoints = controllerRoutes.endpoints as Record<ReconciliationServiceEndpointKey<Controller>, EndpointDefinition>;
  return endpoints[endpoint].segment;
};

export const getReconciliationServiceEndpointMethod = <
  Controller extends ReconciliationServiceControllerKey,
  Endpoint extends ReconciliationServiceEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const controllerRoutes = reconciliationServiceRoutes[controller] as ReconciliationServiceRoutes[Controller];
  const endpoints = controllerRoutes.endpoints as Record<ReconciliationServiceEndpointKey<Controller>, EndpointDefinition>;
  return endpoints[endpoint].method;
};

export const getReconciliationServiceEndpointPath = <
  Controller extends ReconciliationServiceControllerKey,
  Endpoint extends ReconciliationServiceEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const base = getReconciliationServiceControllerBasePath(controller);
  const segment = getReconciliationServiceEndpointSegment(controller, endpoint);
  return buildEndpointPath(base, segment);
};
