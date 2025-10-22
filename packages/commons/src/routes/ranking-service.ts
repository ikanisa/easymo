import {
  buildEndpointPath,
  defineHttpControllers,
  type ControllerDefinition,
  type EndpointDefinition,
} from "./http-utils.js";

const rankingServiceRouteDefinitions = defineHttpControllers({
  ranking: {
    basePath: "ranking" as const,
    endpoints: {
      vendors: { method: "GET" as const, segment: "vendors" as const, notes: "Feature flag marketplace.ranking" },
    },
  },
  health: {
    basePath: "health" as const,
    endpoints: {
      status: { method: "GET" as const, segment: "" as const },
    },
  },
} as const satisfies Record<string, ControllerDefinition<Record<string, EndpointDefinition>>>);

export type RankingServiceRoutes = typeof rankingServiceRouteDefinitions;
export type RankingServiceControllerKey = keyof RankingServiceRoutes;
export type RankingServiceEndpointKey<Controller extends RankingServiceControllerKey> =
  keyof RankingServiceRoutes[Controller]["endpoints"];

export const rankingServiceRoutes = rankingServiceRouteDefinitions;

export const getRankingServiceControllerBasePath = <Controller extends RankingServiceControllerKey>(controller: Controller) =>
  rankingServiceRoutes[controller].basePath;

export const getRankingServiceEndpointSegment = <
  Controller extends RankingServiceControllerKey,
  Endpoint extends RankingServiceEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const controllerRoutes = rankingServiceRoutes[controller] as RankingServiceRoutes[Controller];
  const endpoints = controllerRoutes.endpoints as Record<RankingServiceEndpointKey<Controller>, EndpointDefinition>;
  return endpoints[endpoint].segment;
};

export const getRankingServiceEndpointMethod = <
  Controller extends RankingServiceControllerKey,
  Endpoint extends RankingServiceEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const controllerRoutes = rankingServiceRoutes[controller] as RankingServiceRoutes[Controller];
  const endpoints = controllerRoutes.endpoints as Record<RankingServiceEndpointKey<Controller>, EndpointDefinition>;
  return endpoints[endpoint].method;
};

export const getRankingServiceEndpointPath = <
  Controller extends RankingServiceControllerKey,
  Endpoint extends RankingServiceEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const base = getRankingServiceControllerBasePath(controller);
  const segment = getRankingServiceEndpointSegment(controller, endpoint);
  return buildEndpointPath(base, segment);
};
