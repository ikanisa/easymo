import {
  buildEndpointPath,
  defineHttpControllers,
  defineWebSocketRoutes,
  type ControllerDefinition,
  type EndpointDefinition,
  type WebSocketRouteDefinition,
} from "./http-utils.js";

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
        notes: "Requires service auth scope voice:outbound.write",
        requiredScopes: ["voice:outbound.write"],
      },
    },
  },
} as const satisfies Record<string, ControllerDefinition<Record<string, EndpointDefinition>>>);

const voiceBridgeWebSocketRouteDefinitions = defineWebSocketRoutes({
  mediaStream: { path: "/twilio-media" as const, description: "Twilio Media Stream ingress" },
  twilioMediaStream: { path: "/twilio-media" as const, description: "Twilio Media Stream ingress" },
} as const satisfies Record<string, WebSocketRouteDefinition>);

export type VoiceBridgeHttpRoutes = typeof voiceBridgeHttpRouteDefinitions;
export type VoiceBridgeHttpControllerKey = keyof VoiceBridgeHttpRoutes;
export type VoiceBridgeHttpEndpointKey<Controller extends VoiceBridgeHttpControllerKey> =
  keyof VoiceBridgeHttpRoutes[Controller]["endpoints"];

export const voiceBridgeHttpRoutes = voiceBridgeHttpRouteDefinitions;
export const voiceBridgeWebSocketRoutes = voiceBridgeWebSocketRouteDefinitions;
export type VoiceBridgeWebSocketRoutes = typeof voiceBridgeWebSocketRouteDefinitions;

type LegacyHttpRouteDefinition<Path extends string = string> = {
  kind: "http";
  method: EndpointDefinition["method"];
  path: Path;
  requiredScopes: ReadonlyArray<string>;
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
    requiredScopes: [
      ...(((voiceBridgeHttpRoutes.health.endpoints.status as unknown) as EndpointDefinition).requiredScopes ?? []),
    ],
  },
  analyticsLiveCalls: {
    kind: "http" as const,
    method: voiceBridgeHttpRoutes.analytics.endpoints.liveCalls.method,
    path: buildEndpointPath(
      voiceBridgeHttpRoutes.analytics.basePath,
      voiceBridgeHttpRoutes.analytics.endpoints.liveCalls.segment,
    ),
    requiredScopes: [
      ...(((voiceBridgeHttpRoutes.analytics.endpoints.liveCalls as unknown) as EndpointDefinition).requiredScopes ?? []),
    ],
  },
  outboundCalls: {
    kind: "http" as const,
    method: voiceBridgeHttpRoutes.calls.endpoints.outbound.method,
    path: buildEndpointPath(
      voiceBridgeHttpRoutes.calls.basePath,
      voiceBridgeHttpRoutes.calls.endpoints.outbound.segment,
    ),
    requiredScopes: [
      ...(((voiceBridgeHttpRoutes.calls.endpoints.outbound as unknown) as EndpointDefinition).requiredScopes ?? []),
    ],
  },
  mediaStream: {
    kind: "websocket" as const,
    path: voiceBridgeWebSocketRoutes.mediaStream.path,
  },
  twilioMediaStream: {
    kind: "websocket" as const,
    path: voiceBridgeWebSocketRoutes.twilioMediaStream.path,
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

export const getVoiceBridgeHttpControllerBasePath = <Controller extends VoiceBridgeHttpControllerKey>(controller: Controller) =>
  voiceBridgeHttpRoutes[controller].basePath;

/** @deprecated Prefer {@link getVoiceBridgeHttpControllerBasePath}. */
export const getVoiceBridgeControllerBasePath = getVoiceBridgeHttpControllerBasePath;

export const getVoiceBridgeHttpEndpointSegment = <
  Controller extends VoiceBridgeHttpControllerKey,
  Endpoint extends VoiceBridgeHttpEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const controllerRoutes = voiceBridgeHttpRoutes[controller] as VoiceBridgeHttpRoutes[Controller];
  const endpoints = controllerRoutes.endpoints as Record<
    VoiceBridgeHttpEndpointKey<Controller>,
    EndpointDefinition
  >;
  return endpoints[endpoint].segment;
};

/** @deprecated Prefer {@link getVoiceBridgeHttpEndpointSegment}. */
export const getVoiceBridgeEndpointSegment = getVoiceBridgeHttpEndpointSegment;

export const getVoiceBridgeHttpEndpointMethod = <
  Controller extends VoiceBridgeHttpControllerKey,
  Endpoint extends VoiceBridgeHttpEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const controllerRoutes = voiceBridgeHttpRoutes[controller] as VoiceBridgeHttpRoutes[Controller];
  const endpoints = controllerRoutes.endpoints as Record<
    VoiceBridgeHttpEndpointKey<Controller>,
    EndpointDefinition
  >;
  return endpoints[endpoint].method;
};

/** @deprecated Prefer {@link getVoiceBridgeHttpEndpointMethod}. */
export const getVoiceBridgeEndpointMethod = getVoiceBridgeHttpEndpointMethod;

export const getVoiceBridgeHttpEndpointRequiredScopes = <
  Controller extends VoiceBridgeHttpControllerKey,
  Endpoint extends VoiceBridgeHttpEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const controllerRoutes = voiceBridgeHttpRoutes[controller] as VoiceBridgeHttpRoutes[Controller];
  const endpoints = controllerRoutes.endpoints as Record<
    VoiceBridgeHttpEndpointKey<Controller>,
    EndpointDefinition
  >;
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

/** @deprecated Prefer {@link getVoiceBridgeHttpEndpointPath}. */
export const getVoiceBridgeEndpointPath = getVoiceBridgeHttpEndpointPath;

export const getVoiceBridgeRoutePath = <Key extends VoiceBridgeRouteKey>(key: Key) => voiceBridgeRoutes[key].path;

export const getVoiceBridgeRouteKind = <Key extends VoiceBridgeRouteKey>(key: Key) => voiceBridgeRoutes[key].kind;

export const getVoiceBridgeRouteRequiredScopes = <Key extends VoiceBridgeRouteKey>(key: Key) => {
  const route = voiceBridgeRoutes[key];
  if (route.kind !== "http") {
    return [] as ReadonlyArray<string>;
  }
  return [...route.requiredScopes];
};

export const getVoiceBridgeHttpRouteMethod = <Key extends VoiceBridgeHttpRouteKey>(key: Key) => {
  const route = voiceBridgeRoutes[key];
  if (route.kind !== "http") {
    throw new Error(`Route ${String(key)} is not an HTTP route`);
  }
  return route.method;
};

export const getVoiceBridgeHttpRouteRequiredScopes = <Key extends VoiceBridgeHttpRouteKey>(key: Key) => {
  const route = voiceBridgeRoutes[key];
  if (route.kind !== "http") {
    throw new Error(`Route ${String(key)} is not an HTTP route`);
  }
  return [...route.requiredScopes];
};
