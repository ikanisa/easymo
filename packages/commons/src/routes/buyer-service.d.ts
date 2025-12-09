declare const buyerServiceRouteDefinitions: Readonly<{
    readonly buyers: {
        readonly basePath: "buyers";
        readonly description: "Buyer profile management";
        readonly endpoints: {
            readonly create: {
                readonly method: "POST";
                readonly segment: "";
                readonly notes: "Feature flag marketplace.buyer";
            };
            readonly createIntent: {
                readonly method: "POST";
                readonly segment: ":id/intents";
                readonly notes: "Feature flag marketplace.buyer";
            };
            readonly context: {
                readonly method: "GET";
                readonly segment: ":id/context";
                readonly notes: "Feature flag marketplace.buyer";
            };
        };
    };
    readonly intents: {
        readonly basePath: "intents";
        readonly endpoints: {
            readonly list: {
                readonly method: "GET";
                readonly segment: "";
                readonly notes: "Feature flag marketplace.buyer";
            };
        };
    };
    readonly purchases: {
        readonly basePath: "purchases";
        readonly endpoints: {
            readonly create: {
                readonly method: "POST";
                readonly segment: "";
                readonly notes: "Feature flag marketplace.buyer";
            };
            readonly list: {
                readonly method: "GET";
                readonly segment: "";
                readonly notes: "Feature flag marketplace.buyer";
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
export type BuyerServiceRoutes = typeof buyerServiceRouteDefinitions;
export type BuyerServiceControllerKey = keyof BuyerServiceRoutes;
export type BuyerServiceEndpointKey<Controller extends BuyerServiceControllerKey> = keyof BuyerServiceRoutes[Controller]["endpoints"];
export declare const buyerServiceRoutes: Readonly<{
    readonly buyers: {
        readonly basePath: "buyers";
        readonly description: "Buyer profile management";
        readonly endpoints: {
            readonly create: {
                readonly method: "POST";
                readonly segment: "";
                readonly notes: "Feature flag marketplace.buyer";
            };
            readonly createIntent: {
                readonly method: "POST";
                readonly segment: ":id/intents";
                readonly notes: "Feature flag marketplace.buyer";
            };
            readonly context: {
                readonly method: "GET";
                readonly segment: ":id/context";
                readonly notes: "Feature flag marketplace.buyer";
            };
        };
    };
    readonly intents: {
        readonly basePath: "intents";
        readonly endpoints: {
            readonly list: {
                readonly method: "GET";
                readonly segment: "";
                readonly notes: "Feature flag marketplace.buyer";
            };
        };
    };
    readonly purchases: {
        readonly basePath: "purchases";
        readonly endpoints: {
            readonly create: {
                readonly method: "POST";
                readonly segment: "";
                readonly notes: "Feature flag marketplace.buyer";
            };
            readonly list: {
                readonly method: "GET";
                readonly segment: "";
                readonly notes: "Feature flag marketplace.buyer";
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
export declare const getBuyerServiceControllerBasePath: <Controller extends BuyerServiceControllerKey>(controller: Controller) => "health" | "buyers" | "intents" | "purchases";
export declare const getBuyerServiceEndpointSegment: <Controller extends BuyerServiceControllerKey, Endpoint extends BuyerServiceEndpointKey<Controller>>(controller: Controller, endpoint: Endpoint) => string;
export declare const getBuyerServiceEndpointMethod: <Controller extends BuyerServiceControllerKey, Endpoint extends BuyerServiceEndpointKey<Controller>>(controller: Controller, endpoint: Endpoint) => import("./utils").HttpMethod;
export declare const getBuyerServiceEndpointPath: <Controller extends BuyerServiceControllerKey, Endpoint extends BuyerServiceEndpointKey<Controller>>(controller: Controller, endpoint: Endpoint) => string;
export {};
//# sourceMappingURL=buyer-service.d.ts.map