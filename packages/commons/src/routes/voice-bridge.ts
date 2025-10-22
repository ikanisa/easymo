const routeDefinitions = Object.freeze({
  mediaStream: { kind: "websocket" as const, path: "/media" as const },
});

export type VoiceBridgeRoutes = typeof routeDefinitions;
export type VoiceBridgeRouteKey = keyof VoiceBridgeRoutes;

export const voiceBridgeRoutes = routeDefinitions;

export const getVoiceBridgeRoutePath = <Key extends VoiceBridgeRouteKey>(key: Key) =>
  voiceBridgeRoutes[key].path;

export const getVoiceBridgeRouteKind = <Key extends VoiceBridgeRouteKey>(key: Key) =>
  voiceBridgeRoutes[key].kind;
