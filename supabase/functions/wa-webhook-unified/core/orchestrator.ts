/**
 * Unified Agent Orchestrator
 * 
 * Central routing and session management for all domain agents.
 * Handles:
 * - Session lifecycle (create, load, save)
 * - Intent classification (keyword + LLM hybrid)
 * - Agent registry and routing
 * - Agent handoff coordination
 * - Response formatting and sending
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  WhatsAppMessage,
  UnifiedSession,
  AgentType,
  ClassifiedIntent,
  AgentResponse,
} from "./types.ts";
import { IntentClassifier } from "./intent-classifier.ts";
import { SessionManager } from "./session-manager.ts";
import { AgentRegistry } from "../agents/registry.ts";
import { sendWhatsAppMessage } from "../../_shared/whatsapp-api.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";
import { resolveUnifiedLocation } from "./location-handler.ts";

export class UnifiedOrchestrator {
  private sessionManager: SessionManager;
  private intentClassifier: IntentClassifier;
  private agentRegistry: AgentRegistry;

  constructor(private supabase: SupabaseClient) {
    this.sessionManager = new SessionManager(supabase);
    this.intentClassifier = new IntentClassifier(supabase);
    this.agentRegistry = new AgentRegistry(supabase);
  }

  /**
   * Main entry point: Process incoming WhatsApp message
   * Returns the agent's response text for synchronous callers (e.g., admin panel)
   */
  async processMessage(
    message: WhatsAppMessage,
    correlationId: string,
    options: { skipSend?: boolean } = {}
  ): Promise<{ responseText: string; agentType: AgentType }> {
    await logStructuredEvent("ORCHESTRATOR_PROCESSING", {
      correlationId,
      from: message.from,
      messageType: message.type,
    });

    try {
      // 1. Load or create session
      let session = await this.sessionManager.getOrCreateSession(message.from);

      // 2. Resolve location (cache → saved → prompt)
      const locationResult = await resolveUnifiedLocation(
        this.supabase,
        message.from,
        message.location
      );

      // Update session with resolved location
      if (locationResult.location) {
        session.location = {
          latitude: locationResult.location.lat,
          longitude: locationResult.location.lng,
        };
      }

      // 3. Determine which agent should handle this message
      const agentType = await this.determineAgent(session, message, correlationId);

      // Update session with current agent if changed
      if (session.currentAgent !== agentType) {
        await logStructuredEvent("ORCHESTRATOR_AGENT_SWITCH", {
          correlationId,
          from: session.currentAgent,
          to: agentType,
        });
        session.currentAgent = agentType;
      }

      // 3. Get the appropriate agent
      const agent = this.agentRegistry.getAgent(agentType, correlationId);

      // 4. Process message with agent
      const response = await agent.process(message, session);
      let finalResponse = response;
      let finalAgentType = agentType;

      // 5. Handle agent handoff if requested
      if (response.handoffTo) {
        await logStructuredEvent("ORCHESTRATOR_HANDOFF", {
          correlationId,
          from: agentType,
          to: response.handoffTo,
          reason: response.handoffReason,
        });

        // Update session with new agent
        session.currentAgent = response.handoffTo;
        session.activeFlow = undefined;
        session.flowStep = undefined;
        session.collectedData = {};

        // Save session before handoff
        await this.sessionManager.saveSession(session);

        // Process again with new agent
        const newAgent = this.agentRegistry.getAgent(response.handoffTo, correlationId);
        const handoffResponse = await newAgent.process(message, session);
        finalResponse = handoffResponse;
        finalAgentType = response.handoffTo;

        // Send handoff response (unless skipped)
        if (!options.skipSend) {
          await this.sendResponse(message.from, handoffResponse, correlationId);
        }
      } else {
        // Send response (unless skipped)
        if (!options.skipSend) {
          await this.sendResponse(message.from, response, correlationId);
        }
      }

      // 6. Save updated session
      await this.sessionManager.saveSession(session);

      await logStructuredEvent("ORCHESTRATOR_COMPLETED", {
        correlationId,
        agentType: finalAgentType,
        flowActive: !!session.activeFlow,
      });

      // Return response text for synchronous callers
      return {
        responseText: finalResponse.text,
        agentType: finalAgentType,
      };
    } catch (error) {
      await logStructuredEvent("ORCHESTRATOR_ERROR", {
        correlationId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      }, "error");

      // Send error message to user (unless skipped)
      if (!options.skipSend) {
        await sendWhatsAppMessage(message.from, {
          text: "Sorry, I encountered an error processing your request. Please try again.",
        });
      }

      throw error;
    }
  }

  /**
   * Determine which agent should handle this message
   */
  private async determineAgent(
    session: UnifiedSession,
    message: WhatsAppMessage,
    correlationId: string
  ): Promise<AgentType> {
    // If user has an active flow, continue with current agent
    if (session.activeFlow && session.currentAgent) {
      await logStructuredEvent("ORCHESTRATOR_CONTINUE_FLOW", {
        correlationId,
        agent: session.currentAgent,
        flow: session.activeFlow,
        step: session.flowStep,
      });
      return session.currentAgent;
    }

    // If session has a current agent and recent activity, continue with it
    const lastMessageTime = new Date(session.lastMessageAt).getTime();
    const now = Date.now();
    const timeSinceLastMessage = now - lastMessageTime;
    const CONTEXT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

    if (
      session.currentAgent &&
      timeSinceLastMessage < CONTEXT_WINDOW_MS &&
      session.conversationHistory.length > 0
    ) {
      await logStructuredEvent("ORCHESTRATOR_CONTINUE_CONTEXT", {
        correlationId,
        agent: session.currentAgent,
        timeSinceLastMs: timeSinceLastMessage,
      });
      return session.currentAgent;
    }

    // Otherwise, classify intent to determine agent
    const classification = await this.intentClassifier.classify(
      message.body,
      session.conversationHistory
    );

    await logStructuredEvent("ORCHESTRATOR_INTENT_CLASSIFIED", {
      correlationId,
      agentType: classification.agentType,
      confidence: classification.confidence,
      reason: classification.reason,
    });

    return classification.agentType;
  }

  /**
   * Send response to user via WhatsApp
   */
  private async sendResponse(
    userPhone: string,
    response: AgentResponse,
    correlationId: string
  ): Promise<void> {
    try {
      if (response.interactiveList) {
        // Send interactive list message
        await sendWhatsAppMessage(userPhone, {
          interactiveList: response.interactiveList,
          text: response.text,
        });
      } else if (response.interactiveButtons) {
        // Send interactive buttons message
        await sendWhatsAppMessage(userPhone, {
          interactiveButtons: response.interactiveButtons,
          text: response.text,
        });
      } else {
        // Send text message
        await sendWhatsAppMessage(userPhone, {
          text: response.text,
        });
      }

      await logStructuredEvent("ORCHESTRATOR_RESPONSE_SENT", {
        correlationId,
        hasInteractive: !!(response.interactiveList || response.interactiveButtons),
      });
    } catch (error) {
      await logStructuredEvent("ORCHESTRATOR_SEND_ERROR", {
        correlationId,
        error: error instanceof Error ? error.message : String(error),
      }, "error");
      throw error;
    }
  }
}
