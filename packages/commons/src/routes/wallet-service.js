import { buildEndpointPath, defineHttpControllers, } from "./utils";
const walletServiceRouteDefinitions = defineHttpControllers({
    wallet: {
        basePath: "wallet",
        description: "Wallet transfers and provisioning",
        endpoints: {
            transfer: {
                method: "POST",
                segment: "transfer",
                notes: "Feature flag wallet.service",
            },
            getAccount: { method: "GET", segment: "accounts/:id", notes: "Feature flag wallet.service" },
            platformProvision: { method: "POST", segment: "platform/provision" },
            subscribe: { method: "POST", segment: "subscribe", notes: "Feature flag wallet.service" },
        },
    },
    fx: {
        basePath: "fx",
        endpoints: {
            convert: { method: "GET", segment: "convert" },
        },
    },
    health: {
        basePath: "health",
        endpoints: {
            status: { method: "GET", segment: "" },
        },
    },
});
export const walletServiceRoutes = walletServiceRouteDefinitions;
export const getWalletServiceControllerBasePath = (controller) => walletServiceRoutes[controller].basePath;
export const getWalletServiceEndpointSegment = (controller, endpoint) => {
    const controllerRoutes = walletServiceRoutes[controller];
    const endpoints = controllerRoutes.endpoints;
    return endpoints[endpoint].segment;
};
export const getWalletServiceEndpointMethod = (controller, endpoint) => {
    const controllerRoutes = walletServiceRoutes[controller];
    const endpoints = controllerRoutes.endpoints;
    return endpoints[endpoint].method;
};
export const getWalletServiceEndpointPath = (controller, endpoint) => {
    const base = getWalletServiceControllerBasePath(controller);
    const segment = getWalletServiceEndpointSegment(controller, endpoint);
    return buildEndpointPath(base, segment);
};
