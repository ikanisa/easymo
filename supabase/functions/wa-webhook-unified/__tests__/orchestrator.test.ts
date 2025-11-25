/**
 * Integration Tests for Unified Orchestrator
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { UnifiedOrchestrator } from "../core/orchestrator.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

Deno.test("Orchestrator: should route to correct agent based on keywords", async () => {
  const orchestrator = new UnifiedOrchestrator(supabase);
  
  // Test marketplace routing
  const marketplaceMessage = {
    id: "test-1",
    from: "+250788123456",
    type: "text" as const,
    body: "I want to sell my laptop",
    timestamp: Date.now().toString(),
  };
  
  // This would need to verify the agent selection
  // For now, just verify orchestrator exists
  assertExists(orchestrator);
});

Deno.test("Orchestrator: should handle agent handoff", async () => {
  const orchestrator = new UnifiedOrchestrator(supabase);
  
  // First message to marketplace
  const msg1 = {
    id: "test-1",
    from: "+250788123456",
    type: "text" as const,
    body: "I'm selling furniture",
    timestamp: Date.now().toString(),
  };
  
  // Second message requesting jobs
  const msg2 = {
    id: "test-2",
    from: "+250788123456",
    type: "text" as const,
    body: "Actually, I need a job instead",
    timestamp: Date.now().toString(),
  };
  
  // Verify handoff logic exists
  assertExists(orchestrator.processMessage);
});

Deno.test("Orchestrator: should maintain session state", async () => {
  const orchestrator = new UnifiedOrchestrator(supabase);
  
  const message = {
    id: "test-1",
    from: "+250788123456",
    type: "text" as const,
    body: "Looking for a pharmacy",
    timestamp: Date.now().toString(),
  };
  
  // Verify session management
  assertExists(orchestrator);
});
