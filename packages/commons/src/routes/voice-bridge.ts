import {
  buildEndpointPath,
  defineHttpControllers,
  defineWebSocketRoutes,
  type ControllerDefinition,
  type EndpointDefinition,
  type WebSocketRouteDefinition,
} from "./utils";

const voiceBridgeHttpRouteDefinitions = defineHttpControllers({
  health: {
    basePath: "health" as const,
    endpoints: {
      status: { method: "GET" as const, segment: "" as const },
    },
  },
  analytics: {
    basePath: "analytics" as const,
    endpoints: {
      liveCalls: {
        method: "GET" as const,
        segment: "live-calls" as const,
        notes: "Requires service auth scope voice:read",
      },
    },
  },
  calls: {
    basePath: "calls" as const,
    endpoints: {
      outbound: {
        method: "POST" as const,
        segment: "outbound" as const,
        notes: "Requires service auth scope voice:outbound.write",
      },
    },
  },
} as const satisfies Record<string, ControllerDefinition<Record<string, EndpointDefinition>>>);

const voiceBridgeWebSocketRouteDefinitions = defineWebSocketRoutes({
  twilioMedia: {
    path: "/twilio-media" as const,
    description: "Twilio media stream ingress",
    notes: "Requires Authorization Bearer token matching Twilio credentials",
  },
} as const satisfies Record<string, WebSocketRouteDefinition>);

export type VoiceBridgeHttpRoutes = typeof voiceBridgeHttpRouteDefinitions;
export type VoiceBridgeHttpControllerKey = keyof VoiceBridgeHttpRoutes;
export type VoiceBridgeHttpEndpointKey<Controller extends VoiceBridgeHttpControllerKey> =
  keyof VoiceBridgeHttpRoutes[Controller]["endpoints"];

export const voiceBridgeHttpRoutes = voiceBridgeHttpRouteDefinitions;

export const getVoiceBridgeControllerBasePath = <Controller extends VoiceBridgeHttpControllerKey>(controller: Controller) =>
  voiceBridgeHttpRoutes[controller].basePath;

export const getVoiceBridgeEndpointSegment = <
  Controller extends VoiceBridgeHttpControllerKey,
  Endpoint extends VoiceBridgeHttpEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const controllerRoutes = voiceBridgeHttpRoutes[controller] as VoiceBridgeHttpRoutes[Controller];
  const endpoints = controllerRoutes.endpoints as Record<VoiceBridgeHttpEndpointKey<Controller>, EndpointDefinition>;
  return endpoints[endpoint].segment;
};

export const getVoiceBridgeEndpointMethod = <
  Controller extends VoiceBridgeHttpControllerKey,
  Endpoint extends VoiceBridgeHttpEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const controllerRoutes = voiceBridgeHttpRoutes[controller] as VoiceBridgeHttpRoutes[Controller];
  const endpoints = controllerRoutes.endpoints as Record<VoiceBridgeHttpEndpointKey<Controller>, EndpointDefinition>;
  return endpoints[endpoint].method;
};

export const getVoiceBridgeEndpointPath = <
  Controller extends VoiceBridgeHttpControllerKey,
  Endpoint extends VoiceBridgeHttpEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const base = getVoiceBridgeControllerBasePath(controller);
  const segment = getVoiceBridgeEndpointSegment(controller, endpoint);
  return buildEndpointPath(base, segment);
};

export type VoiceBridgeWebSocketRoutes = typeof voiceBridgeWebSocketRouteDefinitions;
export type VoiceBridgeWebSocketRouteKey = keyof VoiceBridgeWebSocketRoutes;

export const voiceBridgeWebSocketRoutes = voiceBridgeWebSocketRouteDefinitions;

export const getVoiceBridgeWebSocketRoutePath = <Key extends VoiceBridgeWebSocketRouteKey>(key: Key) =>
  voiceBridgeWebSocketRoutes[key].path;

export const getVoiceBridgeWebSocketRouteMetadata = <Key extends VoiceBridgeWebSocketRouteKey>(key: Key) =>
  voiceBridgeWebSocketRoutes[key];
