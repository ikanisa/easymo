import { buildEndpointPath, type HttpMethod } from "./utils";

const controllerDefinitions = Object.freeze({
  health: { basePath: "health" as const },
  analytics: { basePath: "analytics" as const },
  calls: { basePath: "calls" as const },
  media: { basePath: "twilio-media" as const },
});

export type VoiceBridgeControllers = typeof controllerDefinitions;
export type VoiceBridgeControllerKey = keyof VoiceBridgeControllers;

type VoiceBridgeHttpRouteDefinition = {
  kind: "http";
  controller: VoiceBridgeControllerKey;
  method: HttpMethod;
  segment: string;
  scopes?: readonly string[];
};

type VoiceBridgeWebsocketRouteDefinition = {
  kind: "websocket";
  controller: VoiceBridgeControllerKey;
  segment: string;
  scopes?: readonly string[];
};

type VoiceBridgeRouteDefinition =
  | VoiceBridgeHttpRouteDefinition
  | VoiceBridgeWebsocketRouteDefinition;

const routeDefinitions = Object.freeze({
  health: { kind: "http", controller: "health", method: "GET", segment: "" },
  analyticsLiveCalls: {
    kind: "http",
    controller: "analytics",
    method: "GET",
    segment: "live-calls",
    scopes: ["voice:read"] as const,
  },
  callsOutbound: {
    kind: "http",
    controller: "calls",
    method: "POST",
    segment: "outbound",
    scopes: ["voice:outbound.write"] as const,
  },
  mediaStream: { kind: "websocket", controller: "media", segment: "" },
} as const satisfies Record<string, VoiceBridgeRouteDefinition>);

export type VoiceBridgeRoutes = typeof routeDefinitions;
export type VoiceBridgeRouteKey = keyof VoiceBridgeRoutes;

export const voiceBridgeRoutes = routeDefinitions;

export const getVoiceBridgeControllerBasePath = <Key extends VoiceBridgeControllerKey>(key: Key) =>
  controllerDefinitions[key].basePath;

export const getVoiceBridgeRouteKind = <Key extends VoiceBridgeRouteKey>(key: Key) =>
  voiceBridgeRoutes[key].kind;

export const getVoiceBridgeRoutePath = <Key extends VoiceBridgeRouteKey>(key: Key) => {
  const definition = voiceBridgeRoutes[key];
  const basePath = getVoiceBridgeControllerBasePath(definition.controller);
  return buildEndpointPath(basePath, definition.segment);
};

export const getVoiceBridgeRouteMethod = <Key extends VoiceBridgeRouteKey>(key: Key) => {
  const definition = voiceBridgeRoutes[key];
  return definition.kind === "http" ? definition.method : undefined;
};

export const getVoiceBridgeRouteRequiredScopes = <Key extends VoiceBridgeRouteKey>(key: Key) => {
  const definition = voiceBridgeRoutes[key];
  return "scopes" in definition ? definition.scopes ?? [] : [];
};
