declare const vendorServiceRouteDefinitions: Readonly<{
    readonly vendors: {
        readonly basePath: "vendors";
        readonly description: "Vendor marketplace CRUD endpoints";
        readonly endpoints: {
            readonly create: {
                readonly method: "POST";
                readonly segment: "";
                readonly notes: "Feature flag marketplace.vendor";
            };
            readonly list: {
                readonly method: "GET";
                readonly segment: "";
                readonly notes: "Feature flag marketplace.vendor";
            };
            readonly entitlements: {
                readonly method: "GET";
                readonly segment: ":id/entitlements";
                readonly notes: "Feature flag marketplace.vendor";
            };
            readonly createQuote: {
                readonly method: "POST";
                readonly segment: ":id/quotes";
                readonly notes: "Feature flag marketplace.vendor";
            };
        };
    };
    readonly marketplace: {
        readonly basePath: "marketplace";
        readonly endpoints: {
            readonly getSettings: {
                readonly method: "GET";
                readonly segment: "settings";
            };
            readonly updateSettings: {
                readonly method: "POST";
                readonly segment: "settings";
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
export type VendorServiceRoutes = typeof vendorServiceRouteDefinitions;
export type VendorServiceControllerKey = keyof VendorServiceRoutes;
export type VendorServiceEndpointKey<Controller extends VendorServiceControllerKey> = keyof VendorServiceRoutes[Controller]["endpoints"];
export declare const vendorServiceRoutes: Readonly<{
    readonly vendors: {
        readonly basePath: "vendors";
        readonly description: "Vendor marketplace CRUD endpoints";
        readonly endpoints: {
            readonly create: {
                readonly method: "POST";
                readonly segment: "";
                readonly notes: "Feature flag marketplace.vendor";
            };
            readonly list: {
                readonly method: "GET";
                readonly segment: "";
                readonly notes: "Feature flag marketplace.vendor";
            };
            readonly entitlements: {
                readonly method: "GET";
                readonly segment: ":id/entitlements";
                readonly notes: "Feature flag marketplace.vendor";
            };
            readonly createQuote: {
                readonly method: "POST";
                readonly segment: ":id/quotes";
                readonly notes: "Feature flag marketplace.vendor";
            };
        };
    };
    readonly marketplace: {
        readonly basePath: "marketplace";
        readonly endpoints: {
            readonly getSettings: {
                readonly method: "GET";
                readonly segment: "settings";
            };
            readonly updateSettings: {
                readonly method: "POST";
                readonly segment: "settings";
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
export declare const getVendorServiceControllerBasePath: <Controller extends VendorServiceControllerKey>(controller: Controller) => "health" | "vendors" | "marketplace";
export declare const getVendorServiceEndpointSegment: <Controller extends VendorServiceControllerKey, Endpoint extends VendorServiceEndpointKey<Controller>>(controller: Controller, endpoint: Endpoint) => string;
export declare const getVendorServiceEndpointMethod: <Controller extends VendorServiceControllerKey, Endpoint extends VendorServiceEndpointKey<Controller>>(controller: Controller, endpoint: Endpoint) => import("./utils").HttpMethod;
export declare const getVendorServiceEndpointPath: <Controller extends VendorServiceControllerKey, Endpoint extends VendorServiceEndpointKey<Controller>>(controller: Controller, endpoint: Endpoint) => string;
export {};
//# sourceMappingURL=vendor-service.d.ts.map