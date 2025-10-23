declare module '@easymo/commons' {
  export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

  export interface ApiEndpointDefinition {
    method: HttpMethod;
    segment: string;
  }

  export interface ApiControllerDefinition<Endpoints extends Record<string, ApiEndpointDefinition>> {
    basePath: string;
    endpoints: Endpoints;
  }

  export type ApiRoutes = {
    realtime: ApiControllerDefinition<{
      webhook: ApiEndpointDefinition;
      events: ApiEndpointDefinition;
      session: ApiEndpointDefinition;
    }>;
    waCalls: ApiControllerDefinition<{
      webhook: ApiEndpointDefinition;
      events: ApiEndpointDefinition;
    }>;
    whatsappCalls: ApiControllerDefinition<{
      webhook: ApiEndpointDefinition;
      events: ApiEndpointDefinition;
    }>;
    whatsappAgents: ApiControllerDefinition<{
      start: ApiEndpointDefinition;
      sendMessage: ApiEndpointDefinition;
      customerMessage: ApiEndpointDefinition;
    }>;
    twilio: ApiControllerDefinition<{
      status: ApiEndpointDefinition;
    }>;
    twiml: ApiControllerDefinition<{
      warmTransfer: ApiEndpointDefinition;
    }>;
  };

  export type ApiControllerKey = keyof ApiRoutes;
  export type ApiEndpointKey<Controller extends ApiControllerKey> = keyof ApiRoutes[Controller]['endpoints'];

  export const apiRoutes: ApiRoutes;

  export function getApiControllerBasePath<Controller extends ApiControllerKey>(controller: Controller): string;

  export function getApiEndpointSegment<
    Controller extends ApiControllerKey,
    Endpoint extends ApiEndpointKey<Controller>
  >(controller: Controller, endpoint: Endpoint): string;

  export function getApiEndpointMethod<
    Controller extends ApiControllerKey,
    Endpoint extends ApiEndpointKey<Controller>
  >(controller: Controller, endpoint: Endpoint): HttpMethod;

  export function getApiEndpointPath<
    Controller extends ApiControllerKey,
    Endpoint extends ApiEndpointKey<Controller>
  >(controller: Controller, endpoint: Endpoint): string;
}
