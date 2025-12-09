declare const sipWebhookRoutes: Readonly<{
    readonly voice: {
        readonly basePath: "voice";
        readonly endpoints: {
            readonly incoming: {
                readonly method: "POST";
                readonly segment: "incoming";
            };
            readonly status: {
                readonly method: "POST";
                readonly segment: "status";
            };
        };
    };
    readonly dial: {
        readonly basePath: "dial";
        readonly endpoints: {
            readonly outbound: {
                readonly method: "POST";
                readonly segment: "outbound";
            };
        };
    };
}>;
export type SipWebhookRoutes = typeof sipWebhookRoutes;
export type SipWebhookControllerKey = keyof SipWebhookRoutes;
export type SipWebhookEndpointKey<Controller extends SipWebhookControllerKey> = keyof SipWebhookRoutes[Controller]["endpoints"];
export declare const sipWebhookRouteDefinitions: Readonly<{
    readonly voice: {
        readonly basePath: "voice";
        readonly endpoints: {
            readonly incoming: {
                readonly method: "POST";
                readonly segment: "incoming";
            };
            readonly status: {
                readonly method: "POST";
                readonly segment: "status";
            };
        };
    };
    readonly dial: {
        readonly basePath: "dial";
        readonly endpoints: {
            readonly outbound: {
                readonly method: "POST";
                readonly segment: "outbound";
            };
        };
    };
}>;
export declare const getSipWebhookControllerBasePath: <Controller extends SipWebhookControllerKey>(controller: Controller) => "voice" | "dial";
export declare const getSipWebhookEndpointSegment: <Controller extends SipWebhookControllerKey, Endpoint extends SipWebhookEndpointKey<Controller>>(controller: Controller, endpoint: Endpoint) => string;
export declare const getSipWebhookEndpointMethod: <Controller extends SipWebhookControllerKey, Endpoint extends SipWebhookEndpointKey<Controller>>(controller: Controller, endpoint: Endpoint) => import("./utils").HttpMethod;
export declare const getSipWebhookEndpointPath: <Controller extends SipWebhookControllerKey, Endpoint extends SipWebhookEndpointKey<Controller>>(controller: Controller, endpoint: Endpoint) => string;
export {};
//# sourceMappingURL=sip-webhook.d.ts.map