import type { Scope } from "../service-auth.js";

const trimSlashes = (value: string) => value.replace(/^\/+|\/+$/g, "");

export const joinPathSegments = (...segments: ReadonlyArray<string>) =>
  segments
    .map((segment) => trimSlashes(segment))
    .filter((segment) => segment.length > 0)
    .join("/");

export const buildEndpointPath = (basePath: string, segment: string) => {
  const joined = joinPathSegments(basePath, segment);
  if (!joined) {
    return "/";
  }
  return `/${joined}`;
};

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type EndpointDefinition = {
  method: HttpMethod;
  segment: string;
  description?: string;
  notes?: string;
  requiredScopes?: ReadonlyArray<Scope>;
};

export type ControllerDefinition<Endpoints extends Record<string, EndpointDefinition>> = {
  basePath: string;
  endpoints: Endpoints;
  description?: string;
};

export const defineHttpControllers = <
  Controllers extends Record<string, ControllerDefinition<Record<string, EndpointDefinition>>>
>(controllers: Controllers) => Object.freeze(controllers);

export type WebSocketRouteDefinition = {
  path: string;
  protocols?: ReadonlyArray<string>;
  description?: string;
  notes?: string;
};

export const defineWebSocketRoutes = <Routes extends Record<string, WebSocketRouteDefinition>>(routes: Routes) =>
  Object.freeze(routes);

export type KafkaBackgroundTrigger = {
  kind: "kafka";
  topic: string;
  role: "consumer" | "producer";
  description?: string;
};

export type BackgroundTriggerDefinition = KafkaBackgroundTrigger;

export const defineBackgroundTriggers = <Triggers extends Record<string, BackgroundTriggerDefinition>>(triggers: Triggers) =>
  Object.freeze(triggers);
