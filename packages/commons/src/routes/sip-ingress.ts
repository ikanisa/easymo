import {
  buildEndpointPath,
  defineBackgroundTriggers,
  defineHttpControllers,
  type ControllerDefinition,
  type EndpointDefinition,
} from "./utils";

const controllerDefinitions = defineHttpControllers({
  sip: {
    basePath: "sip" as const,
    endpoints: {
      events: { method: "POST" as const, segment: "events" as const },
    },
  },
  health: {
    basePath: "health" as const,
    endpoints: {
      status: { method: "GET" as const, segment: "" as const },
    },
  },
} as const satisfies Record<string, ControllerDefinition<Record<string, EndpointDefinition>>>);

export type SipIngressRoutes = typeof controllerDefinitions;
export type SipIngressControllerKey = keyof SipIngressRoutes;
export type SipIngressEndpointKey<Controller extends SipIngressControllerKey> = keyof SipIngressRoutes[Controller]["endpoints"];

export const sipIngressRoutes = controllerDefinitions;

export const getSipIngressControllerBasePath = <Controller extends SipIngressControllerKey>(controller: Controller) =>
  sipIngressRoutes[controller].basePath;

export const getSipIngressEndpointSegment = <
  Controller extends SipIngressControllerKey,
  Endpoint extends SipIngressEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const controllerRoutes = sipIngressRoutes[controller] as ControllerDefinition<Record<string, EndpointDefinition>>;
  const endpoints = controllerRoutes.endpoints as Record<string, EndpointDefinition>;
  return endpoints[endpoint as string].segment;
};

export const getSipIngressEndpointMethod = <
  Controller extends SipIngressControllerKey,
  Endpoint extends SipIngressEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const controllerRoutes = sipIngressRoutes[controller] as ControllerDefinition<Record<string, EndpointDefinition>>;
  const endpoints = controllerRoutes.endpoints as Record<string, EndpointDefinition>;
  return endpoints[endpoint as string].method;
};

export const getSipIngressEndpointPath = <
  Controller extends SipIngressControllerKey,
  Endpoint extends SipIngressEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const base = getSipIngressControllerBasePath(controller);
  const segment = getSipIngressEndpointSegment(controller, endpoint);
  return buildEndpointPath(base, segment);
};

export const sipIngressBackgroundTriggers = defineBackgroundTriggers({} as const);
