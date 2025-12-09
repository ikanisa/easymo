/**
 * Experiment Support - A/B Testing for Agent Instructions
 * 
 * Enables A/B testing of different system instructions for agents.
 * Uses consistent hashing to ensure users always see the same variant.
 * 
 * Tables:
 * - ai_agent_instruction_experiments: Defines experiments
 * - ai_agent_experiment_results: Tracks outcomes
 * 
 * @example
 * const experiment = await getActiveExperiment(supabase, agentId);
 * if (experiment) {
 *   const variant = assignVariant(experiment, userId);
 *   const instruction = await getInstructionForVariant(supabase, experiment, variant);
 *   // Use instruction instead of default
 *   await logExperimentAssignment(supabase, experiment.id, userId, variant);
 * }
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  AiAgentSystemInstruction,
  AiAgentSystemInstructionRow,
  ExperimentStatus,
} from './agent-config.types';

// =====================================================================
// TYPES
// =====================================================================

export interface ActiveExperiment {
  id: string;
  agentId: string;
  experimentName: string;
  variantAInstructionId: string | null;
  variantBInstructionId: string | null;
  trafficSplitPercent: number;
  successMetric: string | null;
  status: ExperimentStatus;
}

export interface ExperimentVariant {
  variant: 'A' | 'B';
  instructionId: string | null;
}

// =====================================================================
// EXPERIMENT RETRIEVAL
// =====================================================================

/**
 * Get active experiment for an agent (if any)
 */
export async function getActiveExperiment(
  supabase: SupabaseClient,
  agentId: string
): Promise<ActiveExperiment | null> {
  const { data, error } = await supabase
    .from('ai_agent_instruction_experiments')
    .select('*')
    .eq('agent_id', agentId)
    .eq('status', 'active')
    .lte('start_date', new Date().toISOString())
    .or(`end_date.is.null,end_date.gte.${new Date().toISOString()}`)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    agentId: data.agent_id,
    experimentName: data.experiment_name,
    variantAInstructionId: data.variant_a_instruction_id,
    variantBInstructionId: data.variant_b_instruction_id,
    trafficSplitPercent: data.traffic_split_percent,
    successMetric: data.success_metric,
    status: data.status,
  };
}

/**
 * List all experiments for an agent
 */
export async function listExperiments(
  supabase: SupabaseClient,
  agentId: string
): Promise<ActiveExperiment[]> {
  const { data, error } = await supabase
    .from('ai_agent_instruction_experiments')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map(row => ({
    id: row.id,
    agentId: row.agent_id,
    experimentName: row.experiment_name,
    variantAInstructionId: row.variant_a_instruction_id,
    variantBInstructionId: row.variant_b_instruction_id,
    trafficSplitPercent: row.traffic_split_percent,
    successMetric: row.success_metric,
    status: row.status,
  }));
}

// =====================================================================
// VARIANT ASSIGNMENT
// =====================================================================

/**
 * Assign a variant to a user using consistent hashing
 * Same user always gets the same variant for the same experiment
 */
export function assignVariant(
  experiment: ActiveExperiment,
  userId: string
): ExperimentVariant {
  // Consistent hash based on user ID
  const hash = simpleHash(userId);
  const bucket = hash % 100;
  
  // Assign to variant based on traffic split
  if (bucket < experiment.trafficSplitPercent) {
    return {
      variant: 'A',
      instructionId: experiment.variantAInstructionId,
    };
  } else {
    return {
      variant: 'B',
      instructionId: experiment.variantBInstructionId,
    };
  }
}

/**
 * Simple hash function for consistent bucketing
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash | 0; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

// =====================================================================
// INSTRUCTION RETRIEVAL
// =====================================================================

/**
 * Get system instruction for a specific variant
 */
export async function getInstructionForVariant(
  supabase: SupabaseClient,
  experiment: ActiveExperiment,
  variant: ExperimentVariant
): Promise<AiAgentSystemInstruction | null> {
  if (!variant.instructionId) {
    return null;
  }

  const { data, error } = await supabase
    .from('ai_agent_system_instructions')
    .select('*')
    .eq('id', variant.instructionId)
    .single();

  if (error || !data) {
    return null;
  }

  return toAiAgentSystemInstruction(data);
}

/**
 * Get the appropriate instruction for a user, considering experiments
 */
export async function getExperimentAwareInstruction(
  supabase: SupabaseClient,
  agentId: string,
  userId: string,
  defaultInstruction: AiAgentSystemInstruction | null
): Promise<{
  instruction: AiAgentSystemInstruction | null;
  experimentId?: string;
  variant?: 'A' | 'B';
}> {
  // Check for active experiment
  const experiment = await getActiveExperiment(supabase, agentId);
  
  if (!experiment) {
    return { instruction: defaultInstruction };
  }

  // Assign variant
  const variant = assignVariant(experiment, userId);
  
  // Get instruction for variant
  const instruction = await getInstructionForVariant(supabase, experiment, variant);
  
  // Log assignment
  await logExperimentAssignment(supabase, experiment.id, userId, variant.variant);
  
  return {
    instruction: instruction || defaultInstruction,
    experimentId: experiment.id,
    variant: variant.variant,
  };
}

// =====================================================================
// EXPERIMENT LOGGING
// =====================================================================

/**
 * Log when a user is assigned to an experiment variant
 */
export async function logExperimentAssignment(
  supabase: SupabaseClient,
  experimentId: string,
  userId: string,
  variant: 'A' | 'B'
): Promise<void> {
  try {
    // We only log the assignment, not the result yet
    console.warn(JSON.stringify({
      event: 'EXPERIMENT_ASSIGNMENT',
      experimentId,
      userId: userId.slice(0, 8) + '...', // Truncate for privacy
      variant,
    }));
  } catch (err) {
    console.error('Failed to log experiment assignment:', err);
  }
}

/**
 * Log experiment outcome
 */
export async function logExperimentOutcome(
  supabase: SupabaseClient,
  experimentId: string,
  userId: string,
  variant: 'A' | 'B',
  outcome: {
    success?: boolean;
    satisfactionScore?: number;
    conversationLength?: number;
    toolsExecuted?: number;
    toolsSucceeded?: number;
    responseTimeMs?: number;
  }
): Promise<void> {
  try {
    const { error } = await supabase.from('ai_agent_experiment_results').insert({
      experiment_id: experimentId,
      user_id: userId,
      variant,
      success: outcome.success,
      user_satisfaction_score: outcome.satisfactionScore,
      conversation_length: outcome.conversationLength,
      tools_executed: outcome.toolsExecuted ?? 0,
      tools_succeeded: outcome.toolsSucceeded ?? 0,
      response_time_ms: outcome.responseTimeMs,
      metadata: {},
    });

    if (error) {
      console.error('Failed to log experiment outcome:', error.message);
    }
  } catch (err) {
    console.error('Failed to log experiment outcome:', err);
  }
}

// =====================================================================
// EXPERIMENT MANAGEMENT
// =====================================================================

/**
 * Create a new experiment
 */
export async function createExperiment(
  supabase: SupabaseClient,
  params: {
    agentId: string;
    experimentName: string;
    variantAInstructionId: string;
    variantBInstructionId: string;
    trafficSplitPercent?: number;
    successMetric?: string;
    notes?: string;
  }
): Promise<ActiveExperiment | null> {
  const { data, error } = await supabase
    .from('ai_agent_instruction_experiments')
    .insert({
      agent_id: params.agentId,
      experiment_name: params.experimentName,
      variant_a_instruction_id: params.variantAInstructionId,
      variant_b_instruction_id: params.variantBInstructionId,
      traffic_split_percent: params.trafficSplitPercent ?? 50,
      success_metric: params.successMetric,
      notes: params.notes,
      status: 'draft',
    })
    .select()
    .single();

  if (error || !data) {
    console.error('Failed to create experiment:', error?.message);
    return null;
  }

  return {
    id: data.id,
    agentId: data.agent_id,
    experimentName: data.experiment_name,
    variantAInstructionId: data.variant_a_instruction_id,
    variantBInstructionId: data.variant_b_instruction_id,
    trafficSplitPercent: data.traffic_split_percent,
    successMetric: data.success_metric,
    status: data.status,
  };
}

/**
 * Start an experiment
 */
export async function startExperiment(
  supabase: SupabaseClient,
  experimentId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('ai_agent_instruction_experiments')
    .update({ status: 'active', start_date: new Date().toISOString() })
    .eq('id', experimentId);

  return !error;
}

/**
 * Pause an experiment
 */
export async function pauseExperiment(
  supabase: SupabaseClient,
  experimentId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('ai_agent_instruction_experiments')
    .update({ status: 'paused' })
    .eq('id', experimentId);

  return !error;
}

/**
 * Complete an experiment
 */
export async function completeExperiment(
  supabase: SupabaseClient,
  experimentId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('ai_agent_instruction_experiments')
    .update({ status: 'completed', end_date: new Date().toISOString() })
    .eq('id', experimentId);

  return !error;
}

// =====================================================================
// EXPERIMENT ANALYTICS
// =====================================================================

/**
 * Get experiment results summary
 */
export async function getExperimentResults(
  supabase: SupabaseClient,
  experimentId: string
): Promise<{
  variantA: VariantStats;
  variantB: VariantStats;
  winner: 'A' | 'B' | 'tie' | 'insufficient_data';
}> {
  const { data, error } = await supabase
    .from('ai_agent_experiment_results')
    .select('variant, success, user_satisfaction_score, response_time_ms, tools_executed, tools_succeeded')
    .eq('experiment_id', experimentId);

  if (error || !data || data.length === 0) {
    return {
      variantA: createEmptyStats(),
      variantB: createEmptyStats(),
      winner: 'insufficient_data',
    };
  }

  const variantAData = data.filter(d => d.variant === 'A');
  const variantBData = data.filter(d => d.variant === 'B');

  const variantA = calculateStats(variantAData);
  const variantB = calculateStats(variantBData);

  // Determine winner based on success rate (can be customized)
  let winner: 'A' | 'B' | 'tie' | 'insufficient_data' = 'insufficient_data';
  
  if (variantA.sampleSize >= 30 && variantB.sampleSize >= 30) {
    const diff = Math.abs(variantA.successRate - variantB.successRate);
    if (diff < 0.05) {
      winner = 'tie';
    } else {
      winner = variantA.successRate > variantB.successRate ? 'A' : 'B';
    }
  }

  return { variantA, variantB, winner };
}

interface VariantStats {
  sampleSize: number;
  successRate: number;
  avgSatisfactionScore: number;
  avgResponseTimeMs: number;
  toolSuccessRate: number;
}

function createEmptyStats(): VariantStats {
  return {
    sampleSize: 0,
    successRate: 0,
    avgSatisfactionScore: 0,
    avgResponseTimeMs: 0,
    toolSuccessRate: 0,
  };
}

function calculateStats(data: Array<{
  success?: boolean;
  user_satisfaction_score?: number;
  response_time_ms?: number;
  tools_executed?: number;
  tools_succeeded?: number;
}>): VariantStats {
  if (data.length === 0) {
    return createEmptyStats();
  }

  const sampleSize = data.length;
  const successCount = data.filter(d => d.success).length;
  const successRate = successCount / sampleSize;

  const satisfactionScores = data.filter(d => d.user_satisfaction_score != null).map(d => d.user_satisfaction_score as number);
  const avgSatisfactionScore = satisfactionScores.length > 0
    ? satisfactionScores.reduce((a: number, b: number) => a + b, 0) / satisfactionScores.length
    : 0;

  const responseTimes = data.filter(d => d.response_time_ms != null).map(d => d.response_time_ms as number);
  const avgResponseTimeMs = responseTimes.length > 0
    ? responseTimes.reduce((a: number, b: number) => a + b, 0) / responseTimes.length
    : 0;

  const totalToolsExecuted = data.reduce((sum, d) => sum + (d.tools_executed || 0), 0);
  const totalToolsSucceeded = data.reduce((sum, d) => sum + (d.tools_succeeded || 0), 0);
  const toolSuccessRate = totalToolsExecuted > 0 ? totalToolsSucceeded / totalToolsExecuted : 0;

  return {
    sampleSize,
    successRate,
    avgSatisfactionScore,
    avgResponseTimeMs,
    toolSuccessRate,
  };
}

// =====================================================================
// HELPERS
// =====================================================================

function toAiAgentSystemInstruction(row: AiAgentSystemInstructionRow): AiAgentSystemInstruction {
  return {
    id: row.id,
    agentId: row.agent_id,
    code: row.code,
    title: row.title ?? undefined,
    instructions: row.instructions,
    guardrails: row.guardrails ?? undefined,
    memoryStrategy: row.memory_strategy ?? undefined,
    isActive: row.is_active,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}
