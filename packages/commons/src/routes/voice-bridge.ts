import {
  buildEndpointPath,
  defineHttpControllers,
  type ControllerDefinition,
  type EndpointDefinition,
} from "./http-utils.js";

const socketRouteDefinitions = Object.freeze({
  mediaStream: { kind: "websocket" as const, path: "/twilio-media" as const },
});

export type VoiceBridgeRoutes = typeof socketRouteDefinitions;
export type VoiceBridgeRouteKey = keyof VoiceBridgeRoutes;

export const voiceBridgeRoutes = socketRouteDefinitions;

export const getVoiceBridgeRoutePath = <Key extends VoiceBridgeRouteKey>(key: Key) =>
  voiceBridgeRoutes[key].path;

export const getVoiceBridgeRouteKind = <Key extends VoiceBridgeRouteKey>(key: Key) =>
  voiceBridgeRoutes[key].kind;

const voiceBridgeHttpRouteDefinitions = defineHttpControllers({
  health: {
    basePath: "" as const,
    endpoints: {
      status: { method: "GET" as const, segment: "health" as const },
    },
  },
  analytics: {
    basePath: "analytics" as const,
    endpoints: {
      liveCalls: {
        method: "GET" as const,
        segment: "live-calls" as const,
        requiredScopes: ["voice:read"],
      },
    },
  },
  calls: {
    basePath: "calls" as const,
    endpoints: {
      outbound: {
        method: "POST" as const,
        segment: "outbound" as const,
        requiredScopes: ["voice:outbound.write"],
      },
    },
  },
} as const satisfies Record<string, ControllerDefinition<Record<string, EndpointDefinition>>>);

export type VoiceBridgeHttpRoutes = typeof voiceBridgeHttpRouteDefinitions;
export type VoiceBridgeHttpControllerKey = keyof VoiceBridgeHttpRoutes;
export type VoiceBridgeHttpEndpointKey<Controller extends VoiceBridgeHttpControllerKey> = keyof VoiceBridgeHttpRoutes[Controller]["endpoints"];

export const voiceBridgeHttpRoutes = voiceBridgeHttpRouteDefinitions;

export const getVoiceBridgeHttpControllerBasePath = <Controller extends VoiceBridgeHttpControllerKey>(controller: Controller) =>
  voiceBridgeHttpRoutes[controller].basePath;

export const getVoiceBridgeHttpEndpointSegment = <
  Controller extends VoiceBridgeHttpControllerKey,
  Endpoint extends VoiceBridgeHttpEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const controllerRoutes = voiceBridgeHttpRoutes[controller] as VoiceBridgeHttpRoutes[Controller];
  const endpoints = controllerRoutes.endpoints as Record<VoiceBridgeHttpEndpointKey<Controller>, EndpointDefinition>;
  return endpoints[endpoint].segment;
};

export const getVoiceBridgeHttpEndpointMethod = <
  Controller extends VoiceBridgeHttpControllerKey,
  Endpoint extends VoiceBridgeHttpEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const controllerRoutes = voiceBridgeHttpRoutes[controller] as VoiceBridgeHttpRoutes[Controller];
  const endpoints = controllerRoutes.endpoints as Record<VoiceBridgeHttpEndpointKey<Controller>, EndpointDefinition>;
  return endpoints[endpoint].method;
};

export const getVoiceBridgeHttpEndpointRequiredScopes = <
  Controller extends VoiceBridgeHttpControllerKey,
  Endpoint extends VoiceBridgeHttpEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const controllerRoutes = voiceBridgeHttpRoutes[controller] as VoiceBridgeHttpRoutes[Controller];
  const endpoints = controllerRoutes.endpoints as Record<VoiceBridgeHttpEndpointKey<Controller>, EndpointDefinition>;
  return [...(endpoints[endpoint].requiredScopes ?? [])];
};

export const getVoiceBridgeHttpEndpointPath = <
  Controller extends VoiceBridgeHttpControllerKey,
  Endpoint extends VoiceBridgeHttpEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const base = getVoiceBridgeHttpControllerBasePath(controller);
  const segment = getVoiceBridgeHttpEndpointSegment(controller, endpoint);
  return buildEndpointPath(base, segment);
};
