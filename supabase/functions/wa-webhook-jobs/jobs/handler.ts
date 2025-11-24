// =====================================================
// Jobs Domain Handler
// =====================================================
// Routes job-related WhatsApp messages to Job Board AI Agent
// =====================================================

import { JobHandlerContext, JobHandlerResponse } from "./types.ts";
import { detectJobIntent, shouldRouteToJobAgent } from "./utils.ts";
import { logStructuredEvent } from "../../observe/logger.ts";

const JOB_AGENT_URL = Deno.env.get("SUPABASE_URL") + "/functions/v1/job-board-ai-agent";

export async function handleJobDomain(
  context: JobHandlerContext
): Promise<JobHandlerResponse> {
  const correlationId = crypto.randomUUID();
  
  try {
    const { phoneNumber, message } = context;
    
    // Detect intent
    const intent = detectJobIntent(message);
    
    await logStructuredEvent("JOB_DOMAIN_REQUEST", {
      phoneNumber,
      intent: intent.type,
      confidence: intent.confidence,
      correlationId
    });
    
    // Route to AI agent if high confidence
    if (shouldRouteToJobAgent(message)) {
      const response = await fetch(JOB_AGENT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          "x-correlation-id": correlationId
        },
        body: JSON.stringify({
          phone_number: phoneNumber,
          message,
          conversation_history: context.conversationHistory || []
        })
      });
      
      if (!response.ok) {
        throw new Error(`Job agent error: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      return {
        success: true,
        reply: data.message || "Job board is processing your request...",
        data: {
          tool_calls: data.tool_calls,
          conversation_id: data.conversation_id
        }
      };
    }
    
    // Fallback: Return help message
    return {
      success: true,
      reply: getHelpMessage(),
      nextAction: "show_job_menu"
    };
    
  } catch (error: any) {
    await logStructuredEvent("ERROR", {
      event: "JOB_DOMAIN_ERROR",
      error: error.message,
      correlationId
    });
    
    return {
      success: false,
      reply: "Sorry, I'm having trouble with the job board right now. Please try again in a moment."
    };
  }
}

function getHelpMessage(): string {
  return `🔧 *EasyMO Job Board*

I can help you with:

*📝 Post a Job:*
Say something like:
• "I need someone to help move furniture tomorrow"
• "Hiring delivery driver with motorcycle"
• "Need construction worker for 3 days"

*🔍 Find Work:*
Tell me about your skills:
• "Looking for delivery work, I have a motorcycle"
• "Need part-time cleaning jobs"
• "Can do construction, available weekdays"

*📋 Manage:*
• "Show my jobs" - See jobs you've posted
• "My applications" - See jobs you've applied to

Just describe what you need in natural language, I'll handle the rest! 💼`;
}

export function isJobDomainMessage(message: string): boolean {
  return shouldRouteToJobAgent(message);
}
