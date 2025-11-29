import { childLogger } from '@easymo/commons';
import PQueue from 'p-queue';
import { z } from 'zod';

import type { Tool, ToolContext,ToolHandler } from '../types/index.js';

const log = childLogger({ service: 'ai' });

export class ToolManager {
  private tools: Map<string, Tool> = new Map();
  private executionQueue: PQueue;
  private executionLog: Map<string, number> = new Map(); // Tool execution counter

  constructor() {
    this.executionQueue = new PQueue({ concurrency: 5 });
    this.registerBuiltinTools();
  }

  /**
   * Register builtin tools (placeholder - will be implemented separately)
   */
  private registerBuiltinTools(): void {
    // Built-in tools will be registered here
    log.info('Tool manager initialized');
  }

  /**
   * Register a tool
   */
  registerTool(name: string, tool: Tool): void {
    this.tools.set(name, tool);
    log.info(`Tool registered: ${name}`);
  }

  /**
   * Get a tool by name
   */
  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all registered tools
   */
  getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools by category
   */
  getToolsByCategory(category: string): Tool[] {
    return Array.from(this.tools.values()).filter(t => t.category === category);
  }

  /**
   * Execute a tool
   */
  async executeTool(name: string, args: any, context: ToolContext): Promise<any> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool ${name} not found`);
    }

    // Validate arguments
    const validatedArgs = tool.parameters.parse(args);

    // Check rate limiting
    if (tool.rateLimit) {
      await this.checkRateLimit(name, tool.rateLimit);
    }

    // Execute with queue
    return await this.executionQueue.add(async () => {
      const startTime = Date.now();
      try {
        const result = await tool.handler(validatedArgs, context);
        await this.logToolExecution(name, args, result, Date.now() - startTime, context);
        return result;
      } catch (error) {
        await this.logToolError(name, args, error, context);
        throw error;
      }
    });
  }

  /**
   * Convert Zod schema to JSON Schema for OpenAI
   */
  zodToJsonSchema(schema: z.ZodSchema<any>): any {
    // Simplified conversion - in production, use zod-to-json-schema library
    const zodType = (schema as any)._def;
    
    if (zodType.typeName === 'ZodObject') {
      const properties: any = {};
      const required: string[] = [];
      
      for (const [key, value] of Object.entries(zodType.shape())) {
        const fieldSchema = value as any;
        properties[key] = this.zodToJsonSchema(fieldSchema);
        
        if (!fieldSchema.isOptional()) {
          required.push(key);
        }
      }
      
      return {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined,
      };
    } else if (zodType.typeName === 'ZodString') {
      const desc = (zodType as any).description;
      return desc ? { type: 'string', description: desc } : { type: 'string' };
    } else if (zodType.typeName === 'ZodNumber') {
      return { type: 'number' };
    } else if (zodType.typeName === 'ZodBoolean') {
      return { type: 'boolean' };
    } else if (zodType.typeName === 'ZodArray') {
      return {
        type: 'array',
        items: this.zodToJsonSchema(zodType.type),
      };
    } else if (zodType.typeName === 'ZodEnum') {
      return {
        type: 'string',
        enum: zodType.values,
      };
    } else if (zodType.typeName === 'ZodOptional') {
      return this.zodToJsonSchema(zodType.innerType);
    }
    
    return { type: 'string' };
  }

  /**
   * Check rate limiting
   */
  private async checkRateLimit(toolName: string, limit: { requests: number; window: string }): Promise<void> {
    // Simple in-memory rate limiting
    // In production, use Redis-based rate limiting
    const count = this.executionLog.get(toolName) || 0;
    if (count >= limit.requests) {
      throw new Error(`Rate limit exceeded for tool: ${toolName}`);
    }
    this.executionLog.set(toolName, count + 1);
    
    // Reset after window
    const windowMs = limit.window === 'second' ? 1000 : limit.window === 'minute' ? 60000 : 3600000;
    setTimeout(() => {
      this.executionLog.delete(toolName);
    }, windowMs);
  }

  /**
   * Log tool execution
   */
  private async logToolExecution(
    name: string, 
    args: any, 
    result: any, 
    durationMs: number,
    context: ToolContext
  ): Promise<void> {
    log.info(`Tool executed: ${name}`, { 
      args, 
      durationMs,
      conversationId: context.conversationId 
    });
  }

  /**
   * Log tool error
   */
  private async logToolError(name: string, args: any, error: any, context: ToolContext): Promise<void> {
    log.error(`Tool error: ${name}`, { args, error: error.message, context });
  }

  /**
   * Get execution stats
   */
  getStats(): Record<string, number> {
    return Object.fromEntries(this.executionLog);
  }
}
