declare const attributionServiceRouteDefinitions: Readonly<{
    readonly attribution: {
        readonly basePath: "attribution";
        readonly description: "Attribution workflows secured by service-to-service auth";
        readonly endpoints: {
            readonly evaluate: {
                readonly method: "POST";
                readonly segment: "evaluate";
                readonly notes: "Requires service scope attribution:write";
            };
            readonly evidence: {
                readonly method: "POST";
                readonly segment: "evidence";
                readonly notes: "Requires service scope attribution:write";
            };
            readonly disputes: {
                readonly method: "POST";
                readonly segment: "disputes";
                readonly notes: "Requires service scope attribution:write";
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
export type AttributionServiceRoutes = typeof attributionServiceRouteDefinitions;
export type AttributionServiceControllerKey = keyof AttributionServiceRoutes;
export type AttributionServiceEndpointKey<Controller extends AttributionServiceControllerKey> = keyof AttributionServiceRoutes[Controller]["endpoints"];
export declare const attributionServiceRoutes: Readonly<{
    readonly attribution: {
        readonly basePath: "attribution";
        readonly description: "Attribution workflows secured by service-to-service auth";
        readonly endpoints: {
            readonly evaluate: {
                readonly method: "POST";
                readonly segment: "evaluate";
                readonly notes: "Requires service scope attribution:write";
            };
            readonly evidence: {
                readonly method: "POST";
                readonly segment: "evidence";
                readonly notes: "Requires service scope attribution:write";
            };
            readonly disputes: {
                readonly method: "POST";
                readonly segment: "disputes";
                readonly notes: "Requires service scope attribution:write";
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
export declare const getAttributionServiceControllerBasePath: <Controller extends AttributionServiceControllerKey>(controller: Controller) => "attribution" | "health";
export declare const getAttributionServiceEndpointSegment: <Controller extends AttributionServiceControllerKey, Endpoint extends AttributionServiceEndpointKey<Controller>>(controller: Controller, endpoint: Endpoint) => string;
export declare const getAttributionServiceEndpointMethod: <Controller extends AttributionServiceControllerKey, Endpoint extends AttributionServiceEndpointKey<Controller>>(controller: Controller, endpoint: Endpoint) => import("./utils").HttpMethod;
export declare const getAttributionServiceEndpointPath: <Controller extends AttributionServiceControllerKey, Endpoint extends AttributionServiceEndpointKey<Controller>>(controller: Controller, endpoint: Endpoint) => string;
export {};
//# sourceMappingURL=attribution-service.d.ts.map