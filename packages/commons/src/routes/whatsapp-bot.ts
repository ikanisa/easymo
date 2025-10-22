import {
  buildEndpointPath,
  defineBackgroundTriggers,
  defineHttpControllers,
  type ControllerDefinition,
  type EndpointDefinition,
} from "./utils";

const controllerDefinitions = defineHttpControllers({
  webhook: {
    basePath: "webhook" as const,
    endpoints: {
      verify: { method: "GET" as const, segment: "" as const },
      inbound: { method: "POST" as const, segment: "" as const },
    },
  },
  health: {
    basePath: "health" as const,
    endpoints: {
      status: { method: "GET" as const, segment: "" as const },
    },
  },
} as const satisfies Record<string, ControllerDefinition<Record<string, EndpointDefinition>>>);

export type WhatsappBotRoutes = typeof controllerDefinitions;
export type WhatsappBotControllerKey = keyof WhatsappBotRoutes;
export type WhatsappBotEndpointKey<Controller extends WhatsappBotControllerKey> = keyof WhatsappBotRoutes[Controller]["endpoints"];

export const whatsappBotRoutes = controllerDefinitions;

export const getWhatsappBotControllerBasePath = <Controller extends WhatsappBotControllerKey>(controller: Controller) =>
  whatsappBotRoutes[controller].basePath;

export const getWhatsappBotEndpointSegment = <
  Controller extends WhatsappBotControllerKey,
  Endpoint extends WhatsappBotEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const controllerRoutes = whatsappBotRoutes[controller] as ControllerDefinition<Record<string, EndpointDefinition>>;
  const endpoints = controllerRoutes.endpoints as Record<string, EndpointDefinition>;
  return endpoints[endpoint as string].segment;
};

export const getWhatsappBotEndpointMethod = <
  Controller extends WhatsappBotControllerKey,
  Endpoint extends WhatsappBotEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const controllerRoutes = whatsappBotRoutes[controller] as ControllerDefinition<Record<string, EndpointDefinition>>;
  const endpoints = controllerRoutes.endpoints as Record<string, EndpointDefinition>;
  return endpoints[endpoint as string].method;
};

export const getWhatsappBotEndpointPath = <
  Controller extends WhatsappBotControllerKey,
  Endpoint extends WhatsappBotEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const base = getWhatsappBotControllerBasePath(controller);
  const segment = getWhatsappBotEndpointSegment(controller, endpoint);
  return buildEndpointPath(base, segment);
};

export const whatsappBotBackgroundTriggers = defineBackgroundTriggers({
  /**
   * Outbound messaging currently flows through Kafka topics and is not exposed via HTTP.
   * Only webhook ingestion and health checks are represented here.
   */
} as const);
