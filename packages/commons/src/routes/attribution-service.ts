import { buildEndpointPath, type HttpMethod } from "./utils";

const controllerDefinitions = Object.freeze({
  attribution: { basePath: "attribution" as const },
  health: { basePath: "health" as const },
});

export type AttributionServiceControllers = typeof controllerDefinitions;
export type AttributionServiceControllerKey = keyof AttributionServiceControllers;

const routeDefinitions = Object.freeze({
  evaluate: {
    controller: "attribution",
    method: "POST" as HttpMethod,
    segment: "evaluate",
    scopes: ["attribution:write"] as const,
  },
  evidence: {
    controller: "attribution",
    method: "POST" as HttpMethod,
    segment: "evidence",
    scopes: ["attribution:write"] as const,
  },
  disputes: {
    controller: "attribution",
    method: "POST" as HttpMethod,
    segment: "disputes",
    scopes: ["attribution:write"] as const,
  },
  health: { controller: "health", method: "GET" as HttpMethod, segment: "" },
} as const satisfies Record<
  string,
  {
    controller: AttributionServiceControllerKey;
    method: HttpMethod;
    segment: string;
    scopes?: readonly string[];
  }
>);

export type AttributionServiceRoutes = typeof routeDefinitions;
export type AttributionServiceRouteKey = keyof AttributionServiceRoutes;

export const attributionServiceRoutes = routeDefinitions;

export const getAttributionServiceControllerBasePath = <
  Key extends AttributionServiceControllerKey
>(key: Key) => controllerDefinitions[key].basePath;

export const getAttributionServiceRouteSegment = <Key extends AttributionServiceRouteKey>(key: Key) =>
  attributionServiceRoutes[key].segment;

export const getAttributionServiceRouteMethod = <Key extends AttributionServiceRouteKey>(key: Key) =>
  attributionServiceRoutes[key].method;

export const getAttributionServiceRoutePath = <Key extends AttributionServiceRouteKey>(key: Key) => {
  const definition = attributionServiceRoutes[key];
  const basePath = getAttributionServiceControllerBasePath(definition.controller);
  return buildEndpointPath(basePath, definition.segment);
};

export const getAttributionServiceRouteRequiredScopes = <Key extends AttributionServiceRouteKey>(key: Key) => {
  const definition = attributionServiceRoutes[key];
  return "scopes" in definition ? definition.scopes ?? [] : [];
};
