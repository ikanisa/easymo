import type { HttpMethod } from "./utils";

type VoiceBridgeHttpRouteDefinition<
  Path extends string = string,
  Method extends HttpMethod = HttpMethod,
> = {
  kind: "http";
  method: Method;
  path: Path;
};

type VoiceBridgeWebsocketRouteDefinition<Path extends string = string> = {
  kind: "websocket";
  path: Path;
};

type VoiceBridgeRouteDefinition =
  | VoiceBridgeHttpRouteDefinition
  | VoiceBridgeWebsocketRouteDefinition;

const routeDefinitions = Object.freeze({
  health: { kind: "http", method: "GET", path: "/health" },
  analyticsLiveCalls: {
    kind: "http",
    method: "GET",
    path: "/analytics/live-calls",
  },
  outboundCalls: {
    kind: "http",
    method: "POST",
    path: "/calls/outbound",
  },
  mediaStream: { kind: "websocket", path: "/media" },
  twilioMediaStream: { kind: "websocket", path: "/twilio-media" },
} as const satisfies Record<string, VoiceBridgeRouteDefinition>);

export type VoiceBridgeRoutes = typeof routeDefinitions;
export type VoiceBridgeRouteKey = keyof VoiceBridgeRoutes;
export type VoiceBridgeRouteRecord<Key extends VoiceBridgeRouteKey = VoiceBridgeRouteKey> =
  VoiceBridgeRoutes[Key];

type ExtractRouteKeys<Kind extends VoiceBridgeRouteRecord["kind"]> = {
  [Key in VoiceBridgeRouteKey]: VoiceBridgeRouteRecord<Key>["kind"] extends Kind ? Key : never;
}[VoiceBridgeRouteKey];

export type VoiceBridgeHttpRouteKey = ExtractRouteKeys<"http">;
export type VoiceBridgeWebsocketRouteKey = ExtractRouteKeys<"websocket">;

export const voiceBridgeRoutes = routeDefinitions;

export const getVoiceBridgeRoutePath = <Key extends VoiceBridgeRouteKey>(key: Key) =>
  voiceBridgeRoutes[key].path;

export const getVoiceBridgeRouteKind = <Key extends VoiceBridgeRouteKey>(key: Key) =>
  voiceBridgeRoutes[key].kind;

export const getVoiceBridgeHttpRouteMethod = <Key extends VoiceBridgeHttpRouteKey>(key: Key) => {
  const route = voiceBridgeRoutes[key];
  if (route.kind !== "http") {
    throw new Error(`Route ${String(key)} is not an HTTP route`);
  }
  return route.method;
};
