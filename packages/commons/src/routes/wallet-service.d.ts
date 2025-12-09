declare const walletServiceRouteDefinitions: Readonly<{
    readonly wallet: {
        readonly basePath: "wallet";
        readonly description: "Wallet transfers and provisioning";
        readonly endpoints: {
            readonly transfer: {
                readonly method: "POST";
                readonly segment: "transfer";
                readonly notes: "Feature flag wallet.service";
            };
            readonly getAccount: {
                readonly method: "GET";
                readonly segment: "accounts/:id";
                readonly notes: "Feature flag wallet.service";
            };
            readonly platformProvision: {
                readonly method: "POST";
                readonly segment: "platform/provision";
            };
            readonly subscribe: {
                readonly method: "POST";
                readonly segment: "subscribe";
                readonly notes: "Feature flag wallet.service";
            };
        };
    };
    readonly fx: {
        readonly basePath: "fx";
        readonly endpoints: {
            readonly convert: {
                readonly method: "GET";
                readonly segment: "convert";
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
export type WalletServiceRoutes = typeof walletServiceRouteDefinitions;
export type WalletServiceControllerKey = keyof WalletServiceRoutes;
export type WalletServiceEndpointKey<Controller extends WalletServiceControllerKey> = keyof WalletServiceRoutes[Controller]["endpoints"];
export declare const walletServiceRoutes: Readonly<{
    readonly wallet: {
        readonly basePath: "wallet";
        readonly description: "Wallet transfers and provisioning";
        readonly endpoints: {
            readonly transfer: {
                readonly method: "POST";
                readonly segment: "transfer";
                readonly notes: "Feature flag wallet.service";
            };
            readonly getAccount: {
                readonly method: "GET";
                readonly segment: "accounts/:id";
                readonly notes: "Feature flag wallet.service";
            };
            readonly platformProvision: {
                readonly method: "POST";
                readonly segment: "platform/provision";
            };
            readonly subscribe: {
                readonly method: "POST";
                readonly segment: "subscribe";
                readonly notes: "Feature flag wallet.service";
            };
        };
    };
    readonly fx: {
        readonly basePath: "fx";
        readonly endpoints: {
            readonly convert: {
                readonly method: "GET";
                readonly segment: "convert";
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
export declare const getWalletServiceControllerBasePath: <Controller extends WalletServiceControllerKey>(controller: Controller) => "health" | "wallet" | "fx";
export declare const getWalletServiceEndpointSegment: <Controller extends WalletServiceControllerKey, Endpoint extends WalletServiceEndpointKey<Controller>>(controller: Controller, endpoint: Endpoint) => string;
export declare const getWalletServiceEndpointMethod: <Controller extends WalletServiceControllerKey, Endpoint extends WalletServiceEndpointKey<Controller>>(controller: Controller, endpoint: Endpoint) => import("./utils").HttpMethod;
export declare const getWalletServiceEndpointPath: <Controller extends WalletServiceControllerKey, Endpoint extends WalletServiceEndpointKey<Controller>>(controller: Controller, endpoint: Endpoint) => string;
export {};
//# sourceMappingURL=wallet-service.d.ts.map