import { buildEndpointPath, defineHttpControllers, } from "./utils";
const whatsappBotRouteDefinitions = defineHttpControllers({
    webhook: {
        basePath: "webhook",
        description: "Meta WhatsApp webhook handler",
        endpoints: {
            verify: {
                method: "GET",
                segment: "",
                notes: "Expects hub.verify_token and hub.challenge query params",
            },
            ingest: { method: "POST", segment: "", notes: "Parses Meta webhook payloads" },
        },
    },
    health: {
        basePath: "health",
        endpoints: {
            status: { method: "GET", segment: "" },
        },
    },
});
export const whatsappBotRoutes = whatsappBotRouteDefinitions;
export const getWhatsappBotControllerBasePath = (controller) => whatsappBotRoutes[controller].basePath;
export const getWhatsappBotEndpointSegment = (controller, endpoint) => {
    const controllerRoutes = whatsappBotRoutes[controller];
    const endpoints = controllerRoutes.endpoints;
    return endpoints[endpoint].segment;
};
export const getWhatsappBotEndpointMethod = (controller, endpoint) => {
    const controllerRoutes = whatsappBotRoutes[controller];
    const endpoints = controllerRoutes.endpoints;
    return endpoints[endpoint].method;
};
export const getWhatsappBotEndpointPath = (controller, endpoint) => {
    const base = getWhatsappBotControllerBasePath(controller);
    const segment = getWhatsappBotEndpointSegment(controller, endpoint);
    return buildEndpointPath(base, segment);
};
