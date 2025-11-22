import {
  buildEndpointPath,
  type ControllerDefinition,
  defineHttpControllers,
  type EndpointDefinition,
} from "./utils";

const attributionServiceRouteDefinitions = defineHttpControllers({
  attribution: {
    basePath: "attribution" as const,
    description: "Attribution workflows secured by service-to-service auth",
    endpoints: {
      evaluate: {
        method: "POST" as const,
        segment: "evaluate" as const,
        notes: "Requires service scope attribution:write",
      },
      evidence: {
        method: "POST" as const,
        segment: "evidence" as const,
        notes: "Requires service scope attribution:write",
      },
      disputes: {
        method: "POST" as const,
        segment: "disputes" as const,
        notes: "Requires service scope attribution:write",
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

export type AttributionServiceRoutes = typeof attributionServiceRouteDefinitions;
export type AttributionServiceControllerKey = keyof AttributionServiceRoutes;
export type AttributionServiceEndpointKey<Controller extends AttributionServiceControllerKey> =
  keyof AttributionServiceRoutes[Controller]["endpoints"];

export const attributionServiceRoutes = attributionServiceRouteDefinitions;

export const getAttributionServiceControllerBasePath = <Controller extends AttributionServiceControllerKey>(
  controller: Controller,
) => attributionServiceRoutes[controller].basePath;

export const getAttributionServiceEndpointSegment = <
  Controller extends AttributionServiceControllerKey,
  Endpoint extends AttributionServiceEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const controllerRoutes = attributionServiceRoutes[controller] as AttributionServiceRoutes[Controller];
  const endpoints = controllerRoutes.endpoints as Record<AttributionServiceEndpointKey<Controller>, EndpointDefinition>;
  return endpoints[endpoint].segment;
};

export const getAttributionServiceEndpointMethod = <
  Controller extends AttributionServiceControllerKey,
  Endpoint extends AttributionServiceEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const controllerRoutes = attributionServiceRoutes[controller] as AttributionServiceRoutes[Controller];
  const endpoints = controllerRoutes.endpoints as Record<AttributionServiceEndpointKey<Controller>, EndpointDefinition>;
  return endpoints[endpoint].method;
};

export const getAttributionServiceEndpointPath = <
  Controller extends AttributionServiceControllerKey,
  Endpoint extends AttributionServiceEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const base = getAttributionServiceControllerBasePath(controller);
  const segment = getAttributionServiceEndpointSegment(controller, endpoint);
  return buildEndpointPath(base, segment);
};
