import { buildEndpointPath, defineHttpControllers, } from "./utils";
const reconciliationServiceRouteDefinitions = defineHttpControllers({
    reconciliation: {
        basePath: "reconciliation",
        description: "Financial reconciliation workflows",
        endpoints: {
            mobileMoney: {
                method: "POST",
                segment: "mobile-money",
                notes: "Accepts multipart/form-data or application/json payloads",
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
export const reconciliationServiceRoutes = reconciliationServiceRouteDefinitions;
export const getReconciliationServiceControllerBasePath = (controller) => reconciliationServiceRoutes[controller].basePath;
export const getReconciliationServiceEndpointSegment = (controller, endpoint) => {
    const controllerRoutes = reconciliationServiceRoutes[controller];
    const endpoints = controllerRoutes.endpoints;
    return endpoints[endpoint].segment;
};
export const getReconciliationServiceEndpointMethod = (controller, endpoint) => {
    const controllerRoutes = reconciliationServiceRoutes[controller];
    const endpoints = controllerRoutes.endpoints;
    return endpoints[endpoint].method;
};
export const getReconciliationServiceEndpointPath = (controller, endpoint) => {
    const base = getReconciliationServiceControllerBasePath(controller);
    const segment = getReconciliationServiceEndpointSegment(controller, endpoint);
    return buildEndpointPath(base, segment);
};
