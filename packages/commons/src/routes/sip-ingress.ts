import {
  buildEndpointPath,
  defineHttpControllers,
  type ControllerDefinition,
  type EndpointDefinition,
} from "./utils";

const sipIngressRouteDefinitions = defineHttpControllers({
  sip: {
    basePath: "sip" as const,
    description: "Ingress for SIP provider webhooks",
    endpoints: {
      events: {
        method: "POST" as const,
        segment: "events" as const,
        notes: "Publishes events to Kafka after idempotency checks",
      },
    },
  },
  health: {
    basePath: "health" as const,
    endpoints: {
      status: { method: "GET" as const, segment: "" as const },
    },
  },
} as const satisfies Record<string, ControllerDefinition<Record<string, EndpointDefinition>>>);

export type SipIngressRoutes = typeof sipIngressRouteDefinitions;
export type SipIngressControllerKey = keyof SipIngressRoutes;
export type SipIngressEndpointKey<Controller extends SipIngressControllerKey> =
  keyof SipIngressRoutes[Controller]["endpoints"];

export const sipIngressRoutes = sipIngressRouteDefinitions;

export const getSipIngressControllerBasePath = <Controller extends SipIngressControllerKey>(controller: Controller) =>
  sipIngressRoutes[controller].basePath;

export const getSipIngressEndpointSegment = <
  Controller extends SipIngressControllerKey,
  Endpoint extends SipIngressEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const controllerRoutes = sipIngressRoutes[controller] as SipIngressRoutes[Controller];
  const endpoints = controllerRoutes.endpoints as Record<SipIngressEndpointKey<Controller>, EndpointDefinition>;
  return endpoints[endpoint].segment;
};

export const getSipIngressEndpointMethod = <
  Controller extends SipIngressControllerKey,
  Endpoint extends SipIngressEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const controllerRoutes = sipIngressRoutes[controller] as SipIngressRoutes[Controller];
  const endpoints = controllerRoutes.endpoints as Record<SipIngressEndpointKey<Controller>, EndpointDefinition>;
  return endpoints[endpoint].method;
};

export const getSipIngressEndpointPath = <
  Controller extends SipIngressControllerKey,
  Endpoint extends SipIngressEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const base = getSipIngressControllerBasePath(controller);
  const segment = getSipIngressEndpointSegment(controller, endpoint);
  return buildEndpointPath(base, segment);
};
