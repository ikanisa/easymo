import {
  apiRoutes,
  getApiEndpointMethod,
  getApiEndpointPath,
  type ApiControllerKey,
  type ApiEndpointKey,
  type HttpMethod,
} from "@easymo/commons";

export type ServiceEndpointRecord = {
  controller: ApiControllerKey;
  endpoint: ApiEndpointKey<ApiControllerKey>;
  method: HttpMethod;
  path: string;
};

const controllerEntries = Object.entries(apiRoutes) as Array<[
  ApiControllerKey,
  (typeof apiRoutes)[ApiControllerKey],
]>;

export const serviceEndpointRecords = Object.freeze(
  controllerEntries.flatMap((entry) => {
    const [controller, definition] = entry;
    type Controller = typeof controller;
    const endpoints = Object.keys(definition.endpoints) as Array<ApiEndpointKey<Controller>>;

    return endpoints.map((endpoint) => ({
      controller,
      endpoint: endpoint as ApiEndpointKey<ApiControllerKey>,
      method: getApiEndpointMethod(controller, endpoint),
      path: getApiEndpointPath(controller, endpoint),
    }));
  }),
);

export const getServiceEndpointRecords = () => serviceEndpointRecords;
