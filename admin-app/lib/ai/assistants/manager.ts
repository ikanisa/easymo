import { getOpenAIClient } from "../providers/openai-client";

export interface AssistantConfig {
  name: string;
  instructions: string;
  model?: string;
  tools?: Array<{ type: string }>;
  fileIds?: string[];
}

export interface ThreadMessage {
  role: "user" | "assistant";
  content: string;
}

class AssistantsManager {
  private client = getOpenAIClient();

  async createAssistant(config: AssistantConfig) {
    const assistant = await this.client.beta.assistants.create({
      name: config.name,
      instructions: config.instructions,
      model: config.model || "gpt-4o-mini",
      tools: config.tools || [{ type: "code_interpreter" }, { type: "file_search" }],
    });

    return assistant;
  }

  async getAssistant(assistantId: string) {
    return await this.client.beta.assistants.retrieve(assistantId);
  }

  async updateAssistant(assistantId: string, config: Partial<AssistantConfig>) {
    return await this.client.beta.assistants.update(assistantId, {
      name: config.name,
      instructions: config.instructions,
      tools: config.tools,
    });
  }

  async deleteAssistant(assistantId: string) {
    return await this.client.beta.assistants.del(assistantId);
  }

  async listAssistants() {
    const response = await this.client.beta.assistants.list();
    return response.data;
  }

  // Thread management
  async createThread() {
    return await this.client.beta.threads.create();
  }

  async addMessage(threadId: string, content: string) {
    return await this.client.beta.threads.messages.create(threadId, {
      role: "user",
      content,
    });
  }

  async runAssistant(threadId: string, assistantId: string) {
    const run = await this.client.beta.threads.runs.create(threadId, {
      assistant_id: assistantId,
    });

    // Poll for completion
    let runStatus = await this.client.beta.threads.runs.retrieve(threadId, run.id);

    while (runStatus.status === "queued" || runStatus.status === "in_progress") {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      runStatus = await this.client.beta.threads.runs.retrieve(threadId, run.id);
    }

    return runStatus;
  }

  async getMessages(threadId: string) {
    const response = await this.client.beta.threads.messages.list(threadId);
    return response.data;
  }

  // Streaming support
  async runAssistantWithStreaming(
    threadId: string,
    assistantId: string,
    onToken: (token: string) => void
  ) {
    const stream = await this.client.beta.threads.runs.stream(threadId, {
      assistant_id: assistantId,
    });

    for await (const event of stream) {
      if (event.event === "thread.message.delta") {
        const delta = event.data.delta;
        if (delta.content && delta.content[0]?.type === "text") {
          onToken(delta.content[0].text?.value || "");
        }
      }
    }
  }

  // File upload for code interpreter
  async uploadFile(file: File) {
    const uploadedFile = await this.client.files.create({
      file,
      purpose: "assistants",
    });

    return uploadedFile;
  }

  // Complete conversation helper
  async chat(assistantId: string, messages: ThreadMessage[]) {
    const thread = await this.createThread();

    // Add all messages
    for (const msg of messages) {
      if (msg.role === "user") {
        await this.addMessage(thread.id, msg.content);
      }
    }

    // Run assistant
    await this.runAssistant(thread.id, assistantId);

    // Get response
    const allMessages = await this.getMessages(thread.id);
    const assistantMessages = allMessages
      .filter((m) => m.role === "assistant")
      .map((m) => ({
        role: "assistant" as const,
        content:
          m.content[0]?.type === "text" ? m.content[0].text.value : "",
      }));

    return {
      threadId: thread.id,
      messages: assistantMessages,
    };
  }
}

export const assistantsManager = new AssistantsManager();

// Predefined assistants
export const ASSISTANT_TEMPLATES = {
  mobility: {
    name: "EasyMO Mobility Assistant",
    instructions: `You are a helpful mobility assistant for EasyMO platform.
    
You help users with:
- Finding and booking rides
- Driver information
- Trip scheduling
- Location services
- Payment and pricing

Use the available tools to access real-time data about drivers, trips, and locations.
Always be helpful, concise, and focused on solving the user's mobility needs.`,
    model: "gpt-4o-mini",
    tools: [{ type: "file_search" }, { type: "code_interpreter" }],
  },
  marketplace: {
    name: "EasyMO Marketplace Assistant",
    instructions: `You are a marketplace assistant for EasyMO.
    
You help users with:
- Product search and discovery
- Order placement
- Vendor information
- Delivery tracking
- Returns and support

Provide accurate product information and guide users through the purchasing process.`,
    model: "gpt-4o-mini",
    tools: [{ type: "file_search" }],
  },
  support: {
    name: "EasyMO Support Assistant",
    instructions: `You are a customer support assistant for EasyMO.
    
You help users with:
- Account issues
- Technical problems
- Billing questions
- Feature explanations
- General inquiries

Be empathetic, professional, and solution-oriented. Escalate complex issues when needed.`,
    model: "gpt-4o-mini",
    tools: [{ type: "file_search" }],
  },
};
