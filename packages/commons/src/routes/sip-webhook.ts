import {
  buildEndpointPath,
  defineHttpControllers,
  type ControllerDefinition,
  type EndpointDefinition,
} from "./http-utils.js";

const sipWebhookRoutes = defineHttpControllers({
  voice: {
    basePath: "voice" as const,
    endpoints: {
      incoming: { method: "POST" as const, segment: "incoming" as const },
      status: { method: "POST" as const, segment: "status" as const },
    },
  },
  dial: {
    basePath: "dial" as const,
    endpoints: {
      outbound: { method: "POST" as const, segment: "outbound" as const },
    },
  },
} as const satisfies Record<string, ControllerDefinition<Record<string, EndpointDefinition>>>);

export type SipWebhookRoutes = typeof sipWebhookRoutes;
export type SipWebhookControllerKey = keyof SipWebhookRoutes;
export type SipWebhookEndpointKey<Controller extends SipWebhookControllerKey> = keyof SipWebhookRoutes[Controller]["endpoints"];

export const sipWebhookRouteDefinitions = sipWebhookRoutes;

export const getSipWebhookControllerBasePath = <Controller extends SipWebhookControllerKey>(controller: Controller) =>
  sipWebhookRouteDefinitions[controller].basePath;

export const getSipWebhookEndpointSegment = <
  Controller extends SipWebhookControllerKey,
  Endpoint extends SipWebhookEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const controllerRoutes = sipWebhookRouteDefinitions[controller] as SipWebhookRoutes[Controller];
  const endpoints = controllerRoutes.endpoints as Record<SipWebhookEndpointKey<Controller>, EndpointDefinition>;
  return endpoints[endpoint].segment;
};

export const getSipWebhookEndpointMethod = <
  Controller extends SipWebhookControllerKey,
  Endpoint extends SipWebhookEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const controllerRoutes = sipWebhookRouteDefinitions[controller] as SipWebhookRoutes[Controller];
  const endpoints = controllerRoutes.endpoints as Record<SipWebhookEndpointKey<Controller>, EndpointDefinition>;
  return endpoints[endpoint].method;
};

export const getSipWebhookEndpointPath = <
  Controller extends SipWebhookControllerKey,
  Endpoint extends SipWebhookEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const base = getSipWebhookControllerBasePath(controller);
  const segment = getSipWebhookEndpointSegment(controller, endpoint);
  return buildEndpointPath(base, segment);
};
