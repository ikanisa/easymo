/**
 * Real Estate AI Agent - Unified Implementation Wrapper
 * 
 * This is a thin wrapper around the unified RealEstateAgent from packages/agents.
 * Provides Deno-compatible interface while using the consolidated implementation.
 * 
 * @deprecated This wrapper exists for backwards compatibility during migration.
 * Direct usage of the unified agent is preferred.
 */

import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js";

// Note: In a production Deno environment, we would import from the unified package.
// For now, we re-export the essential types and provide a compatibility layer.

/**
 * Temporary compatibility wrapper for the Real Estate agent.
 * 
 * TODO: Once the unified agent is published as a Deno-compatible module,
 * replace this with a direct import:
 * ```ts
 * export { RealEstateAgent } from "@easymo/agents/property";
 * ```
 * 
 * For now, consumers should use the wa-webhook-property edge function
 * which properly integrates with the unified agent architecture.
 */
export class RealEstateAgent {
  private supabase: SupabaseClient;
  
  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    console.warn(
      '[RealEstateAgent] This is a compatibility shim. ' +
      'Consider using wa-webhook-property edge function instead.'
    );
  }
  
  /**
   * Execute agent query
   * 
   * @deprecated Use wa-webhook-property edge function for production
   */
  async execute(query: string, context: any): Promise<any> {
    // This is a stub that redirects to the proper implementation
    throw new Error(
      'Direct RealEstateAgent execution not supported in this context. ' +
      'Use wa-webhook-property edge function instead.'
    );
  }
}

/**
 * Note for developers:
 * 
 * The unified Real Estate agent implementation is located at:
 * packages/agents/src/agents/property/real-estate.agent.ts
 * 
 * For WhatsApp integration, use:
 * supabase/functions/wa-webhook-property/
 * 
 * This file serves as a placeholder during the consolidation migration.
 */
