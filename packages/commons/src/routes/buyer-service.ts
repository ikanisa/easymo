import {
  buildEndpointPath,
  defineBackgroundTriggers,
  defineHttpControllers,
  type ControllerDefinition,
  type EndpointDefinition,
} from "./utils";

const controllerDefinitions = defineHttpControllers({
  buyers: {
    basePath: "buyers" as const,
    endpoints: {
      create: { method: "POST" as const, segment: "" as const },
      createIntent: { method: "POST" as const, segment: ":id/intents" as const },
      context: { method: "GET" as const, segment: ":id/context" as const },
    },
  },
  intents: {
    basePath: "intents" as const,
    endpoints: {
      list: { method: "GET" as const, segment: "" as const },
    },
  },
  purchases: {
    basePath: "purchases" as const,
    endpoints: {
      create: { method: "POST" as const, segment: "" as const },
      list: { method: "GET" as const, segment: "" as const },
    },
  },
  health: {
    basePath: "health" as const,
    endpoints: {
      status: { method: "GET" as const, segment: "" as const },
    },
  },
} as const satisfies Record<string, ControllerDefinition<Record<string, EndpointDefinition>>>);

export type BuyerServiceRoutes = typeof controllerDefinitions;
export type BuyerServiceControllerKey = keyof BuyerServiceRoutes;
export type BuyerServiceEndpointKey<Controller extends BuyerServiceControllerKey> = keyof BuyerServiceRoutes[Controller]["endpoints"];

export const buyerServiceRoutes = controllerDefinitions;

export const getBuyerServiceControllerBasePath = <Controller extends BuyerServiceControllerKey>(controller: Controller) =>
  buyerServiceRoutes[controller].basePath;

export const getBuyerServiceEndpointSegment = <
  Controller extends BuyerServiceControllerKey,
  Endpoint extends BuyerServiceEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const controllerRoutes = buyerServiceRoutes[controller] as ControllerDefinition<Record<string, EndpointDefinition>>;
  const endpoints = controllerRoutes.endpoints as Record<string, EndpointDefinition>;
  return endpoints[endpoint as string].segment;
};

export const getBuyerServiceEndpointMethod = <
  Controller extends BuyerServiceControllerKey,
  Endpoint extends BuyerServiceEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const controllerRoutes = buyerServiceRoutes[controller] as ControllerDefinition<Record<string, EndpointDefinition>>;
  const endpoints = controllerRoutes.endpoints as Record<string, EndpointDefinition>;
  return endpoints[endpoint as string].method;
};

export const getBuyerServiceEndpointPath = <
  Controller extends BuyerServiceControllerKey,
  Endpoint extends BuyerServiceEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const base = getBuyerServiceControllerBasePath(controller);
  const segment = getBuyerServiceEndpointSegment(controller, endpoint);
  return buildEndpointPath(base, segment);
};

export const buyerServiceBackgroundTriggers = defineBackgroundTriggers({} as const);
