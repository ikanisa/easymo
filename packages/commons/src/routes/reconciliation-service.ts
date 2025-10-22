import {
  buildEndpointPath,
  defineBackgroundTriggers,
  defineHttpControllers,
  type ControllerDefinition,
  type EndpointDefinition,
} from "./utils";

const controllerDefinitions = defineHttpControllers({
  reconciliation: {
    basePath: "reconciliation" as const,
    endpoints: {
      mobileMoney: { method: "POST" as const, segment: "mobile-money" as const },
    },
  },
  health: {
    basePath: "health" as const,
    endpoints: {
      status: { method: "GET" as const, segment: "" as const },
    },
  },
} as const satisfies Record<string, ControllerDefinition<Record<string, EndpointDefinition>>>);

export type ReconciliationServiceRoutes = typeof controllerDefinitions;
export type ReconciliationServiceControllerKey = keyof ReconciliationServiceRoutes;
export type ReconciliationServiceEndpointKey<Controller extends ReconciliationServiceControllerKey> = keyof ReconciliationServiceRoutes[Controller]["endpoints"];

export const reconciliationServiceRoutes = controllerDefinitions;

export const getReconciliationServiceControllerBasePath = <
  Controller extends ReconciliationServiceControllerKey,
>(controller: Controller) => reconciliationServiceRoutes[controller].basePath;

export const getReconciliationServiceEndpointSegment = <
  Controller extends ReconciliationServiceControllerKey,
  Endpoint extends ReconciliationServiceEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const controllerRoutes = reconciliationServiceRoutes[controller] as ControllerDefinition<Record<string, EndpointDefinition>>;
  const endpoints = controllerRoutes.endpoints as Record<string, EndpointDefinition>;
  return endpoints[endpoint as string].segment;
};

export const getReconciliationServiceEndpointMethod = <
  Controller extends ReconciliationServiceControllerKey,
  Endpoint extends ReconciliationServiceEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const controllerRoutes = reconciliationServiceRoutes[controller] as ControllerDefinition<Record<string, EndpointDefinition>>;
  const endpoints = controllerRoutes.endpoints as Record<string, EndpointDefinition>;
  return endpoints[endpoint as string].method;
};

export const getReconciliationServiceEndpointPath = <
  Controller extends ReconciliationServiceControllerKey,
  Endpoint extends ReconciliationServiceEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const base = getReconciliationServiceControllerBasePath(controller);
  const segment = getReconciliationServiceEndpointSegment(controller, endpoint);
  return buildEndpointPath(base, segment);
};

export const reconciliationServiceBackgroundTriggers = defineBackgroundTriggers({} as const);
