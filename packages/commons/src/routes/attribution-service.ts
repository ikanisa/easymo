import {
  buildEndpointPath,
  defineBackgroundTriggers,
  defineHttpControllers,
  type ControllerDefinition,
  type EndpointDefinition,
} from "./utils";

const controllerDefinitions = defineHttpControllers({
  attribution: {
    basePath: "attribution" as const,
    endpoints: {
      evaluate: { method: "POST" as const, segment: "evaluate" as const },
      evidence: { method: "POST" as const, segment: "evidence" as const },
      disputes: { method: "POST" as const, segment: "disputes" as const },
    },
  },
  health: {
    basePath: "health" as const,
    endpoints: {
      status: { method: "GET" as const, segment: "" as const },
    },
  },
} as const satisfies Record<string, ControllerDefinition<Record<string, EndpointDefinition>>>);

export type AttributionServiceRoutes = typeof controllerDefinitions;
export type AttributionServiceControllerKey = keyof AttributionServiceRoutes;
export type AttributionServiceEndpointKey<Controller extends AttributionServiceControllerKey> = keyof AttributionServiceRoutes[Controller]["endpoints"];

export const attributionServiceRoutes = controllerDefinitions;

export const getAttributionServiceControllerBasePath = <
  Controller extends AttributionServiceControllerKey,
>(controller: Controller) => attributionServiceRoutes[controller].basePath;

export const getAttributionServiceEndpointSegment = <
  Controller extends AttributionServiceControllerKey,
  Endpoint extends AttributionServiceEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const controllerRoutes = attributionServiceRoutes[controller] as ControllerDefinition<Record<string, EndpointDefinition>>;
  const endpoints = controllerRoutes.endpoints as Record<string, EndpointDefinition>;
  return endpoints[endpoint as string].segment;
};

export const getAttributionServiceEndpointMethod = <
  Controller extends AttributionServiceControllerKey,
  Endpoint extends AttributionServiceEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const controllerRoutes = attributionServiceRoutes[controller] as ControllerDefinition<Record<string, EndpointDefinition>>;
  const endpoints = controllerRoutes.endpoints as Record<string, EndpointDefinition>;
  return endpoints[endpoint as string].method;
};

export const getAttributionServiceEndpointPath = <
  Controller extends AttributionServiceControllerKey,
  Endpoint extends AttributionServiceEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const base = getAttributionServiceControllerBasePath(controller);
  const segment = getAttributionServiceEndpointSegment(controller, endpoint);
  return buildEndpointPath(base, segment);
};

export const attributionServiceBackgroundTriggers = defineBackgroundTriggers({} as const);
