/**
 * Experiments - A/B testing support for agent configurations
 * 
 * Handles experiment assignment and outcome tracking for:
 * - System instruction variants
 * - Model config variants (temperature, etc.)
 * - Tool sets
 */

import { SupabaseClient } from '@supabase/supabase-js';

import { AiAgentSystemInstruction } from './types';

// ============================================================================
// TYPES
// ============================================================================

interface ExperimentVariant {
  id: string;
  experiment_id: string;
  variant_name: string;
  config: Record<string, unknown>;
  weight: number;
  is_control: boolean;
}

interface ExperimentAssignment {
  experiment_id: string;
  variant_id: string;
  variant_name: string;
  assigned_at: string;
}

interface ExperimentResult {
  experiment_id: string;
  variant_id: string;
  user_id?: string;
  session_id?: string;
  outcome: 'success' | 'failure' | 'abandoned';
  metrics: Record<string, unknown>;
}

// ============================================================================
// EXPERIMENT LOADER
// ============================================================================

/**
 * Get active experiments for an agent
 */
export async function getActiveExperiments(
  supabase: SupabaseClient,
  agentId: string
): Promise<{ id: string; name: string; type: string; variants: ExperimentVariant[] }[]> {
  const { data, error } = await supabase
    .from('ai_agent_instruction_experiments')
    .select(`
      id,
      name,
      experiment_type,
      variants:ai_agent_experiment_variants(*)
    `)
    .eq('agent_id', agentId)
    .eq('is_active', true);

  if (error || !data) return [];

  return data.map((exp) => ({
    id: exp.id,
    name: exp.name,
    type: exp.experiment_type,
    variants: (exp.variants as ExperimentVariant[]) || [],
  }));
}

/**
 * Select a variant based on weights (weighted random selection)
 */
function selectVariant(variants: ExperimentVariant[]): ExperimentVariant | null {
  if (!variants.length) return null;

  const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
  let random = Math.random() * totalWeight;

  for (const variant of variants) {
    random -= variant.weight;
    if (random <= 0) {
      return variant;
    }
  }

  return variants[0]; // Fallback
}

/**
 * Get or assign experiment variant for a session
 */
export async function getExperimentAssignment(
  supabase: SupabaseClient,
  experimentId: string,
  sessionId: string
): Promise<ExperimentAssignment | null> {
  // Check for existing assignment
  const { data: existing } = await supabase
    .from('ai_agent_experiment_assignments')
    .select('experiment_id, variant_id, variant_name, assigned_at')
    .eq('experiment_id', experimentId)
    .eq('session_id', sessionId)
    .single();

  if (existing) return existing as ExperimentAssignment;

  // Get experiment variants
  const { data: variants } = await supabase
    .from('ai_agent_experiment_variants')
    .select('*')
    .eq('experiment_id', experimentId)
    .eq('is_active', true);

  if (!variants?.length) return null;

  // Select variant
  const selected = selectVariant(variants as ExperimentVariant[]);
  if (!selected) return null;

  // Record assignment
  const assignment: ExperimentAssignment = {
    experiment_id: experimentId,
    variant_id: selected.id,
    variant_name: selected.variant_name,
    assigned_at: new Date().toISOString(),
  };

  await supabase.from('ai_agent_experiment_assignments').insert({
    ...assignment,
    session_id: sessionId,
  });

  return assignment;
}

/**
 * Record experiment outcome
 */
export async function recordExperimentResult(
  supabase: SupabaseClient,
  result: ExperimentResult
): Promise<void> {
  const { error } = await supabase
    .from('ai_agent_experiment_results')
    .insert({
      experiment_id: result.experiment_id,
      variant_id: result.variant_id,
      user_id: result.user_id,
      session_id: result.session_id,
      outcome: result.outcome,
      metrics: result.metrics,
    });

  if (error) {
    console.error('Failed to record experiment result:', error);
  }
}

// ============================================================================
// INSTRUCTION EXPERIMENT HELPER
// ============================================================================

/**
 * Get system instruction with experiment variant applied
 */
export async function getExperimentalSystemInstruction(
  supabase: SupabaseClient,
  agentId: string,
  baseInstruction: AiAgentSystemInstruction | null,
  sessionId: string
): Promise<{
  instruction: AiAgentSystemInstruction | null;
  experiment?: { id: string; variant: string };
}> {
  if (!baseInstruction) {
    return { instruction: null };
  }

  // Check for active instruction experiments
  const experiments = await getActiveExperiments(supabase, agentId);
  const instructionExperiment = experiments.find((e) => e.type === 'system_instruction');

  if (!instructionExperiment?.variants.length) {
    return { instruction: baseInstruction };
  }

  // Get or assign variant
  const assignment = await getExperimentAssignment(
    supabase,
    instructionExperiment.id,
    sessionId
  );

  if (!assignment) {
    return { instruction: baseInstruction };
  }

  // Find variant config
  const variant = instructionExperiment.variants.find((v) => v.id === assignment.variant_id);
  
  if (!variant || variant.is_control) {
    return {
      instruction: baseInstruction,
      experiment: { id: instructionExperiment.id, variant: 'control' },
    };
  }

  // Apply variant modifications
  const modifiedInstruction: AiAgentSystemInstruction = {
    ...baseInstruction,
    instructions: (variant.config.instructions as string) || baseInstruction.instructions,
    guardrails: (variant.config.guardrails as string) || baseInstruction.guardrails,
  };

  return {
    instruction: modifiedInstruction,
    experiment: { id: instructionExperiment.id, variant: assignment.variant_name },
  };
}

// ============================================================================
// MODEL CONFIG EXPERIMENT HELPER
// ============================================================================

/**
 * Get model config with experiment variant applied
 */
export async function getExperimentalModelConfig(
  supabase: SupabaseClient,
  agentId: string,
  baseConfig: { model?: string; temperature?: number; max_tokens?: number },
  sessionId: string
): Promise<{
  config: typeof baseConfig;
  experiment?: { id: string; variant: string };
}> {
  // Check for active model experiments
  const experiments = await getActiveExperiments(supabase, agentId);
  const modelExperiment = experiments.find((e) => e.type === 'model_config');

  if (!modelExperiment?.variants.length) {
    return { config: baseConfig };
  }

  // Get or assign variant
  const assignment = await getExperimentAssignment(
    supabase,
    modelExperiment.id,
    sessionId
  );

  if (!assignment) {
    return { config: baseConfig };
  }

  const variant = modelExperiment.variants.find((v) => v.id === assignment.variant_id);

  if (!variant || variant.is_control) {
    return {
      config: baseConfig,
      experiment: { id: modelExperiment.id, variant: 'control' },
    };
  }

  // Merge variant config
  return {
    config: {
      ...baseConfig,
      ...(variant.config as typeof baseConfig),
    },
    experiment: { id: modelExperiment.id, variant: assignment.variant_name },
  };
}
