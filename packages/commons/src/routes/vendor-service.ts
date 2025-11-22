import {
  buildEndpointPath,
  type ControllerDefinition,
  defineHttpControllers,
  type EndpointDefinition,
} from "./utils";

const vendorServiceRouteDefinitions = defineHttpControllers({
  vendors: {
    basePath: "vendors" as const,
    description: "Vendor marketplace CRUD endpoints",
    endpoints: {
      create: { method: "POST" as const, segment: "" as const, notes: "Feature flag marketplace.vendor" },
      list: { method: "GET" as const, segment: "" as const, notes: "Feature flag marketplace.vendor" },
      entitlements: {
        method: "GET" as const,
        segment: ":id/entitlements" as const,
        notes: "Feature flag marketplace.vendor",
      },
      createQuote: {
        method: "POST" as const,
        segment: ":id/quotes" as const,
        notes: "Feature flag marketplace.vendor",
      },
    },
  },
  marketplace: {
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

export type VendorServiceRoutes = typeof vendorServiceRouteDefinitions;
export type VendorServiceControllerKey = keyof VendorServiceRoutes;
export type VendorServiceEndpointKey<Controller extends VendorServiceControllerKey> =
  keyof VendorServiceRoutes[Controller]["endpoints"];

export const vendorServiceRoutes = vendorServiceRouteDefinitions;

export const getVendorServiceControllerBasePath = <Controller extends VendorServiceControllerKey>(controller: Controller) =>
  vendorServiceRoutes[controller].basePath;

export const getVendorServiceEndpointSegment = <
  Controller extends VendorServiceControllerKey,
  Endpoint extends VendorServiceEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const controllerRoutes = vendorServiceRoutes[controller] as VendorServiceRoutes[Controller];
  const endpoints = controllerRoutes.endpoints as Record<VendorServiceEndpointKey<Controller>, EndpointDefinition>;
  return endpoints[endpoint].segment;
};

export const getVendorServiceEndpointMethod = <
  Controller extends VendorServiceControllerKey,
  Endpoint extends VendorServiceEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const controllerRoutes = vendorServiceRoutes[controller] as VendorServiceRoutes[Controller];
  const endpoints = controllerRoutes.endpoints as Record<VendorServiceEndpointKey<Controller>, EndpointDefinition>;
  return endpoints[endpoint].method;
};

export const getVendorServiceEndpointPath = <
  Controller extends VendorServiceControllerKey,
  Endpoint extends VendorServiceEndpointKey<Controller>,
>(controller: Controller, endpoint: Endpoint) => {
  const base = getVendorServiceControllerBasePath(controller);
  const segment = getVendorServiceEndpointSegment(controller, endpoint);
  return buildEndpointPath(base, segment);
};
