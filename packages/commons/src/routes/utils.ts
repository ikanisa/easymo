const trimSlashes = (value: string) => value.replace(/^\/+|\/+$/g, "");

export const joinPathSegments = (...segments: ReadonlyArray<string>) =>
  segments
    .map((segment) => trimSlashes(segment))
    .filter((segment) => segment.length > 0)
    .join("/");

export const buildEndpointPath = (basePath: string, segment: string) => {
  const joined = joinPathSegments(basePath, segment);
  return `/${joined}` || "/";
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
