import { apiRoutes, type ApiControllerKey, type ApiEndpointKey } from "@easymo/commons";

type ControllerEndpoint<Controller extends ApiControllerKey> = Extract<ApiEndpointKey<Controller>, string>;

type ControllerTopics = {
  [Controller in ApiControllerKey]: ReadonlyArray<{
    endpoint: ControllerEndpoint<Controller>;
    topic: WebhookTopic<Controller, ControllerEndpoint<Controller>>;
  }>;
};

export type WebhookTopic<
  Controller extends ApiControllerKey,
  Endpoint extends ControllerEndpoint<Controller>,
> = `webhooks.${Controller}.${Endpoint}`;

export const getWebhookTopic = <
  Controller extends ApiControllerKey,
  Endpoint extends ControllerEndpoint<Controller>,
>(controller: Controller, endpoint: Endpoint): WebhookTopic<Controller, Endpoint> =>
  `webhooks.${controller}.${endpoint}` as WebhookTopic<Controller, Endpoint>;

const controllerEntries = Object.entries(apiRoutes) as Array<[
  ApiControllerKey,
  (typeof apiRoutes)[ApiControllerKey],
]>;

export const webhookTopics = Object.freeze(
  controllerEntries.reduce((acc, [controller, definition]) => {
    type Controller = typeof controller;
    const endpoints = Object.keys(definition.endpoints) as Array<ControllerEndpoint<Controller>>;
    acc[controller] = endpoints
      .filter((endpoint) => definition.endpoints[endpoint]?.method === "POST")
      .map((endpoint) => ({
        endpoint,
        topic: getWebhookTopic(controller, endpoint),
      }));
    return acc;
  }, {} as ControllerTopics),
);
