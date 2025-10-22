import {
  buildEndpointPath,
  defineHttpControllers,
  type ControllerDefinition,
  type EndpointDefinition,
} from "./utils";

const whatsappBotRouteDefinitions = defineHttpControllers({
  webhook: {
    basePath: "webhook" as const,
    description: "Meta WhatsApp webhook handler",
    endpoints: {
      verify: {
        method: "GET" as const,
        segment: "" as const,
        notes: "Expects hub.verify_token and hub.challenge query params",
      },
      ingest: { method: "POST" as const, segment: "" as const, notes: "Parses Meta webhook payloads" },
    },
  },
  health: {
    basePath: "health" as const,
    endpoints: {
      status: { method: "GET" as const, segment: "" as const },
    },
  },
} as const satisfies Record<string, ControllerDefinition<Record<string, EndpointDefinition>>>);

export type WhatsappBotRoutes = typeof whatsappBotRouteDefinitions;
export type WhatsappBotControllerKey = keyof WhatsappBotRoutes;
export type WhatsappBotEndpointKey<Controller extends WhatsappBotControllerKey> =
  keyof WhatsappBotRoutes[Controller]["endpoints"];

export const whatsappBotRoutes = whatsappBotRouteDefinitions;

export const getWhatsappBotControllerBasePath = <Controller extends WhatsappBotControllerKey>(controller: Controller) =>
  whatsappBotRoutes[controller].basePath;

export const getWhatsappBotEndpointSegment = <
  Controller extends WhatsappBotControllerKey,
  Endpoint extends WhatsappBotEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const controllerRoutes = whatsappBotRoutes[controller] as WhatsappBotRoutes[Controller];
  const endpoints = controllerRoutes.endpoints as Record<WhatsappBotEndpointKey<Controller>, EndpointDefinition>;
  return endpoints[endpoint].segment;
};

export const getWhatsappBotEndpointMethod = <
  Controller extends WhatsappBotControllerKey,
  Endpoint extends WhatsappBotEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const controllerRoutes = whatsappBotRoutes[controller] as WhatsappBotRoutes[Controller];
  const endpoints = controllerRoutes.endpoints as Record<WhatsappBotEndpointKey<Controller>, EndpointDefinition>;
  return endpoints[endpoint].method;
};

export const getWhatsappBotEndpointPath = <
  Controller extends WhatsappBotControllerKey,
  Endpoint extends WhatsappBotEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const base = getWhatsappBotControllerBasePath(controller);
  const segment = getWhatsappBotEndpointSegment(controller, endpoint);
  return buildEndpointPath(base, segment);
};
