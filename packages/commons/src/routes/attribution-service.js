import { buildEndpointPath, defineHttpControllers, } from "./utils";
const attributionServiceRouteDefinitions = defineHttpControllers({
    attribution: {
        basePath: "attribution",
        description: "Attribution workflows secured by service-to-service auth",
        endpoints: {
            evaluate: {
                method: "POST",
                segment: "evaluate",
                notes: "Requires service scope attribution:write",
            },
            evidence: {
                method: "POST",
                segment: "evidence",
                notes: "Requires service scope attribution:write",
            },
            disputes: {
                method: "POST",
                segment: "disputes",
                notes: "Requires service scope attribution:write",
            },
        },
    },
    health: {
        basePath: "health",
        endpoints: {
            status: { method: "GET", segment: "" },
        },
    },
});
export const attributionServiceRoutes = attributionServiceRouteDefinitions;
export const getAttributionServiceControllerBasePath = (controller) => attributionServiceRoutes[controller].basePath;
export const getAttributionServiceEndpointSegment = (controller, endpoint) => {
    const controllerRoutes = attributionServiceRoutes[controller];
    const endpoints = controllerRoutes.endpoints;
    return endpoints[endpoint].segment;
};
export const getAttributionServiceEndpointMethod = (controller, endpoint) => {
    const controllerRoutes = attributionServiceRoutes[controller];
    const endpoints = controllerRoutes.endpoints;
    return endpoints[endpoint].method;
};
export const getAttributionServiceEndpointPath = (controller, endpoint) => {
    const base = getAttributionServiceControllerBasePath(controller);
    const segment = getAttributionServiceEndpointSegment(controller, endpoint);
    return buildEndpointPath(base, segment);
};
