import { buildEndpointPath, defineHttpControllers, } from "./utils";
const vendorServiceRouteDefinitions = defineHttpControllers({
    vendors: {
        basePath: "vendors",
        description: "Vendor marketplace CRUD endpoints",
        endpoints: {
            create: { method: "POST", segment: "", notes: "Feature flag marketplace.vendor" },
            list: { method: "GET", segment: "", notes: "Feature flag marketplace.vendor" },
            entitlements: {
                method: "GET",
                segment: ":id/entitlements",
                notes: "Feature flag marketplace.vendor",
            },
            createQuote: {
                method: "POST",
                segment: ":id/quotes",
                notes: "Feature flag marketplace.vendor",
            },
        },
    },
    marketplace: {
        basePath: "marketplace",
        endpoints: {
            getSettings: { method: "GET", segment: "settings" },
            updateSettings: { method: "POST", segment: "settings" },
        },
    },
    health: {
        basePath: "health",
        endpoints: {
            status: { method: "GET", segment: "" },
        },
    },
});
export const vendorServiceRoutes = vendorServiceRouteDefinitions;
export const getVendorServiceControllerBasePath = (controller) => vendorServiceRoutes[controller].basePath;
export const getVendorServiceEndpointSegment = (controller, endpoint) => {
    const controllerRoutes = vendorServiceRoutes[controller];
    const endpoints = controllerRoutes.endpoints;
    return endpoints[endpoint].segment;
};
export const getVendorServiceEndpointMethod = (controller, endpoint) => {
    const controllerRoutes = vendorServiceRoutes[controller];
    const endpoints = controllerRoutes.endpoints;
    return endpoints[endpoint].method;
};
export const getVendorServiceEndpointPath = (controller, endpoint) => {
    const base = getVendorServiceControllerBasePath(controller);
    const segment = getVendorServiceEndpointSegment(controller, endpoint);
    return buildEndpointPath(base, segment);
};
