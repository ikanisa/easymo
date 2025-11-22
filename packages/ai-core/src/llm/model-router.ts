import { AgentInput, ModelType } from '../base/types';

export class ModelRouter {
  private primaryModel: 'gemini' | 'gpt5';

  constructor(primaryModel: 'gemini' | 'gpt5' = 'gemini') {
    this.primaryModel = primaryModel;
  }

  /**
   * Select the best model for the given input
   */
  selectModel(input: AgentInput): ModelType {
    // Priority 1: Explicit priority setting
    if (input.priority === 'quality') {
      return 'gpt-5'; // GPT-5 for highest quality
    }
    if (input.priority === 'cost') {
      return 'gemini-2.5-pro'; // Gemini for cost efficiency
    }

    // Priority 2: Multimodal requirements
    if (input.hasImages || input.hasVideo) {
      return 'gemini-2.5-pro'; // Gemini excels at multimodal
    }

    // Priority 3: Context length
    if (input.contextLength && input.contextLength > 100000) {
      return 'gemini-2.5-pro'; // Gemini has longer context window
    }

    // Priority 4: Code execution
    if (input.requiresCodeExecution) {
      return 'gpt-5'; // GPT-5 with Code Interpreter
    }

    // Priority 5: Complexity
    if (input.complexity === 'high') {
      return 'gpt-5'; // GPT-5 for complex reasoning
    }

    // Default: Use agent's primary model
    return this.primaryModel === 'gemini' ? 'gemini-2.5-pro' : 'gpt-5';
  }

  /**
   * Get fallback model
   */
  getFallbackModel(currentModel: ModelType): ModelType {
    if (currentModel.startsWith('gemini')) {
      return 'gpt-4-turbo'; // Fallback to GPT-4 if Gemini fails
    }
    return 'gemini-2.5-pro'; // Fallback to Gemini if GPT fails
  }

  /**
   * Determine if model switch is beneficial
   */
  shouldSwitchModel(
    currentModel: ModelType,
    input: AgentInput,
    currentAttempt: number
  ): boolean {
    // Switch after 2 failed attempts
    if (currentAttempt >= 2) {
      return true;
    }

    // Switch if input characteristics change significantly
    if (input.hasImages && !currentModel.includes('gemini')) {
      return true;
    }

    return false;
  }
}
