import {
  buildEndpointPath,
  createWebsocketRouteSelectors,
  defineBackgroundTriggers,
  defineHttpControllers,
  defineWebsocketRoutes,
  type ControllerDefinition,
  type EndpointDefinition,
  type WebSocketRouteDefinition,
} from "./utils";

const httpControllerDefinitions = defineHttpControllers({
  analytics: {
    basePath: "analytics" as const,
    endpoints: {
      liveCalls: { method: "GET" as const, segment: "live-calls" as const },
    },
  },
  calls: {
    basePath: "calls" as const,
    endpoints: {
      outbound: { method: "POST" as const, segment: "outbound" as const },
    },
  },
  health: {
    basePath: "health" as const,
    endpoints: {
      status: { method: "GET" as const, segment: "" as const },
    },
  },
} as const satisfies Record<string, ControllerDefinition<Record<string, EndpointDefinition>>>);

const websocketRouteDefinitions = defineWebsocketRoutes({
  mediaStream: { path: "/twilio-media" as const, description: "Twilio Media Stream ingress" },
} as const satisfies Record<string, WebSocketRouteDefinition>);

const websocketSelectors = createWebsocketRouteSelectors(websocketRouteDefinitions);

export type VoiceBridgeHttpRoutes = typeof httpControllerDefinitions;
export type VoiceBridgeHttpControllerKey = keyof VoiceBridgeHttpRoutes;
export type VoiceBridgeHttpEndpointKey<Controller extends VoiceBridgeHttpControllerKey> = keyof VoiceBridgeHttpRoutes[Controller]["endpoints"];

export type VoiceBridgeWebsocketRoutes = typeof websocketRouteDefinitions;
export type VoiceBridgeWebsocketRouteKey = keyof VoiceBridgeWebsocketRoutes;

export const voiceBridgeHttpRoutes = httpControllerDefinitions;
export const voiceBridgeWebsocketRoutes = websocketRouteDefinitions;

export const getVoiceBridgeHttpControllerBasePath = <
  Controller extends VoiceBridgeHttpControllerKey,
>(controller: Controller) => voiceBridgeHttpRoutes[controller].basePath;

export const getVoiceBridgeHttpEndpointSegment = <
  Controller extends VoiceBridgeHttpControllerKey,
  Endpoint extends VoiceBridgeHttpEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const controllerRoutes = voiceBridgeHttpRoutes[controller] as ControllerDefinition<Record<string, EndpointDefinition>>;
  const endpoints = controllerRoutes.endpoints as Record<string, EndpointDefinition>;
  return endpoints[endpoint as string].segment;
};

export const getVoiceBridgeHttpEndpointMethod = <
  Controller extends VoiceBridgeHttpControllerKey,
  Endpoint extends VoiceBridgeHttpEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const controllerRoutes = voiceBridgeHttpRoutes[controller] as ControllerDefinition<Record<string, EndpointDefinition>>;
  const endpoints = controllerRoutes.endpoints as Record<string, EndpointDefinition>;
  return endpoints[endpoint as string].method;
};

export const getVoiceBridgeHttpEndpointPath = <
  Controller extends VoiceBridgeHttpControllerKey,
  Endpoint extends VoiceBridgeHttpEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const base = getVoiceBridgeHttpControllerBasePath(controller);
  const segment = getVoiceBridgeHttpEndpointSegment(controller, endpoint);
  return buildEndpointPath(base, segment);
};

export const getVoiceBridgeWebsocketRoutePath = <Key extends VoiceBridgeWebsocketRouteKey>(key: Key) =>
  websocketSelectors.getRoutePath(key);

export const getVoiceBridgeWebsocketRouteDefinition = <Key extends VoiceBridgeWebsocketRouteKey>(key: Key) =>
  websocketSelectors.getRouteDefinition(key);

export const voiceBridgeBackgroundTriggers = defineBackgroundTriggers({} as const);

/**
 * @deprecated Prefer {@link getVoiceBridgeWebsocketRoutePath}.
 */
export const getVoiceBridgeRoutePath = getVoiceBridgeWebsocketRoutePath;

/**
 * @deprecated Voice bridge only exposes WebSocket routes; this helper remains for backwards compatibility.
 */
export const getVoiceBridgeRouteKind = <Key extends VoiceBridgeWebsocketRouteKey>(_key: Key) => "websocket" as const;
