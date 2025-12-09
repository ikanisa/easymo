const trimSlashes = (value) => value.replace(/^\/+|\/+$/g, "");
export const joinPathSegments = (...segments) => segments
    .map((segment) => trimSlashes(segment))
    .filter((segment) => segment.length > 0)
    .join("/");
export const buildEndpointPath = (basePath, segment) => {
    const joined = joinPathSegments(basePath, segment);
    if (!joined) {
        return "/";
    }
    return `/${joined}`;
};
export const defineHttpControllers = (controllers) => Object.freeze(controllers);
export const defineWebSocketRoutes = (routes) => Object.freeze(routes);
export const defineBackgroundTriggers = (triggers) => Object.freeze(triggers);
