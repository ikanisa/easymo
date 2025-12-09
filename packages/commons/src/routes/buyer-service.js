import { buildEndpointPath, defineHttpControllers, } from "./utils";
const buyerServiceRouteDefinitions = defineHttpControllers({
    buyers: {
        basePath: "buyers",
        description: "Buyer profile management",
        endpoints: {
            create: { method: "POST", segment: "", notes: "Feature flag marketplace.buyer" },
            createIntent: {
                method: "POST",
                segment: ":id/intents",
                notes: "Feature flag marketplace.buyer",
            },
            context: { method: "GET", segment: ":id/context", notes: "Feature flag marketplace.buyer" },
        },
    },
    intents: {
        basePath: "intents",
        endpoints: {
            list: { method: "GET", segment: "", notes: "Feature flag marketplace.buyer" },
        },
    },
    purchases: {
        basePath: "purchases",
        endpoints: {
            create: { method: "POST", segment: "", notes: "Feature flag marketplace.buyer" },
            list: { method: "GET", segment: "", notes: "Feature flag marketplace.buyer" },
        },
    },
    health: {
        basePath: "health",
        endpoints: {
            status: { method: "GET", segment: "" },
        },
    },
});
export const buyerServiceRoutes = buyerServiceRouteDefinitions;
export const getBuyerServiceControllerBasePath = (controller) => buyerServiceRoutes[controller].basePath;
export const getBuyerServiceEndpointSegment = (controller, endpoint) => {
    const controllerRoutes = buyerServiceRoutes[controller];
    const endpoints = controllerRoutes.endpoints;
    return endpoints[endpoint].segment;
};
export const getBuyerServiceEndpointMethod = (controller, endpoint) => {
    const controllerRoutes = buyerServiceRoutes[controller];
    const endpoints = controllerRoutes.endpoints;
    return endpoints[endpoint].method;
};
export const getBuyerServiceEndpointPath = (controller, endpoint) => {
    const base = getBuyerServiceControllerBasePath(controller);
    const segment = getBuyerServiceEndpointSegment(controller, endpoint);
    return buildEndpointPath(base, segment);
};
