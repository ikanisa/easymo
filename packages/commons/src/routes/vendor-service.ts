import {
  buildEndpointPath,
  defineBackgroundTriggers,
  defineHttpControllers,
  type ControllerDefinition,
  type EndpointDefinition,
} from "./utils";

const controllerDefinitions = defineHttpControllers({
  vendors: {
    basePath: "vendors" as const,
    endpoints: {
      create: { method: "POST" as const, segment: "" as const },
      list: { method: "GET" as const, segment: "" as const },
      entitlements: { method: "GET" as const, segment: ":id/entitlements" as const },
      createQuote: { method: "POST" as const, segment: ":id/quotes" as const },
    },
  },
  marketplaceSettings: {
    basePath: "marketplace" as const,
    endpoints: {
      getSettings: { method: "GET" as const, segment: "settings" as const },
      updateSettings: { method: "POST" as const, segment: "settings" as const },
    },
  },
  health: {
    basePath: "health" as const,
    endpoints: {
      status: { method: "GET" as const, segment: "" as const },
    },
  },
} as const satisfies Record<string, ControllerDefinition<Record<string, EndpointDefinition>>>);

export type VendorServiceRoutes = typeof controllerDefinitions;
export type VendorServiceControllerKey = keyof VendorServiceRoutes;
export type VendorServiceEndpointKey<Controller extends VendorServiceControllerKey> = keyof VendorServiceRoutes[Controller]["endpoints"];

export const vendorServiceRoutes = controllerDefinitions;

export const getVendorServiceControllerBasePath = <Controller extends VendorServiceControllerKey>(controller: Controller) =>
  vendorServiceRoutes[controller].basePath;

export const getVendorServiceEndpointSegment = <
  Controller extends VendorServiceControllerKey,
  Endpoint extends VendorServiceEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const controllerRoutes = vendorServiceRoutes[controller] as ControllerDefinition<Record<string, EndpointDefinition>>;
  const endpoints = controllerRoutes.endpoints as Record<string, EndpointDefinition>;
  return endpoints[endpoint as string].segment;
};

export const getVendorServiceEndpointMethod = <
  Controller extends VendorServiceControllerKey,
  Endpoint extends VendorServiceEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const controllerRoutes = vendorServiceRoutes[controller] as ControllerDefinition<Record<string, EndpointDefinition>>;
  const endpoints = controllerRoutes.endpoints as Record<string, EndpointDefinition>;
  return endpoints[endpoint as string].method;
};

export const getVendorServiceEndpointPath = <
  Controller extends VendorServiceControllerKey,
  Endpoint extends VendorServiceEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const base = getVendorServiceControllerBasePath(controller);
  const segment = getVendorServiceEndpointSegment(controller, endpoint);
  return buildEndpointPath(base, segment);
};

export const vendorServiceBackgroundTriggers = defineBackgroundTriggers({} as const);
