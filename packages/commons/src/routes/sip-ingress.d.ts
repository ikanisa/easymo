declare const sipIngressRouteDefinitions: Readonly<{
    readonly sip: {
        readonly basePath: "sip";
        readonly description: "Ingress for SIP provider webhooks";
        readonly endpoints: {
            readonly events: {
                readonly method: "POST";
                readonly segment: "events";
                readonly notes: "Publishes events to Kafka after idempotency checks";
            };
        };
    };
    readonly health: {
        readonly basePath: "health";
        readonly endpoints: {
            readonly status: {
                readonly method: "GET";
                readonly segment: "";
            };
        };
    };
}>;
export type SipIngressRoutes = typeof sipIngressRouteDefinitions;
export type SipIngressControllerKey = keyof SipIngressRoutes;
export type SipIngressEndpointKey<Controller extends SipIngressControllerKey> = keyof SipIngressRoutes[Controller]["endpoints"];
export declare const sipIngressRoutes: Readonly<{
    readonly sip: {
        readonly basePath: "sip";
        readonly description: "Ingress for SIP provider webhooks";
        readonly endpoints: {
            readonly events: {
                readonly method: "POST";
                readonly segment: "events";
                readonly notes: "Publishes events to Kafka after idempotency checks";
            };
        };
    };
    readonly health: {
        readonly basePath: "health";
        readonly endpoints: {
            readonly status: {
                readonly method: "GET";
                readonly segment: "";
            };
        };
    };
}>;
export declare const getSipIngressControllerBasePath: <Controller extends SipIngressControllerKey>(controller: Controller) => "health" | "sip";
export declare const getSipIngressEndpointSegment: <Controller extends SipIngressControllerKey, Endpoint extends SipIngressEndpointKey<Controller>>(controller: Controller, endpoint: Endpoint) => string;
export declare const getSipIngressEndpointMethod: <Controller extends SipIngressControllerKey, Endpoint extends SipIngressEndpointKey<Controller>>(controller: Controller, endpoint: Endpoint) => import("./utils").HttpMethod;
export declare const getSipIngressEndpointPath: <Controller extends SipIngressControllerKey, Endpoint extends SipIngressEndpointKey<Controller>>(controller: Controller, endpoint: Endpoint) => string;
export {};
//# sourceMappingURL=sip-ingress.d.ts.map