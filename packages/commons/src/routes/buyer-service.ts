import {
  buildEndpointPath,
  defineHttpControllers,
  type ControllerDefinition,
  type EndpointDefinition,
} from "./http-utils.js";

const buyerServiceRouteDefinitions = defineHttpControllers({
  buyers: {
    basePath: "buyers" as const,
    description: "Buyer profile management",
    endpoints: {
      create: { method: "POST" as const, segment: "" as const, notes: "Feature flag marketplace.buyer" },
      createIntent: {
        method: "POST" as const,
        segment: ":id/intents" as const,
        notes: "Feature flag marketplace.buyer",
      },
      context: { method: "GET" as const, segment: ":id/context" as const, notes: "Feature flag marketplace.buyer" },
    },
  },
  intents: {
    basePath: "intents" as const,
    endpoints: {
      list: { method: "GET" as const, segment: "" as const, notes: "Feature flag marketplace.buyer" },
    },
  },
  purchases: {
    basePath: "purchases" as const,
    endpoints: {
      create: { method: "POST" as const, segment: "" as const, notes: "Feature flag marketplace.buyer" },
      list: { method: "GET" as const, segment: "" as const, notes: "Feature flag marketplace.buyer" },
    },
  },
  health: {
    basePath: "health" as const,
    endpoints: {
      status: { method: "GET" as const, segment: "" as const },
    },
  },
} as const satisfies Record<string, ControllerDefinition<Record<string, EndpointDefinition>>>);

export type BuyerServiceRoutes = typeof buyerServiceRouteDefinitions;
export type BuyerServiceControllerKey = keyof BuyerServiceRoutes;
export type BuyerServiceEndpointKey<Controller extends BuyerServiceControllerKey> =
  keyof BuyerServiceRoutes[Controller]["endpoints"];

export const buyerServiceRoutes = buyerServiceRouteDefinitions;

export const getBuyerServiceControllerBasePath = <Controller extends BuyerServiceControllerKey>(controller: Controller) =>
  buyerServiceRoutes[controller].basePath;

export const getBuyerServiceEndpointSegment = <
  Controller extends BuyerServiceControllerKey,
  Endpoint extends BuyerServiceEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const controllerRoutes = buyerServiceRoutes[controller] as BuyerServiceRoutes[Controller];
  const endpoints = controllerRoutes.endpoints as Record<BuyerServiceEndpointKey<Controller>, EndpointDefinition>;
  return endpoints[endpoint].segment;
};

export const getBuyerServiceEndpointMethod = <
  Controller extends BuyerServiceControllerKey,
  Endpoint extends BuyerServiceEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const controllerRoutes = buyerServiceRoutes[controller] as BuyerServiceRoutes[Controller];
  const endpoints = controllerRoutes.endpoints as Record<BuyerServiceEndpointKey<Controller>, EndpointDefinition>;
  return endpoints[endpoint].method;
};

export const getBuyerServiceEndpointPath = <
  Controller extends BuyerServiceControllerKey,
  Endpoint extends BuyerServiceEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const base = getBuyerServiceControllerBasePath(controller);
  const segment = getBuyerServiceEndpointSegment(controller, endpoint);
  return buildEndpointPath(base, segment);
};
