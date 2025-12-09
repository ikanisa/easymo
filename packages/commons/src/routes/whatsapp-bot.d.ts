declare const whatsappBotRouteDefinitions: Readonly<{
    readonly webhook: {
        readonly basePath: "webhook";
        readonly description: "Meta WhatsApp webhook handler";
        readonly endpoints: {
            readonly verify: {
                readonly method: "GET";
                readonly segment: "";
                readonly notes: "Expects hub.verify_token and hub.challenge query params";
            };
            readonly ingest: {
                readonly method: "POST";
                readonly segment: "";
                readonly notes: "Parses Meta webhook payloads";
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
export type WhatsappBotRoutes = typeof whatsappBotRouteDefinitions;
export type WhatsappBotControllerKey = keyof WhatsappBotRoutes;
export type WhatsappBotEndpointKey<Controller extends WhatsappBotControllerKey> = keyof WhatsappBotRoutes[Controller]["endpoints"];
export declare const whatsappBotRoutes: Readonly<{
    readonly webhook: {
        readonly basePath: "webhook";
        readonly description: "Meta WhatsApp webhook handler";
        readonly endpoints: {
            readonly verify: {
                readonly method: "GET";
                readonly segment: "";
                readonly notes: "Expects hub.verify_token and hub.challenge query params";
            };
            readonly ingest: {
                readonly method: "POST";
                readonly segment: "";
                readonly notes: "Parses Meta webhook payloads";
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
export declare const getWhatsappBotControllerBasePath: <Controller extends WhatsappBotControllerKey>(controller: Controller) => "health" | "webhook";
export declare const getWhatsappBotEndpointSegment: <Controller extends WhatsappBotControllerKey, Endpoint extends WhatsappBotEndpointKey<Controller>>(controller: Controller, endpoint: Endpoint) => string;
export declare const getWhatsappBotEndpointMethod: <Controller extends WhatsappBotControllerKey, Endpoint extends WhatsappBotEndpointKey<Controller>>(controller: Controller, endpoint: Endpoint) => import("./utils").HttpMethod;
export declare const getWhatsappBotEndpointPath: <Controller extends WhatsappBotControllerKey, Endpoint extends WhatsappBotEndpointKey<Controller>>(controller: Controller, endpoint: Endpoint) => string;
export {};
//# sourceMappingURL=whatsapp-bot.d.ts.map