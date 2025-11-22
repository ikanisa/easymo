import {
  buildEndpointPath,
  type ControllerDefinition,
  defineHttpControllers,
  type EndpointDefinition,
  type HttpMethod,
} from "./utils";

const apiRouteDefinitions = defineHttpControllers({
  realtime: {
    basePath: "realtime" as const,
    endpoints: {
      webhook: { method: "POST" as const, segment: "webhook" as const },
      events: { method: "POST" as const, segment: "events" as const },
      session: { method: "POST" as const, segment: "session" as const },
    },
  },
  waCalls: {
    basePath: "wa" as const,
    endpoints: {
      webhook: { method: "GET" as const, segment: "webhook" as const },
      events: { method: "POST" as const, segment: "events" as const },
    },
  },
  whatsappAgents: {
    basePath: "wa/agents" as const,
    endpoints: {
      start: { method: "POST" as const, segment: "start" as const },
      sendMessage: { method: "POST" as const, segment: ":threadId/message" as const },
      customerMessage: { method: "POST" as const, segment: ":threadId/customer" as const },
    },
  },
  whatsappFlow: {
    basePath: "wa/flow" as const,
    endpoints: {
      bootstrap: { method: "POST" as const, segment: "bootstrap" as const },
    },
  },
  whatsappCalls: {
    basePath: "wa" as const,
    endpoints: {
      webhook: { method: "GET" as const, segment: "webhook" as const },
      events: { method: "POST" as const, segment: "events" as const },
    },
  },
  twilio: {
    basePath: "twilio" as const,
    endpoints: {
      status: { method: "POST" as const, segment: "status" as const },
    },
  },
  twiml: {
    basePath: "twiml" as const,
    endpoints: {
      warmTransfer: { method: "GET" as const, segment: "warm-transfer" as const },
    },
  },
  payment: {
    basePath: "payment" as const,
    endpoints: {
      confirm: { method: "POST" as const, segment: "confirm" as const },
    },
  },
  driverParking: {
    basePath: "driver/parking" as const,
    endpoints: {
      list: { method: "GET" as const, segment: "" as const },
      create: { method: "POST" as const, segment: "" as const },
      update: { method: "PUT" as const, segment: ":id" as const },
      delete: { method: "DELETE" as const, segment: ":id" as const },
    },
  },
  driverAvailability: {
    basePath: "driver/availability" as const,
    endpoints: {
      list: { method: "GET" as const, segment: "" as const },
      create: { method: "POST" as const, segment: "" as const },
      update: { method: "PUT" as const, segment: ":id" as const },
      delete: { method: "DELETE" as const, segment: ":id" as const },
    },
  },
  broker: {
    basePath: "broker" as const,
    endpoints: {
      candidates: { method: "POST" as const, segment: "candidates" as const },
    },
  },
} as const satisfies Record<string, ControllerDefinition<Record<string, EndpointDefinition>>>);

export type ApiRoutes = typeof apiRouteDefinitions;
export type ApiControllerKey = keyof ApiRoutes;
export type ApiEndpointKey<Controller extends ApiControllerKey> = keyof ApiRoutes[Controller]["endpoints"];

export const apiRoutes = apiRouteDefinitions;

export const getApiControllerBasePath = <Controller extends ApiControllerKey>(controller: Controller) =>
  apiRoutes[controller].basePath;

export const getApiEndpointSegment = <Controller extends ApiControllerKey, Endpoint extends ApiEndpointKey<Controller>>(
  controller: Controller,
  endpoint: Endpoint,
) => {
  const controllerRoutes = apiRoutes[controller] as ApiRoutes[Controller];
  const endpoints = controllerRoutes.endpoints as Record<ApiEndpointKey<Controller>, EndpointDefinition>;
  return endpoints[endpoint].segment;
};

export const getApiEndpointMethod = <Controller extends ApiControllerKey, Endpoint extends ApiEndpointKey<Controller>>(
  controller: Controller,
  endpoint: Endpoint,
) => {
  const controllerRoutes = apiRoutes[controller] as ApiRoutes[Controller];
  const endpoints = controllerRoutes.endpoints as Record<ApiEndpointKey<Controller>, EndpointDefinition>;
  return endpoints[endpoint].method;
};

export const getApiEndpointPath = <Controller extends ApiControllerKey, Endpoint extends ApiEndpointKey<Controller>>(
  controller: Controller,
  endpoint: Endpoint,
) => {
  const base = getApiControllerBasePath(controller);
  const segment = getApiEndpointSegment(controller, endpoint);
  return buildEndpointPath(base, segment);
};

export type { ControllerDefinition as ApiControllerDefinition, EndpointDefinition as ApiEndpointDefinition, HttpMethod };
