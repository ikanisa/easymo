import { AgentContext,Tool } from './types';

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  /**
   * Register a tool in the registry
   */
  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      console.warn(`Tool ${tool.name} already registered. Overwriting.`);
    }
    this.tools.set(tool.name, tool);
  }

  /**
   * Register multiple tools at once
   */
  registerMany(tools: Tool[]): void {
    tools.forEach(tool => this.register(tool));
  }

  /**
   * Get a tool by name
   */
  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all registered tools
   */
  getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools by capability
   */
  getByCapability(capability: string): Tool[] {
    return this.getAll().filter(tool => 
      tool.capabilities?.includes(capability)
    );
  }

  /**
   * Check if a tool exists
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Remove a tool
   */
  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Clear all tools
   */
  clear(): void {
    this.tools.clear();
  }

  /**
   * Get tool count
   */
  count(): number {
    return this.tools.size;
  }

  /**
   * Convert tools to Gemini function declarations format
   */
  toGeminiFunctionDeclarations(): any[] {
    return this.getAll().map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }));
  }

  /**
   * Convert tools to OpenAI function format
   */
  toOpenAIFunctions(): any[] {
    return this.getAll().map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    }));
  }

  /**
   * Execute a tool by name
   */
  async execute(
    name: string, 
    params: any, 
    context: AgentContext
  ): Promise<any> {
    const tool = this.get(name);
    if (!tool) {
      throw new Error(`Tool ${name} not found in registry`);
    }

    try {
      const result = await tool.execute(params, context);
      return result;
    } catch (error) {
      console.error(`Error executing tool ${name}:`, error);
      throw error;
    }
  }
}
