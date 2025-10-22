import {
  buildEndpointPath,
  defineHttpControllers,
  type ControllerDefinition,
  type EndpointDefinition,
} from "./http-utils.js";

const walletServiceRouteDefinitions = defineHttpControllers({
  wallet: {
    basePath: "wallet" as const,
    description: "Wallet transfers and provisioning",
    endpoints: {
      transfer: {
        method: "POST" as const,
        segment: "transfer" as const,
        notes: "Feature flag wallet.service",
      },
      getAccount: { method: "GET" as const, segment: "accounts/:id" as const, notes: "Feature flag wallet.service" },
      platformProvision: { method: "POST" as const, segment: "platform/provision" as const },
      subscribe: { method: "POST" as const, segment: "subscribe" as const, notes: "Feature flag wallet.service" },
    },
  },
  fx: {
    basePath: "fx" as const,
    endpoints: {
      convert: { method: "GET" as const, segment: "convert" as const },
    },
  },
  health: {
    basePath: "health" as const,
    endpoints: {
      status: { method: "GET" as const, segment: "" as const },
    },
  },
} as const satisfies Record<string, ControllerDefinition<Record<string, EndpointDefinition>>>);

export type WalletServiceRoutes = typeof walletServiceRouteDefinitions;
export type WalletServiceControllerKey = keyof WalletServiceRoutes;
export type WalletServiceEndpointKey<Controller extends WalletServiceControllerKey> =
  keyof WalletServiceRoutes[Controller]["endpoints"];

export const walletServiceRoutes = walletServiceRouteDefinitions;

export const getWalletServiceControllerBasePath = <Controller extends WalletServiceControllerKey>(controller: Controller) =>
  walletServiceRoutes[controller].basePath;

export const getWalletServiceEndpointSegment = <
  Controller extends WalletServiceControllerKey,
  Endpoint extends WalletServiceEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const controllerRoutes = walletServiceRoutes[controller] as WalletServiceRoutes[Controller];
  const endpoints = controllerRoutes.endpoints as Record<WalletServiceEndpointKey<Controller>, EndpointDefinition>;
  return endpoints[endpoint].segment;
};

export const getWalletServiceEndpointMethod = <
  Controller extends WalletServiceControllerKey,
  Endpoint extends WalletServiceEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const controllerRoutes = walletServiceRoutes[controller] as WalletServiceRoutes[Controller];
  const endpoints = controllerRoutes.endpoints as Record<WalletServiceEndpointKey<Controller>, EndpointDefinition>;
  return endpoints[endpoint].method;
};

export const getWalletServiceEndpointPath = <
  Controller extends WalletServiceControllerKey,
  Endpoint extends WalletServiceEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const base = getWalletServiceControllerBasePath(controller);
  const segment = getWalletServiceEndpointSegment(controller, endpoint);
  return buildEndpointPath(base, segment);
};
