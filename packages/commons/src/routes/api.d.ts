import { type ControllerDefinition, type EndpointDefinition, type HttpMethod } from "./utils";
declare const apiRouteDefinitions: Readonly<{
    readonly realtime: {
        readonly basePath: "realtime";
        readonly endpoints: {
            readonly webhook: {
                readonly method: "POST";
                readonly segment: "webhook";
            };
            readonly events: {
                readonly method: "POST";
                readonly segment: "events";
            };
            readonly session: {
                readonly method: "POST";
                readonly segment: "session";
            };
        };
    };
    readonly waCalls: {
        readonly basePath: "wa";
        readonly endpoints: {
            readonly webhook: {
                readonly method: "GET";
                readonly segment: "webhook";
            };
            readonly events: {
                readonly method: "POST";
                readonly segment: "events";
            };
        };
    };
    readonly whatsappAgents: {
        readonly basePath: "wa/agents";
        readonly endpoints: {
            readonly start: {
                readonly method: "POST";
                readonly segment: "start";
            };
            readonly sendMessage: {
                readonly method: "POST";
                readonly segment: ":threadId/message";
            };
            readonly customerMessage: {
                readonly method: "POST";
                readonly segment: ":threadId/customer";
            };
        };
    };
    readonly whatsappFlow: {
        readonly basePath: "wa/flow";
        readonly endpoints: {
            readonly bootstrap: {
                readonly method: "POST";
                readonly segment: "bootstrap";
            };
        };
    };
    readonly whatsappCalls: {
        readonly basePath: "wa";
        readonly endpoints: {
            readonly webhook: {
                readonly method: "GET";
                readonly segment: "webhook";
            };
            readonly events: {
                readonly method: "POST";
                readonly segment: "events";
            };
        };
    };
    readonly twilio: {
        readonly basePath: "twilio";
        readonly endpoints: {
            readonly status: {
                readonly method: "POST";
                readonly segment: "status";
            };
        };
    };
    readonly twiml: {
        readonly basePath: "twiml";
        readonly endpoints: {
            readonly warmTransfer: {
                readonly method: "GET";
                readonly segment: "warm-transfer";
            };
        };
    };
    readonly payment: {
        readonly basePath: "payment";
        readonly endpoints: {
            readonly confirm: {
                readonly method: "POST";
                readonly segment: "confirm";
            };
        };
    };
    readonly driverParking: {
        readonly basePath: "driver/parking";
        readonly endpoints: {
            readonly list: {
                readonly method: "GET";
                readonly segment: "";
            };
            readonly create: {
                readonly method: "POST";
                readonly segment: "";
            };
            readonly update: {
                readonly method: "PUT";
                readonly segment: ":id";
            };
            readonly delete: {
                readonly method: "DELETE";
                readonly segment: ":id";
            };
        };
    };
    readonly driverAvailability: {
        readonly basePath: "driver/availability";
        readonly endpoints: {
            readonly list: {
                readonly method: "GET";
                readonly segment: "";
            };
            readonly create: {
                readonly method: "POST";
                readonly segment: "";
            };
            readonly update: {
                readonly method: "PUT";
                readonly segment: ":id";
            };
            readonly delete: {
                readonly method: "DELETE";
                readonly segment: ":id";
            };
        };
    };
    readonly broker: {
        readonly basePath: "broker";
        readonly endpoints: {
            readonly candidates: {
                readonly method: "POST";
                readonly segment: "candidates";
            };
        };
    };
}>;
export type ApiRoutes = typeof apiRouteDefinitions;
export type ApiControllerKey = keyof ApiRoutes;
export type ApiEndpointKey<Controller extends ApiControllerKey> = keyof ApiRoutes[Controller]["endpoints"];
export declare const apiRoutes: Readonly<{
    readonly realtime: {
        readonly basePath: "realtime";
        readonly endpoints: {
            readonly webhook: {
                readonly method: "POST";
                readonly segment: "webhook";
            };
            readonly events: {
                readonly method: "POST";
                readonly segment: "events";
            };
            readonly session: {
                readonly method: "POST";
                readonly segment: "session";
            };
        };
    };
    readonly waCalls: {
        readonly basePath: "wa";
        readonly endpoints: {
            readonly webhook: {
                readonly method: "GET";
                readonly segment: "webhook";
            };
            readonly events: {
                readonly method: "POST";
                readonly segment: "events";
            };
        };
    };
    readonly whatsappAgents: {
        readonly basePath: "wa/agents";
        readonly endpoints: {
            readonly start: {
                readonly method: "POST";
                readonly segment: "start";
            };
            readonly sendMessage: {
                readonly method: "POST";
                readonly segment: ":threadId/message";
            };
            readonly customerMessage: {
                readonly method: "POST";
                readonly segment: ":threadId/customer";
            };
        };
    };
    readonly whatsappFlow: {
        readonly basePath: "wa/flow";
        readonly endpoints: {
            readonly bootstrap: {
                readonly method: "POST";
                readonly segment: "bootstrap";
            };
        };
    };
    readonly whatsappCalls: {
        readonly basePath: "wa";
        readonly endpoints: {
            readonly webhook: {
                readonly method: "GET";
                readonly segment: "webhook";
            };
            readonly events: {
                readonly method: "POST";
                readonly segment: "events";
            };
        };
    };
    readonly twilio: {
        readonly basePath: "twilio";
        readonly endpoints: {
            readonly status: {
                readonly method: "POST";
                readonly segment: "status";
            };
        };
    };
    readonly twiml: {
        readonly basePath: "twiml";
        readonly endpoints: {
            readonly warmTransfer: {
                readonly method: "GET";
                readonly segment: "warm-transfer";
            };
        };
    };
    readonly payment: {
        readonly basePath: "payment";
        readonly endpoints: {
            readonly confirm: {
                readonly method: "POST";
                readonly segment: "confirm";
            };
        };
    };
    readonly driverParking: {
        readonly basePath: "driver/parking";
        readonly endpoints: {
            readonly list: {
                readonly method: "GET";
                readonly segment: "";
            };
            readonly create: {
                readonly method: "POST";
                readonly segment: "";
            };
            readonly update: {
                readonly method: "PUT";
                readonly segment: ":id";
            };
            readonly delete: {
                readonly method: "DELETE";
                readonly segment: ":id";
            };
        };
    };
    readonly driverAvailability: {
        readonly basePath: "driver/availability";
        readonly endpoints: {
            readonly list: {
                readonly method: "GET";
                readonly segment: "";
            };
            readonly create: {
                readonly method: "POST";
                readonly segment: "";
            };
            readonly update: {
                readonly method: "PUT";
                readonly segment: ":id";
            };
            readonly delete: {
                readonly method: "DELETE";
                readonly segment: ":id";
            };
        };
    };
    readonly broker: {
        readonly basePath: "broker";
        readonly endpoints: {
            readonly candidates: {
                readonly method: "POST";
                readonly segment: "candidates";
            };
        };
    };
}>;
export declare const getApiControllerBasePath: <Controller extends ApiControllerKey>(controller: Controller) => "realtime" | "wa" | "wa/agents" | "wa/flow" | "twilio" | "twiml" | "payment" | "driver/parking" | "driver/availability" | "broker";
export declare const getApiEndpointSegment: <Controller extends ApiControllerKey, Endpoint extends ApiEndpointKey<Controller>>(controller: Controller, endpoint: Endpoint) => string;
export declare const getApiEndpointMethod: <Controller extends ApiControllerKey, Endpoint extends ApiEndpointKey<Controller>>(controller: Controller, endpoint: Endpoint) => HttpMethod;
export declare const getApiEndpointPath: <Controller extends ApiControllerKey, Endpoint extends ApiEndpointKey<Controller>>(controller: Controller, endpoint: Endpoint) => string;
export type { ControllerDefinition as ApiControllerDefinition, EndpointDefinition as ApiEndpointDefinition, HttpMethod };
//# sourceMappingURL=api.d.ts.map