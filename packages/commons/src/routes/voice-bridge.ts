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

const websocketRouteDefinitions = defineWebsocketRoutes({
  mediaStream: { path: "/twilio-media" as const, description: "Twilio Media Stream ingress" },
  twilioMediaStream: { path: "/twilio-media" as const, description: "Twilio Media Stream ingress" },
} as const satisfies Record<string, WebSocketRouteDefinition>);

export type VoiceBridgeHttpRoutes = typeof voiceBridgeHttpRouteDefinitions;
export type VoiceBridgeHttpControllerKey = keyof VoiceBridgeHttpRoutes;
export type VoiceBridgeHttpEndpointKey<Controller extends VoiceBridgeHttpControllerKey> = keyof VoiceBridgeHttpRoutes[Controller]["endpoints"];

export const voiceBridgeHttpRoutes = httpControllerDefinitions;
export const voiceBridgeWebsocketRoutes = websocketRouteDefinitions;
export type VoiceBridgeWebsocketRoutes = typeof websocketRouteDefinitions;

type LegacyHttpRouteDefinition<Path extends string = string, Method extends string = string> = {
  kind: "http";
  method: Method;
  path: Path;
};

type LegacyWebsocketRouteDefinition<Path extends string = string> = {
  kind: "websocket";
  path: Path;
};

type LegacyRouteDefinition = LegacyHttpRouteDefinition | LegacyWebsocketRouteDefinition;

export const voiceBridgeRoutes = Object.freeze({
  health: {
    kind: "http" as const,
    method: voiceBridgeHttpRoutes.health.endpoints.status.method,
    path: buildEndpointPath(
      voiceBridgeHttpRoutes.health.basePath,
      voiceBridgeHttpRoutes.health.endpoints.status.segment,
    ),
  },
  analyticsLiveCalls: {
    kind: "http" as const,
    method: voiceBridgeHttpRoutes.analytics.endpoints.liveCalls.method,
    path: buildEndpointPath(
      voiceBridgeHttpRoutes.analytics.basePath,
      voiceBridgeHttpRoutes.analytics.endpoints.liveCalls.segment,
    ),
  },
  outboundCalls: {
    kind: "http" as const,
    method: voiceBridgeHttpRoutes.calls.endpoints.outbound.method,
    path: buildEndpointPath(
      voiceBridgeHttpRoutes.calls.basePath,
      voiceBridgeHttpRoutes.calls.endpoints.outbound.segment,
    ),
  },
  mediaStream: {
    kind: "websocket" as const,
    path: voiceBridgeWebsocketRoutes.mediaStream.path,
  },
  twilioMediaStream: {
    kind: "websocket" as const,
    path: voiceBridgeWebsocketRoutes.twilioMediaStream.path,
  },
} as const satisfies Record<string, LegacyRouteDefinition>);

export type VoiceBridgeRoutes = typeof voiceBridgeRoutes;
export type VoiceBridgeRouteKey = keyof VoiceBridgeRoutes;
export type VoiceBridgeRouteRecord<Key extends VoiceBridgeRouteKey = VoiceBridgeRouteKey> = VoiceBridgeRoutes[Key];

type ExtractRouteKeys<Kind extends VoiceBridgeRouteRecord["kind"]> = {
  [Key in VoiceBridgeRouteKey]: VoiceBridgeRouteRecord<Key>["kind"] extends Kind ? Key : never;
}[VoiceBridgeRouteKey];

export type VoiceBridgeHttpRouteKey = ExtractRouteKeys<"http">;
export type VoiceBridgeWebsocketRouteKey = ExtractRouteKeys<"websocket">;

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

/**
 * @deprecated Prefer {@link getVoiceBridgeWebsocketRoutePath}.
 */
export const getVoiceBridgeRoutePath = <Key extends VoiceBridgeRouteKey>(key: Key) => voiceBridgeRoutes[key].path;

/**
 * @deprecated Legacy helper retained for backwards compatibility with {@link voiceBridgeRoutes}.
 */
export const getVoiceBridgeRouteKind = <Key extends VoiceBridgeRouteKey>(key: Key) => voiceBridgeRoutes[key].kind;

/**
 * @deprecated Prefer {@link getVoiceBridgeHttpEndpointMethod}.
 */
export const getVoiceBridgeHttpRouteMethod = <Key extends VoiceBridgeHttpRouteKey>(key: Key) => {
  const route = voiceBridgeRoutes[key];
  if (route.kind !== "http") {
    throw new Error(`Route ${String(key)} is not an HTTP route`);
  }
  return route.method;
};
