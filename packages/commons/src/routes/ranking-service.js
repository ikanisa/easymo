import { buildEndpointPath, defineHttpControllers, } from "./utils";
const rankingServiceRouteDefinitions = defineHttpControllers({
    ranking: {
        basePath: "ranking",
        endpoints: {
            vendors: { method: "GET", segment: "vendors", notes: "Feature flag marketplace.ranking" },
        },
    },
    health: {
        basePath: "health",
        endpoints: {
            status: { method: "GET", segment: "" },
        },
    },
});
export const rankingServiceRoutes = rankingServiceRouteDefinitions;
export const getRankingServiceControllerBasePath = (controller) => rankingServiceRoutes[controller].basePath;
export const getRankingServiceEndpointSegment = (controller, endpoint) => {
    const controllerRoutes = rankingServiceRoutes[controller];
    const endpoints = controllerRoutes.endpoints;
    return endpoints[endpoint].segment;
};
export const getRankingServiceEndpointMethod = (controller, endpoint) => {
    const controllerRoutes = rankingServiceRoutes[controller];
    const endpoints = controllerRoutes.endpoints;
    return endpoints[endpoint].method;
};
export const getRankingServiceEndpointPath = (controller, endpoint) => {
    const base = getRankingServiceControllerBasePath(controller);
    const segment = getRankingServiceEndpointSegment(controller, endpoint);
    return buildEndpointPath(base, segment);
};
