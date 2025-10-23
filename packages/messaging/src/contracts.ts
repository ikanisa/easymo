import { apiRoutes, type ApiControllerKey, type ApiEndpointKey, type ApiEndpointDefinition } from "@easymo/commons";

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

const controllerEntries = Object.entries(apiRoutes) as Array<[ApiControllerKey, any]>;

export const webhookTopics = Object.freeze(
  controllerEntries.reduce((acc, [controller, definition]) => {
    const endpoints = Object.keys(definition.endpoints) as string[];
    const endpointsRecord = definition.endpoints as Record<string, ApiEndpointDefinition>;
    const items = endpoints
      .filter((endpoint) => endpointsRecord[endpoint]?.method === "POST")
      .map((endpoint) => ({
        endpoint: endpoint as any,
        topic: getWebhookTopic(controller as any, endpoint as any),
      }));
    (acc as any)[controller] = items;
    return acc;
  }, {} as ControllerTopics),
);

export type WebhookTopicName = ControllerTopics[ApiControllerKey][number]["topic"];

export const getWebhookTopicsForController = <Controller extends ApiControllerKey>(controller: Controller) =>
  webhookTopics[controller];
