import { buildEndpointPath, type HttpMethod } from "./utils";

const controllerDefinitions = Object.freeze({
  sip: { basePath: "sip" as const },
  health: { basePath: "health" as const },
});

export type SipIngressControllers = typeof controllerDefinitions;
export type SipIngressControllerKey = keyof SipIngressControllers;

const routeDefinitions = Object.freeze({
  events: { controller: "sip", method: "POST" as HttpMethod, segment: "events" },
  health: { controller: "health", method: "GET" as HttpMethod, segment: "" },
} as const satisfies Record<
  string,
  {
    controller: SipIngressControllerKey;
    method: HttpMethod;
    segment: string;
  }
>);

export type SipIngressRoutes = typeof routeDefinitions;
export type SipIngressRouteKey = keyof SipIngressRoutes;

export const sipIngressRoutes = routeDefinitions;

export const getSipIngressControllerBasePath = <Key extends SipIngressControllerKey>(key: Key) =>
  controllerDefinitions[key].basePath;

export const getSipIngressRouteSegment = <Key extends SipIngressRouteKey>(key: Key) =>
  sipIngressRoutes[key].segment;

export const getSipIngressRouteMethod = <Key extends SipIngressRouteKey>(key: Key) =>
  sipIngressRoutes[key].method;

export const getSipIngressRoutePath = <Key extends SipIngressRouteKey>(key: Key) => {
  const definition = sipIngressRoutes[key];
  const basePath = getSipIngressControllerBasePath(definition.controller);
  return buildEndpointPath(basePath, definition.segment);
};
