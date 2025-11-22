/**
 * ReAct (Reasoning + Acting) Pattern Implementation
 * Provides a standardized loop for agents to reason and act
 */

import { Tool, AgentContext, ToolInvocation } from '../base/types';

export interface ReActStep {
  thought: string;
  action?: string;
  actionInput?: any;
  observation?: string;
}

export interface ReActResult {
  steps: ReActStep[];
  finalAnswer: string;
  toolsInvoked: ToolInvocation[];
}

/**
 * ReAct Pattern Implementation
 */
export class ReActPattern {
  private maxIterations: number;

  constructor(maxIterations: number = 10) {
    this.maxIterations = maxIterations;
  }

  /**
   * Execute ReAct loop
   * This is a helper that can be used by agents
   */
  async execute(
    query: string,
    tools: Tool[],
    llmFunction: (prompt: string) => Promise<string>,
    context: AgentContext
  ): Promise<ReActResult> {
    const steps: ReActStep[] = [];
    const toolsInvoked: ToolInvocation[] = [];

    let currentPrompt = this.buildInitialPrompt(query, tools);

    for (let i = 0; i < this.maxIterations; i++) {
      // Get LLM response
      const response = await llmFunction(currentPrompt);

      // Parse response
      const step = this.parseResponse(response);
      steps.push(step);

      // If final answer, we're done
      if (!step.action) {
        return {
          steps,
          finalAnswer: step.thought,
          toolsInvoked
        };
      }

      // Execute action (tool)
      const tool = tools.find(t => t.name === step.action);
      if (!tool) {
        step.observation = `Tool ${step.action} not found`;
        continue;
      }

      try {
        const startTime = Date.now();
        const result = await tool.execute(step.actionInput, context);
        
        toolsInvoked.push({
          toolName: tool.name,
          params: step.actionInput,
          result,
          duration: Date.now() - startTime,
          timestamp: new Date()
        });

        step.observation = JSON.stringify(result);
      } catch (error) {
        step.observation = `Error: ${error instanceof Error ? error.message : String(error)}`;
      }

      // Build next prompt
      currentPrompt = this.buildNextPrompt(query, steps);
    }

    // Max iterations reached
    return {
      steps,
      finalAnswer: 'Max iterations reached without final answer',
      toolsInvoked
    };
  }

  /**
   * Build initial prompt
   */
  private buildInitialPrompt(query: string, tools: Tool[]): string {
    const toolDescriptions = tools.map(t => 
      `- ${t.name}: ${t.description}`
    ).join('\n');

    return `You are a helpful assistant that uses tools to answer questions.

Available tools:
${toolDescriptions}

Question: ${query}

Think step by step. Use the following format:

Thought: [your reasoning]
Action: [tool name]
Action Input: [tool input as JSON]
Observation: [tool result]
... (repeat Thought/Action/Observation as needed)
Thought: I now know the final answer
Final Answer: [your final answer]

Begin!`;
  }

  /**
   * Build next prompt with history
   */
  private buildNextPrompt(query: string, steps: ReActStep[]): string {
    const history = steps.map(step => {
      let text = `Thought: ${step.thought}\n`;
      if (step.action) {
        text += `Action: ${step.action}\n`;
        text += `Action Input: ${JSON.stringify(step.actionInput)}\n`;
        text += `Observation: ${step.observation}\n`;
      }
      return text;
    }).join('\n');

    return `Question: ${query}\n\n${history}\n\nContinue:`;
  }

  /**
   * Parse LLM response into ReAct step
   */
  private parseResponse(response: string): ReActStep {
    const step: ReActStep = {
      thought: ''
    };

    // Extract thought
    const thoughtMatch = response.match(/Thought:\s*(.+?)(?=\n|$)/i);
    if (thoughtMatch) {
      step.thought = thoughtMatch[1].trim();
    }

    // Check for final answer
    if (response.toLowerCase().includes('final answer:')) {
      const answerMatch = response.match(/Final Answer:\s*(.+)/is);
      if (answerMatch) {
        step.thought = answerMatch[1].trim();
      }
      return step;
    }

    // Extract action
    const actionMatch = response.match(/Action:\s*(.+?)(?=\n|$)/i);
    if (actionMatch) {
      step.action = actionMatch[1].trim();
    }

    // Extract action input
    const inputMatch = response.match(/Action Input:\s*(.+?)(?=\n|$)/is);
    if (inputMatch) {
      try {
        step.actionInput = JSON.parse(inputMatch[1].trim());
      } catch {
        step.actionInput = inputMatch[1].trim();
      }
    }

    return step;
  }
}
