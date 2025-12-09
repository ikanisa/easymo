import { buildEndpointPath, defineHttpControllers, } from "./utils";
const sipWebhookRoutes = defineHttpControllers({
    voice: {
        basePath: "voice",
        endpoints: {
            incoming: { method: "POST", segment: "incoming" },
            status: { method: "POST", segment: "status" },
        },
    },
    dial: {
        basePath: "dial",
        endpoints: {
            outbound: { method: "POST", segment: "outbound" },
        },
    },
});
export const sipWebhookRouteDefinitions = sipWebhookRoutes;
export const getSipWebhookControllerBasePath = (controller) => sipWebhookRouteDefinitions[controller].basePath;
export const getSipWebhookEndpointSegment = (controller, endpoint) => {
    const controllerRoutes = sipWebhookRouteDefinitions[controller];
    const endpoints = controllerRoutes.endpoints;
    return endpoints[endpoint].segment;
};
export const getSipWebhookEndpointMethod = (controller, endpoint) => {
    const controllerRoutes = sipWebhookRouteDefinitions[controller];
    const endpoints = controllerRoutes.endpoints;
    return endpoints[endpoint].method;
};
export const getSipWebhookEndpointPath = (controller, endpoint) => {
    const base = getSipWebhookControllerBasePath(controller);
    const segment = getSipWebhookEndpointSegment(controller, endpoint);
    return buildEndpointPath(base, segment);
};
