declare module "openai" {
  export interface OpenAIResponseContentImage {
    type: "input_image";
    image_base64: string;
  }

  export interface OpenAIResponseContentText {
    type: "input_text";
    text: string;
  }

  export interface OpenAIResponsesCreateRequest {
    model: string;
    input: Array<{
      role: string;
      content: Array<OpenAIResponseContentText | OpenAIResponseContentImage>;
    }>;
    response_format?: unknown;
  }

  export interface OpenAIResponseContentItem {
    type?: string;
    text?: string;
  }

  export interface OpenAIResponseOutputItem {
    content?: OpenAIResponseContentItem[];
  }

  export interface OpenAIResponsesCreateResult {
    id: string;
    output?: OpenAIResponseOutputItem[];
    output_text?: string;
  }

  export default class OpenAI {
    constructor(config: { apiKey: string });
    responses: {
      create: (request: OpenAIResponsesCreateRequest) => Promise<OpenAIResponsesCreateResult>;
    };
  }
}
