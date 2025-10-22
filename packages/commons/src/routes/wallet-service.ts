import {
  buildEndpointPath,
  defineBackgroundTriggers,
  defineHttpControllers,
  type ControllerDefinition,
  type EndpointDefinition,
} from "./utils";

const controllerDefinitions = defineHttpControllers({
  wallet: {
    basePath: "wallet" as const,
    endpoints: {
      transfer: { method: "POST" as const, segment: "transfer" as const },
      accountSummary: { method: "GET" as const, segment: "accounts/:id" as const },
      platformProvision: { method: "POST" as const, segment: "platform/provision" as const },
      subscribe: { method: "POST" as const, segment: "subscribe" as const },
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

export type WalletServiceRoutes = typeof controllerDefinitions;
export type WalletServiceControllerKey = keyof WalletServiceRoutes;
export type WalletServiceEndpointKey<Controller extends WalletServiceControllerKey> = keyof WalletServiceRoutes[Controller]["endpoints"];

export const walletServiceRoutes = controllerDefinitions;

export const getWalletServiceControllerBasePath = <Controller extends WalletServiceControllerKey>(controller: Controller) =>
  walletServiceRoutes[controller].basePath;

export const getWalletServiceEndpointSegment = <
  Controller extends WalletServiceControllerKey,
  Endpoint extends WalletServiceEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const controllerRoutes = walletServiceRoutes[controller] as ControllerDefinition<Record<string, EndpointDefinition>>;
  const endpoints = controllerRoutes.endpoints as Record<string, EndpointDefinition>;
  return endpoints[endpoint as string].segment;
};

export const getWalletServiceEndpointMethod = <
  Controller extends WalletServiceControllerKey,
  Endpoint extends WalletServiceEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const controllerRoutes = walletServiceRoutes[controller] as ControllerDefinition<Record<string, EndpointDefinition>>;
  const endpoints = controllerRoutes.endpoints as Record<string, EndpointDefinition>;
  return endpoints[endpoint as string].method;
};

export const getWalletServiceEndpointPath = <
  Controller extends WalletServiceControllerKey,
  Endpoint extends WalletServiceEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const base = getWalletServiceControllerBasePath(controller);
  const segment = getWalletServiceEndpointSegment(controller, endpoint);
  return buildEndpointPath(base, segment);
};

export const walletServiceBackgroundTriggers = defineBackgroundTriggers({
  /**
   * Wallet provisioning helpers currently expose only HTTP interfaces. Historical OpenAPI
   * entries such as `/wallet/accounts/lookup` are not implemented and therefore omitted.
   */
} as const);
