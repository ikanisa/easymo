declare const voiceBridgeHttpRouteDefinitions: Readonly<{
    readonly health: {
        readonly basePath: "health";
        readonly endpoints: {
            readonly status: {
                readonly method: "GET";
                readonly segment: "";
            };
        };
    };
    readonly analytics: {
        readonly basePath: "analytics";
        readonly endpoints: {
            readonly liveCalls: {
                readonly method: "GET";
                readonly segment: "live-calls";
                readonly notes: "Requires service auth scope voice:read";
            };
        };
    };
    readonly calls: {
        readonly basePath: "calls";
        readonly endpoints: {
            readonly outbound: {
                readonly method: "POST";
                readonly segment: "outbound";
                readonly notes: "Requires service auth scope voice:outbound.write";
            };
        };
    };
}>;
export type VoiceBridgeHttpRoutes = typeof voiceBridgeHttpRouteDefinitions;
export type VoiceBridgeHttpControllerKey = keyof VoiceBridgeHttpRoutes;
export type VoiceBridgeHttpEndpointKey<Controller extends VoiceBridgeHttpControllerKey> = keyof VoiceBridgeHttpRoutes[Controller]["endpoints"];
export declare const voiceBridgeHttpRoutes: Readonly<{
    readonly health: {
        readonly basePath: "health";
        readonly endpoints: {
            readonly status: {
                readonly method: "GET";
                readonly segment: "";
            };
        };
    };
    readonly analytics: {
        readonly basePath: "analytics";
        readonly endpoints: {
            readonly liveCalls: {
                readonly method: "GET";
                readonly segment: "live-calls";
                readonly notes: "Requires service auth scope voice:read";
            };
        };
    };
    readonly calls: {
        readonly basePath: "calls";
        readonly endpoints: {
            readonly outbound: {
                readonly method: "POST";
                readonly segment: "outbound";
                readonly notes: "Requires service auth scope voice:outbound.write";
            };
        };
    };
}>;
export declare const voiceBridgeWebsocketRoutes: Readonly<{
    readonly mediaStream: {
        readonly path: "/twilio-media";
        readonly description: "Twilio Media Stream ingress";
    };
    readonly twilioMediaStream: {
        readonly path: "/twilio-media";
        readonly description: "Twilio Media Stream ingress";
    };
}>;
export type VoiceBridgeWebsocketRoutes = typeof voiceBridgeWebsocketRoutes;
export type VoiceBridgeWebSocketRoutes = VoiceBridgeWebsocketRoutes;
export declare const voiceBridgeRoutes: Readonly<{
    readonly health: {
        readonly kind: "http";
        readonly method: "GET";
        readonly path: string;
    };
    readonly analyticsLiveCalls: {
        readonly kind: "http";
        readonly method: "GET";
        readonly path: string;
    };
    readonly outboundCalls: {
        readonly kind: "http";
        readonly method: "POST";
        readonly path: string;
    };
    readonly mediaStream: {
        readonly kind: "websocket";
        readonly path: "/twilio-media";
    };
    readonly twilioMediaStream: {
        readonly kind: "websocket";
        readonly path: "/twilio-media";
    };
}>;
export type VoiceBridgeRoutes = typeof voiceBridgeRoutes;
export type VoiceBridgeRouteKey = keyof VoiceBridgeRoutes;
export type VoiceBridgeRouteRecord<Key extends VoiceBridgeRouteKey = VoiceBridgeRouteKey> = VoiceBridgeRoutes[Key];
type ExtractRouteKeys<Kind extends VoiceBridgeRouteRecord["kind"]> = {
    [Key in VoiceBridgeRouteKey]: VoiceBridgeRouteRecord<Key>["kind"] extends Kind ? Key : never;
}[VoiceBridgeRouteKey];
export type VoiceBridgeHttpRouteKey = ExtractRouteKeys<"http">;
export type VoiceBridgeWebsocketRouteKey = ExtractRouteKeys<"websocket">;
export declare const getVoiceBridgeControllerBasePath: <Controller extends VoiceBridgeHttpControllerKey>(controller: Controller) => "health" | "analytics" | "calls";
export declare const getVoiceBridgeEndpointSegment: <Controller extends VoiceBridgeHttpControllerKey, Endpoint extends VoiceBridgeHttpEndpointKey<Controller>>(controller: Controller, endpoint: Endpoint) => string;
export declare const getVoiceBridgeEndpointMethod: <Controller extends VoiceBridgeHttpControllerKey, Endpoint extends VoiceBridgeHttpEndpointKey<Controller>>(controller: Controller, endpoint: Endpoint) => import("./utils").HttpMethod;
export declare const getVoiceBridgeEndpointPath: <Controller extends VoiceBridgeHttpControllerKey, Endpoint extends VoiceBridgeHttpEndpointKey<Controller>>(controller: Controller, endpoint: Endpoint) => string;
export type VoiceBridgeWebSocketRouteKey = keyof VoiceBridgeWebsocketRoutes;
/**
 * @deprecated Prefer {@link getVoiceBridgeWebsocketRoutePath}.
 */
export declare const getVoiceBridgeRoutePath: <Key extends VoiceBridgeRouteKey>(key: Key) => string;
/**
 * @deprecated Legacy helper retained for backwards compatibility with {@link voiceBridgeRoutes}.
 */
export declare const getVoiceBridgeRouteKind: <Key extends VoiceBridgeRouteKey>(key: Key) => "http" | "websocket";
/**
 * @deprecated Prefer {@link getVoiceBridgeHttpEndpointMethod}.
 */
export declare const getVoiceBridgeHttpRouteMethod: <Key extends VoiceBridgeHttpRouteKey>(key: Key) => "POST" | "GET";
export {};
//# sourceMappingURL=voice-bridge.d.ts.map