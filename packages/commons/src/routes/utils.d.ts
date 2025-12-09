export declare const joinPathSegments: (...segments: ReadonlyArray<string>) => string;
export declare const buildEndpointPath: (basePath: string, segment: string) => string;
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type EndpointDefinition = {
    method: HttpMethod;
    segment: string;
    description?: string;
    notes?: string;
};
export type ControllerDefinition<Endpoints extends Record<string, EndpointDefinition>> = {
    basePath: string;
    endpoints: Endpoints;
    description?: string;
};
export declare const defineHttpControllers: <Controllers extends Record<string, ControllerDefinition<Record<string, EndpointDefinition>>>>(controllers: Controllers) => Readonly<Controllers>;
export type WebSocketRouteDefinition = {
    path: string;
    protocols?: ReadonlyArray<string>;
    description?: string;
    notes?: string;
};
export declare const defineWebSocketRoutes: <Routes extends Record<string, WebSocketRouteDefinition>>(routes: Routes) => Readonly<Routes>;
export type KafkaBackgroundTrigger = {
    kind: "kafka";
    topic: string;
    role: "consumer" | "producer";
    description?: string;
};
export type BackgroundTriggerDefinition = KafkaBackgroundTrigger;
export declare const defineBackgroundTriggers: <Triggers extends Record<string, BackgroundTriggerDefinition>>(triggers: Triggers) => Readonly<Triggers>;
//# sourceMappingURL=utils.d.ts.map