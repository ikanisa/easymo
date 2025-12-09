import { buildEndpointPath, defineHttpControllers, } from "./utils";
const apiRouteDefinitions = defineHttpControllers({
    realtime: {
        basePath: "realtime",
        endpoints: {
            webhook: { method: "POST", segment: "webhook" },
            events: { method: "POST", segment: "events" },
            session: { method: "POST", segment: "session" },
        },
    },
    waCalls: {
        basePath: "wa",
        endpoints: {
            webhook: { method: "GET", segment: "webhook" },
            events: { method: "POST", segment: "events" },
        },
    },
    whatsappAgents: {
        basePath: "wa/agents",
        endpoints: {
            start: { method: "POST", segment: "start" },
            sendMessage: { method: "POST", segment: ":threadId/message" },
            customerMessage: { method: "POST", segment: ":threadId/customer" },
        },
    },
    whatsappFlow: {
        basePath: "wa/flow",
        endpoints: {
            bootstrap: { method: "POST", segment: "bootstrap" },
        },
    },
    whatsappCalls: {
        basePath: "wa",
        endpoints: {
            webhook: { method: "GET", segment: "webhook" },
            events: { method: "POST", segment: "events" },
        },
    },
    twilio: {
        basePath: "twilio",
        endpoints: {
            status: { method: "POST", segment: "status" },
        },
    },
    twiml: {
        basePath: "twiml",
        endpoints: {
            warmTransfer: { method: "GET", segment: "warm-transfer" },
        },
    },
    payment: {
        basePath: "payment",
        endpoints: {
            confirm: { method: "POST", segment: "confirm" },
        },
    },
    driverParking: {
        basePath: "driver/parking",
        endpoints: {
            list: { method: "GET", segment: "" },
            create: { method: "POST", segment: "" },
            update: { method: "PUT", segment: ":id" },
            delete: { method: "DELETE", segment: ":id" },
        },
    },
    driverAvailability: {
        basePath: "driver/availability",
        endpoints: {
            list: { method: "GET", segment: "" },
            create: { method: "POST", segment: "" },
            update: { method: "PUT", segment: ":id" },
            delete: { method: "DELETE", segment: ":id" },
        },
    },
    broker: {
        basePath: "broker",
        endpoints: {
            candidates: { method: "POST", segment: "candidates" },
        },
    },
});
export const apiRoutes = apiRouteDefinitions;
export const getApiControllerBasePath = (controller) => apiRoutes[controller].basePath;
export const getApiEndpointSegment = (controller, endpoint) => {
    const controllerRoutes = apiRoutes[controller];
    const endpoints = controllerRoutes.endpoints;
    return endpoints[endpoint].segment;
};
export const getApiEndpointMethod = (controller, endpoint) => {
    const controllerRoutes = apiRoutes[controller];
    const endpoints = controllerRoutes.endpoints;
    return endpoints[endpoint].method;
};
export const getApiEndpointPath = (controller, endpoint) => {
    const base = getApiControllerBasePath(controller);
    const segment = getApiEndpointSegment(controller, endpoint);
    return buildEndpointPath(base, segment);
};
