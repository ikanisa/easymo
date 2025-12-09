import { buildEndpointPath, defineHttpControllers, defineWebSocketRoutes, } from "./utils";
const voiceBridgeHttpRouteDefinitions = defineHttpControllers({
    health: {
        basePath: "health",
        endpoints: {
            status: { method: "GET", segment: "" },
        },
    },
    analytics: {
        basePath: "analytics",
        endpoints: {
            liveCalls: {
                method: "GET",
                segment: "live-calls",
                notes: "Requires service auth scope voice:read",
            },
        },
    },
    calls: {
        basePath: "calls",
        endpoints: {
            outbound: {
                method: "POST",
                segment: "outbound",
                notes: "Requires service auth scope voice:outbound.write",
            },
        },
    },
});
const voiceBridgeWebSocketRouteDefinitions = defineWebSocketRoutes({
    mediaStream: { path: "/twilio-media", description: "Twilio Media Stream ingress" },
    twilioMediaStream: { path: "/twilio-media", description: "Twilio Media Stream ingress" },
});
export const voiceBridgeHttpRoutes = voiceBridgeHttpRouteDefinitions;
export const voiceBridgeWebsocketRoutes = voiceBridgeWebSocketRouteDefinitions;
export const voiceBridgeRoutes = Object.freeze({
    health: {
        kind: "http",
        method: voiceBridgeHttpRoutes.health.endpoints.status.method,
        path: buildEndpointPath(voiceBridgeHttpRoutes.health.basePath, voiceBridgeHttpRoutes.health.endpoints.status.segment),
    },
    analyticsLiveCalls: {
        kind: "http",
        method: voiceBridgeHttpRoutes.analytics.endpoints.liveCalls.method,
        path: buildEndpointPath(voiceBridgeHttpRoutes.analytics.basePath, voiceBridgeHttpRoutes.analytics.endpoints.liveCalls.segment),
    },
    outboundCalls: {
        kind: "http",
        method: voiceBridgeHttpRoutes.calls.endpoints.outbound.method,
        path: buildEndpointPath(voiceBridgeHttpRoutes.calls.basePath, voiceBridgeHttpRoutes.calls.endpoints.outbound.segment),
    },
    mediaStream: {
        kind: "websocket",
        path: voiceBridgeWebsocketRoutes.mediaStream.path,
    },
    twilioMediaStream: {
        kind: "websocket",
        path: voiceBridgeWebsocketRoutes.twilioMediaStream.path,
    },
});
export const getVoiceBridgeControllerBasePath = (controller) => voiceBridgeHttpRoutes[controller].basePath;
export const getVoiceBridgeEndpointSegment = (controller, endpoint) => {
    const controllerRoutes = voiceBridgeHttpRoutes[controller];
    const endpoints = controllerRoutes.endpoints;
    return endpoints[endpoint].segment;
};
export const getVoiceBridgeEndpointMethod = (controller, endpoint) => {
    const controllerRoutes = voiceBridgeHttpRoutes[controller];
    const endpoints = controllerRoutes.endpoints;
    return endpoints[endpoint].method;
};
export const getVoiceBridgeEndpointPath = (controller, endpoint) => {
    const base = getVoiceBridgeControllerBasePath(controller);
    const segment = getVoiceBridgeEndpointSegment(controller, endpoint);
    return buildEndpointPath(base, segment);
};
/**
 * @deprecated Prefer {@link getVoiceBridgeWebsocketRoutePath}.
 */
export const getVoiceBridgeRoutePath = (key) => voiceBridgeRoutes[key].path;
/**
 * @deprecated Legacy helper retained for backwards compatibility with {@link voiceBridgeRoutes}.
 */
export const getVoiceBridgeRouteKind = (key) => voiceBridgeRoutes[key].kind;
/**
 * @deprecated Prefer {@link getVoiceBridgeHttpEndpointMethod}.
 */
export const getVoiceBridgeHttpRouteMethod = (key) => {
    const route = voiceBridgeRoutes[key];
    if (route.kind !== "http") {
        throw new Error(`Route ${String(key)} is not an HTTP route`);
    }
    return route.method;
};
