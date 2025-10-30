/**
 * Realtime API SIP Session Handler
 * Manages WebRTC/SIP sessions with OpenAI Realtime API for voice calls
 */

/**
 * Session instructions for voice agent
 */
export const VOICE_AGENT_INSTRUCTIONS = `You are the EasyMO Voice Agent for fuel voucher assistance.

Your role:
- Help customers with voucher operations over phone calls
- Speak clearly and naturally in the customer's language (English, French, or Kinyarwanda)
- Use tools to perform database operations
- Keep responses concise and conversational

Guidelines:
- Greet the customer warmly
- Ask clarifying questions if needed
- Confirm important information (amounts, phone numbers) by repeating them back
- After completing an action, summarize what was done
- End calls politely and ask if there's anything else you can help with

Available tools:
- lookup_customer: Find customer by phone number
- create_voucher: Create a new voucher for a customer

Security:
- Never share full system IDs or internal details
- Mask phone numbers when reading them back (e.g., "ending in 1234")
- Always confirm identity before sensitive operations`;

/**
 * Tool specifications for Realtime API
 */
export const REALTIME_TOOLS = [
  {
    type: "function" as const,
    name: "lookup_customer",
    description: "Find customer by mobile number to check if they exist in the system",
    parameters: {
      type: "object",
      properties: {
        msisdn: {
          type: "string",
          description: "Customer mobile number in E.164 format (e.g., +250788000000)",
        },
      },
      required: ["msisdn"],
    },
  },
  {
    type: "function" as const,
    name: "create_voucher",
    description: "Create a new fuel voucher for a customer with specified amount",
    parameters: {
      type: "object",
      properties: {
        customer_msisdn: {
          type: "string",
          description: "Customer mobile number in E.164 format",
        },
        amount: {
          type: "number",
          description: "Voucher amount in Rwandan Francs (RWF)",
        },
        currency: {
          type: "string",
          description: "Currency code (default: RWF)",
          default: "RWF",
        },
      },
      required: ["customer_msisdn", "amount"],
    },
  },
];

/**
 * Session configuration
 */
export interface RealtimeSessionConfig {
  model: string;
  voice: string;
  instructions: string;
  tools: typeof REALTIME_TOOLS;
  turnDetection?: {
    type: string;
    threshold?: number;
    prefix_padding_ms?: number;
    silence_duration_ms?: number;
  };
}

/**
 * Get default session configuration
 */
export function getDefaultSessionConfig(): RealtimeSessionConfig {
  return {
    model: process.env.OPENAI_REALTIME_MODEL || "gpt-4o-realtime-preview",
    voice: "alloy", // Can be: alloy, echo, shimmer
    instructions: VOICE_AGENT_INSTRUCTIONS,
    tools: REALTIME_TOOLS,
    turnDetection: {
      type: "server_vad", // Voice Activity Detection
      threshold: 0.5,
      prefix_padding_ms: 300,
      silence_duration_ms: 500,
    },
  };
}

/**
 * Create a Realtime API session with SDP offer
 * 
 * NOTE: This is a placeholder implementation.
 * The actual OpenAI Realtime API uses WebSocket connections, not HTTP POST.
 * Production implementation should:
 * 1. Establish WebSocket connection to wss://api.openai.com/v1/realtime
 * 2. Send session.update event with config
 * 3. Handle SDP offer/answer via WebRTC signaling
 * 4. Process real-time audio streams
 * 
 * See: https://platform.openai.com/docs/guides/realtime
 */
export async function createRealtimeSession(
  sdpOffer: string,
  correlationId: string
): Promise<{ sdpAnswer: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OpenAI API key not configured");
  }

  const config = getDefaultSessionConfig();

  console.log(
    JSON.stringify({
      event: "ai.realtime.session.create",
      correlation_id: correlationId,
      model: config.model,
      timestamp: new Date().toISOString(),
    })
  );

  // Placeholder: Return error indicating WebSocket implementation needed
  throw new Error(
    "Realtime API requires WebSocket implementation. " +
    "This is a placeholder for HTTP-based SDP exchange. " +
    "Use WebSocket connection to wss://api.openai.com/v1/realtime instead."
  );
}

/**
 * Handle Realtime API events
 */
export interface RealtimeEvent {
  type: string;
  event_id?: string;
  [key: string]: any;
}

/**
 * Process Realtime API event
 */
export function processRealtimeEvent(
  event: RealtimeEvent,
  correlationId: string
): void {
  console.log(
    JSON.stringify({
      event: "ai.realtime.event",
      correlation_id: correlationId,
      event_type: event.type,
      event_id: event.event_id,
      timestamp: new Date().toISOString(),
    })
  );

  // Handle different event types
  switch (event.type) {
    case "session.created":
      console.log("Realtime session created");
      break;
    case "conversation.item.created":
      console.log("Conversation item created");
      break;
    case "response.audio.delta":
      // Audio chunk received
      break;
    case "response.audio.done":
      console.log("Audio response complete");
      break;
    case "response.function_call_arguments.delta":
      // Tool call in progress
      break;
    case "response.function_call_arguments.done":
      console.log("Tool call complete");
      break;
    default:
      console.log(`Unhandled event type: ${event.type}`);
  }
}
