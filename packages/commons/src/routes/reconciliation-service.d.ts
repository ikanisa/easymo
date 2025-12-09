declare const reconciliationServiceRouteDefinitions: Readonly<{
    readonly reconciliation: {
        readonly basePath: "reconciliation";
        readonly description: "Financial reconciliation workflows";
        readonly endpoints: {
            readonly mobileMoney: {
                readonly method: "POST";
                readonly segment: "mobile-money";
                readonly notes: "Accepts multipart/form-data or application/json payloads";
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
export type ReconciliationServiceRoutes = typeof reconciliationServiceRouteDefinitions;
export type ReconciliationServiceControllerKey = keyof ReconciliationServiceRoutes;
export type ReconciliationServiceEndpointKey<Controller extends ReconciliationServiceControllerKey> = keyof ReconciliationServiceRoutes[Controller]["endpoints"];
export declare const reconciliationServiceRoutes: Readonly<{
    readonly reconciliation: {
        readonly basePath: "reconciliation";
        readonly description: "Financial reconciliation workflows";
        readonly endpoints: {
            readonly mobileMoney: {
                readonly method: "POST";
                readonly segment: "mobile-money";
                readonly notes: "Accepts multipart/form-data or application/json payloads";
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
export declare const getReconciliationServiceControllerBasePath: <Controller extends ReconciliationServiceControllerKey>(controller: Controller) => "reconciliation" | "health";
export declare const getReconciliationServiceEndpointSegment: <Controller extends ReconciliationServiceControllerKey, Endpoint extends ReconciliationServiceEndpointKey<Controller>>(controller: Controller, endpoint: Endpoint) => string;
export declare const getReconciliationServiceEndpointMethod: <Controller extends ReconciliationServiceControllerKey, Endpoint extends ReconciliationServiceEndpointKey<Controller>>(controller: Controller, endpoint: Endpoint) => import("./utils").HttpMethod;
export declare const getReconciliationServiceEndpointPath: <Controller extends ReconciliationServiceControllerKey, Endpoint extends ReconciliationServiceEndpointKey<Controller>>(controller: Controller, endpoint: Endpoint) => string;
export {};
//# sourceMappingURL=reconciliation-service.d.ts.map