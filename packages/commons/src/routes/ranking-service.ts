import {
  buildEndpointPath,
  defineBackgroundTriggers,
  defineHttpControllers,
  type ControllerDefinition,
  type EndpointDefinition,
} from "./utils";

const controllerDefinitions = defineHttpControllers({
  ranking: {
    basePath: "ranking" as const,
    endpoints: {
      vendors: { method: "GET" as const, segment: "vendors" as const },
    },
  },
  health: {
    basePath: "health" as const,
    endpoints: {
      status: { method: "GET" as const, segment: "" as const },
    },
  },
} as const satisfies Record<string, ControllerDefinition<Record<string, EndpointDefinition>>>);

export type RankingServiceRoutes = typeof controllerDefinitions;
export type RankingServiceControllerKey = keyof RankingServiceRoutes;
export type RankingServiceEndpointKey<Controller extends RankingServiceControllerKey> = keyof RankingServiceRoutes[Controller]["endpoints"];

export const rankingServiceRoutes = controllerDefinitions;

export const getRankingServiceControllerBasePath = <Controller extends RankingServiceControllerKey>(controller: Controller) =>
  rankingServiceRoutes[controller].basePath;

export const getRankingServiceEndpointSegment = <
  Controller extends RankingServiceControllerKey,
  Endpoint extends RankingServiceEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const controllerRoutes = rankingServiceRoutes[controller] as ControllerDefinition<Record<string, EndpointDefinition>>;
  const endpoints = controllerRoutes.endpoints as Record<string, EndpointDefinition>;
  return endpoints[endpoint as string].segment;
};

export const getRankingServiceEndpointMethod = <
  Controller extends RankingServiceControllerKey,
  Endpoint extends RankingServiceEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const controllerRoutes = rankingServiceRoutes[controller] as ControllerDefinition<Record<string, EndpointDefinition>>;
  const endpoints = controllerRoutes.endpoints as Record<string, EndpointDefinition>;
  return endpoints[endpoint as string].method;
};

export const getRankingServiceEndpointPath = <
  Controller extends RankingServiceControllerKey,
  Endpoint extends RankingServiceEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const base = getRankingServiceControllerBasePath(controller);
  const segment = getRankingServiceEndpointSegment(controller, endpoint);
  return buildEndpointPath(base, segment);
};

export const rankingServiceBackgroundTriggers = defineBackgroundTriggers({} as const);
