const trimSlashes = (value: string) => value.replace(/^\/+|\/+$/g, "");

export const joinPathSegments = (...segments: ReadonlyArray<string>) =>
  segments
    .map((segment) => trimSlashes(segment))
    .filter((segment) => segment.length > 0)
    .join("/");

export const buildEndpointPath = (basePath: string, segment: string) => {
  const joined = joinPathSegments(basePath, segment);
  return joined.length > 0 ? `/${joined}` : "/";
};

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type EndpointDefinition = {
  method: HttpMethod;
  segment: string;
};

export type ControllerDefinition<Endpoints extends Record<string, EndpointDefinition>> = {
  basePath: string;
  endpoints: Endpoints;
};

export const defineHttpControllers = <
  Controllers extends Record<string, ControllerDefinition<Record<string, EndpointDefinition>>>
>(controllers: Controllers) => Object.freeze(controllers);

type ControllerEndpoints<Routes, Controller extends keyof Routes> = Routes[Controller] extends {
  readonly endpoints: infer Endpoints;
}
  ? Endpoints extends Record<string, EndpointDefinition>
    ? Endpoints
    : never
  : Routes[Controller] extends ControllerDefinition<infer Endpoints>
    ? Endpoints
    : never;

type ControllerEndpointKey<Routes, Controller extends keyof Routes> = keyof ControllerEndpoints<Routes, Controller>;

export const createHttpRouteSelectors = <
  Routes extends Record<string, ControllerDefinition<Record<string, EndpointDefinition>>>
>(routes: Routes) => {
  const getControllerBasePath = <Controller extends keyof Routes>(controller: Controller) => routes[controller].basePath;

  const getEndpointSegment = <
    Controller extends keyof Routes,
    Endpoint extends ControllerEndpointKey<Routes, Controller>
  >(
    controller: Controller,
    endpoint: Endpoint,
  ) => {
    const controllerRoutes = routes[controller] as ControllerDefinition<Record<string, EndpointDefinition>>;
    const endpoints = controllerRoutes.endpoints as Record<string, EndpointDefinition>;
    return endpoints[endpoint as string].segment;
  };

  const getEndpointMethod = <
    Controller extends keyof Routes,
    Endpoint extends ControllerEndpointKey<Routes, Controller>
  >(
    controller: Controller,
    endpoint: Endpoint,
  ) => {
    const controllerRoutes = routes[controller] as ControllerDefinition<Record<string, EndpointDefinition>>;
    const endpoints = controllerRoutes.endpoints as Record<string, EndpointDefinition>;
    return endpoints[endpoint as string].method;
  };

  const getEndpointPath = <
    Controller extends keyof Routes,
    Endpoint extends ControllerEndpointKey<Routes, Controller>
  >(
    controller: Controller,
    endpoint: Endpoint,
  ) => {
    const base = getControllerBasePath(controller);
    const segment = getEndpointSegment(controller, endpoint);
    return buildEndpointPath(base, segment);
  };

  return Object.freeze({ getControllerBasePath, getEndpointSegment, getEndpointMethod, getEndpointPath });
};

export type WebSocketRouteDefinition = {
  path: string;
  description?: string;
};

export const defineWebsocketRoutes = <Routes extends Record<string, WebSocketRouteDefinition>>(routes: Routes) =>
  Object.freeze(routes);

export const createWebsocketRouteSelectors = <Routes extends Record<string, WebSocketRouteDefinition>>(routes: Routes) => {
  const getRoutePath = <Key extends keyof Routes>(key: Key) => routes[key].path;
  const getRouteDefinition = <Key extends keyof Routes>(key: Key) => routes[key];
  return Object.freeze({ getRoutePath, getRouteDefinition });
};

export type BackgroundTriggerDefinition = {
  type: "cron" | "queue" | "event" | "manual" | string;
  expression?: string;
  description?: string;
};

export const defineBackgroundTriggers = <Triggers extends Record<string, BackgroundTriggerDefinition>>(triggers: Triggers) =>
  Object.freeze(triggers);
