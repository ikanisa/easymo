import { buildEndpointPath, defineHttpControllers, } from "./utils";
const sipIngressRouteDefinitions = defineHttpControllers({
    sip: {
        basePath: "sip",
        description: "Ingress for SIP provider webhooks",
        endpoints: {
            events: {
                method: "POST",
                segment: "events",
                notes: "Publishes events to Kafka after idempotency checks",
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
export const sipIngressRoutes = sipIngressRouteDefinitions;
export const getSipIngressControllerBasePath = (controller) => sipIngressRoutes[controller].basePath;
export const getSipIngressEndpointSegment = (controller, endpoint) => {
    const controllerRoutes = sipIngressRoutes[controller];
    const endpoints = controllerRoutes.endpoints;
    return endpoints[endpoint].segment;
};
export const getSipIngressEndpointMethod = (controller, endpoint) => {
    const controllerRoutes = sipIngressRoutes[controller];
    const endpoints = controllerRoutes.endpoints;
    return endpoints[endpoint].method;
};
export const getSipIngressEndpointPath = (controller, endpoint) => {
    const base = getSipIngressControllerBasePath(controller);
    const segment = getSipIngressEndpointSegment(controller, endpoint);
    return buildEndpointPath(base, segment);
};
