/**
 * Agent Factory
 * 
 * Dynamic creation and management of agents.
 * Supports:
 * - Loading agent definitions
 * - Creating agents on demand
 * - Managing agent lifecycle
 */

import { AGENT_DEFINITIONS } from "../agents/openai/agent-definitions";
import OpenAIAgentsSDK, { CreateAgentParams } from "../agents/openai/sdk-client";

export class AgentFactory {
  private sdk: OpenAIAgentsSDK;

  constructor(sdk: OpenAIAgentsSDK) {
    this.sdk = sdk;
  }

  /**
   * Get or create an agent by slug
   */
  async getAgent(slug: string): Promise<string> {
    const definition = AGENT_DEFINITIONS[slug];
    if (!definition) {
      throw new Error(`Unknown agent slug: ${slug}`);
    }

    // Check if agent already exists (naive implementation, should check DB/metadata)
    const assistants = await this.sdk.listAssistants();
    const existing = assistants.find((a) => a.name === definition.name);

    if (existing) {
      return existing.id;
    }

    // Create new agent
    const assistant = await this.sdk.createAssistant(definition);
    return assistant.id;
  }

  /**
   * Create a custom agent
   */
  async createCustomAgent(params: CreateAgentParams): Promise<string> {
    const assistant = await this.sdk.createAssistant(params);
    return assistant.id;
  }

  /**
   * Update an existing agent
   */
  async updateAgent(agentId: string, params: Partial<CreateAgentParams>): Promise<void> {
    await this.sdk.updateAssistant(agentId, params);
  }
}

export default AgentFactory;
