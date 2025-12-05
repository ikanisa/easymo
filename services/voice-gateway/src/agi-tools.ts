/**
 * AGI Function Definitions for OpenAI Realtime API
 * 
 * These tool definitions are sent to OpenAI Realtime API to enable
 * function calling during voice conversations. They mirror the
 * Call Center AGI tools in the Supabase edge function.
 */

import { config } from './config';
import { logger } from './logger';

/**
 * OpenAI Realtime Tool Definition
 */
export interface RealtimeToolDefinition {
  type: 'function';
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
      default?: unknown;
      items?: { type: string };
    }>;
    required?: string[];
  };
}

/**
 * Tool execution context passed to tool handlers
 */
export interface ToolExecutionContext {
  callId: string;
  fromNumber: string;
  userId?: string;
  language?: string;
  supabaseUrl: string;
  supabaseKey: string;
}

/**
 * Tool execution result
 */
export interface ToolExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  message?: string;
}

/**
 * AGI Tools for Call Center
 * 
 * These are the function definitions that OpenAI Realtime API can call.
 * Each tool maps to a capability in the Call Center AGI system.
 */
export const AGI_TOOL_DEFINITIONS: RealtimeToolDefinition[] = [
  // =========================================================================
  // IDENTITY & PROFILES
  // =========================================================================
  {
    type: 'function',
    name: 'get_or_create_profile',
    description: 'Get or create a user profile by phone number. Use this at the start of calls to identify the caller.',
    parameters: {
      type: 'object',
      properties: {
        phone_number: {
          type: 'string',
          description: 'Phone number in E.164 format (e.g., +250788123456)',
        },
      },
      required: ['phone_number'],
    },
  },
  {
    type: 'function',
    name: 'update_profile',
    description: 'Update user profile information like name or preferred language.',
    parameters: {
      type: 'object',
      properties: {
        profile_id: {
          type: 'string',
          description: 'Profile UUID',
        },
        name: {
          type: 'string',
          description: 'User full name',
        },
        preferred_language: {
          type: 'string',
          description: 'Preferred language code',
          enum: ['en', 'rw', 'fr', 'sw'],
        },
      },
      required: ['profile_id'],
    },
  },

  // =========================================================================
  // KNOWLEDGE BASE
  // =========================================================================
  {
    type: 'function',
    name: 'search_knowledge_base',
    description: 'Search the EasyMO knowledge base for information about services, FAQs, and how-to guides.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query in natural language',
        },
        top_k: {
          type: 'number',
          description: 'Number of results to return (default: 5)',
          default: 5,
        },
      },
      required: ['query'],
    },
  },

  // =========================================================================
  // AGENT DISPATCH
  // =========================================================================
  {
    type: 'function',
    name: 'run_specialized_agent',
    description: 'Call a specialized AI agent for complex domain-specific queries. Use when the user needs deep expertise in a specific area.',
    parameters: {
      type: 'object',
      properties: {
        agent_id: {
          type: 'string',
          description: 'ID of the specialist agent to consult',
          enum: [
            'real-estate-rentals',
            'rides-matching',
            'jobs-marketplace',
            'waiter-restaurants',
            'insurance-broker',
            'farmers-market',
          ],
        },
        intent: {
          type: 'string',
          description: 'What the user wants to accomplish',
        },
        parameters: {
          type: 'object',
          description: 'Additional context parameters for the agent',
        },
      },
      required: ['agent_id', 'intent'],
    },
  },

  // =========================================================================
  // RIDES & MOBILITY
  // =========================================================================
  {
    type: 'function',
    name: 'book_ride',
    description: 'Book a ride or schedule transportation. Ask for pickup, destination, and preferred time.',
    parameters: {
      type: 'object',
      properties: {
        pickup_location: {
          type: 'string',
          description: 'Pickup address or landmark',
        },
        dropoff_location: {
          type: 'string',
          description: 'Destination address or landmark',
        },
        scheduled_time: {
          type: 'string',
          description: 'ISO 8601 datetime for scheduled pickup (optional for immediate rides)',
        },
        vehicle_type: {
          type: 'string',
          description: 'Type of vehicle requested',
          enum: ['moto', 'car', 'bus', 'any'],
        },
        passengers: {
          type: 'number',
          description: 'Number of passengers',
          default: 1,
        },
      },
      required: ['pickup_location', 'dropoff_location'],
    },
  },
  {
    type: 'function',
    name: 'add_vehicle',
    description: 'Register a vehicle for a driver. Used when drivers want to add their vehicle to the platform.',
    parameters: {
      type: 'object',
      properties: {
        profile_id: {
          type: 'string',
          description: 'Driver profile ID',
        },
        vehicle_type: {
          type: 'string',
          description: 'Type of vehicle',
          enum: ['moto', 'car', 'bus', 'truck'],
        },
        plate_number: {
          type: 'string',
          description: 'Vehicle plate number',
        },
        make: {
          type: 'string',
          description: 'Vehicle make/brand',
        },
        model: {
          type: 'string',
          description: 'Vehicle model',
        },
        year: {
          type: 'number',
          description: 'Vehicle year',
        },
      },
      required: ['profile_id', 'vehicle_type', 'plate_number'],
    },
  },

  // =========================================================================
  // REAL ESTATE
  // =========================================================================
  {
    type: 'function',
    name: 'search_properties',
    description: 'Search for rental or sale properties. Ask for location, budget, and requirements.',
    parameters: {
      type: 'object',
      properties: {
        city: {
          type: 'string',
          description: 'City to search in',
        },
        area: {
          type: 'string',
          description: 'Specific neighborhood or area',
        },
        listing_type: {
          type: 'string',
          description: 'Type of listing',
          enum: ['rent', 'sale'],
        },
        bedrooms: {
          type: 'number',
          description: 'Minimum number of bedrooms',
        },
        max_price: {
          type: 'number',
          description: 'Maximum price in RWF',
        },
      },
    },
  },
  {
    type: 'function',
    name: 'create_property_listing',
    description: 'Create a new property listing for rent or sale.',
    parameters: {
      type: 'object',
      properties: {
        profile_id: {
          type: 'string',
          description: 'Property owner profile ID',
        },
        listing_type: {
          type: 'string',
          enum: ['rent', 'sale'],
        },
        city: {
          type: 'string',
          description: 'Property city',
        },
        area: {
          type: 'string',
          description: 'Neighborhood or area name',
        },
        bedrooms: {
          type: 'number',
          description: 'Number of bedrooms',
        },
        price: {
          type: 'number',
          description: 'Price in RWF',
        },
        description: {
          type: 'string',
          description: 'Property description',
        },
      },
      required: ['profile_id', 'listing_type', 'city', 'price'],
    },
  },

  // =========================================================================
  // JOBS & EMPLOYMENT
  // =========================================================================
  {
    type: 'function',
    name: 'search_jobs',
    description: 'Search for job opportunities. Ask about skills, location, and job type preferences.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Job search query (skills, title, or keywords)',
        },
        location: {
          type: 'string',
          description: 'Job location',
        },
        job_type: {
          type: 'string',
          description: 'Type of employment',
          enum: ['full-time', 'part-time', 'contract', 'casual'],
        },
      },
    },
  },
  {
    type: 'function',
    name: 'register_job_seeker',
    description: 'Register a user as a job seeker. Capture their skills and job preferences.',
    parameters: {
      type: 'object',
      properties: {
        profile_id: {
          type: 'string',
          description: 'User profile ID',
        },
        skills: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of skills',
        },
        preferred_roles: {
          type: 'array',
          items: { type: 'string' },
          description: 'Preferred job titles/roles',
        },
        preferred_locations: {
          type: 'array',
          items: { type: 'string' },
          description: 'Preferred work locations',
        },
        experience_years: {
          type: 'number',
          description: 'Years of experience',
        },
      },
      required: ['profile_id', 'skills'],
    },
  },

  // =========================================================================
  // INSURANCE
  // =========================================================================
  {
    type: 'function',
    name: 'create_insurance_lead',
    description: 'Create an insurance inquiry lead. Capture the type of insurance needed and user notes.',
    parameters: {
      type: 'object',
      properties: {
        profile_id: {
          type: 'string',
          description: 'User profile ID',
        },
        insurance_type: {
          type: 'string',
          description: 'Type of insurance',
          enum: ['health', 'vehicle', 'property', 'life', 'business', 'other'],
        },
        notes: {
          type: 'string',
          description: 'Additional details about the insurance need',
        },
      },
      required: ['profile_id', 'insurance_type'],
    },
  },

  // =========================================================================
  // WALLET & PAYMENTS
  // =========================================================================
  {
    type: 'function',
    name: 'get_wallet_balance',
    description: 'Get the user wallet balance and recent transactions.',
    parameters: {
      type: 'object',
      properties: {
        profile_id: {
          type: 'string',
          description: 'User profile ID',
        },
      },
      required: ['profile_id'],
    },
  },
  {
    type: 'function',
    name: 'initiate_transfer',
    description: 'Initiate a token transfer to another user. Requires confirmation.',
    parameters: {
      type: 'object',
      properties: {
        from_profile_id: {
          type: 'string',
          description: 'Sender profile ID',
        },
        to_phone_number: {
          type: 'string',
          description: 'Recipient phone number',
        },
        amount: {
          type: 'number',
          description: 'Amount to transfer',
        },
      },
      required: ['from_profile_id', 'to_phone_number', 'amount'],
    },
  },
  {
    type: 'function',
    name: 'generate_payment_qr',
    description: 'Generate a QR code for receiving payment.',
    parameters: {
      type: 'object',
      properties: {
        profile_id: {
          type: 'string',
          description: 'User profile ID',
        },
        amount: {
          type: 'number',
          description: 'Amount in RWF',
        },
        purpose: {
          type: 'string',
          description: 'Payment purpose/description',
        },
      },
      required: ['profile_id', 'amount'],
    },
  },

  // =========================================================================
  // CALL MANAGEMENT
  // =========================================================================
  {
    type: 'function',
    name: 'transfer_to_human',
    description: 'Transfer the call to a human agent when AI cannot help.',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Why the transfer is needed',
        },
        department: {
          type: 'string',
          description: 'Target department',
          enum: ['support', 'sales', 'billing', 'technical'],
        },
        priority: {
          type: 'string',
          description: 'Call priority',
          enum: ['low', 'normal', 'high', 'urgent'],
        },
      },
      required: ['reason'],
    },
  },
  {
    type: 'function',
    name: 'log_call_summary',
    description: 'Log a summary of the call conversation. Call this before ending the call.',
    parameters: {
      type: 'object',
      properties: {
        call_id: {
          type: 'string',
          description: 'Call ID',
        },
        profile_id: {
          type: 'string',
          description: 'Caller profile ID',
        },
        primary_intent: {
          type: 'string',
          description: 'Main purpose of the call',
        },
        secondary_intents: {
          type: 'array',
          items: { type: 'string' },
          description: 'Other topics discussed',
        },
        summary: {
          type: 'string',
          description: 'Brief call summary',
        },
        outcome: {
          type: 'string',
          description: 'Call outcome',
          enum: ['resolved', 'transferred', 'callback_needed', 'no_action'],
        },
      },
      required: ['call_id', 'primary_intent', 'summary'],
    },
  },
];

/**
 * Execute a tool call by calling the appropriate Supabase edge function
 * 
 * @param toolName - Name of the tool to execute
 * @param args - Arguments passed to the tool
 * @param context - Execution context including call info
 */
export async function executeAGITool(
  toolName: string,
  args: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  logger.info({ tool: toolName, args, msg: 'agi_tool.executing' });

  try {
    // Map tool names to Supabase function endpoints
    const endpoint = getToolEndpoint(toolName);
    if (!endpoint) {
      return { success: false, error: `Unknown tool: ${toolName}` };
    }

    // Call the Supabase edge function
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${context.supabaseKey}`,
        'X-Call-ID': context.callId,
        'X-From-Number': context.fromNumber,
      },
      body: JSON.stringify({
        ...args,
        caller_context: {
          call_id: context.callId,
          from_number: context.fromNumber,
          user_id: context.userId,
          language: context.language,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({ tool: toolName, status: response.status, error: errorText, msg: 'agi_tool.http_error' });
      return { success: false, error: `Tool call failed: ${response.statusText}` };
    }

    const data = await response.json() as Record<string, unknown>;
    logger.info({ tool: toolName, success: true, msg: 'agi_tool.executed' });

    return { success: true, data, message: data.message as string | undefined };
  } catch (error) {
    logger.error({ tool: toolName, error, msg: 'agi_tool.execution_error' });
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Tool execution failed' 
    };
  }
}

/**
 * Get the Supabase edge function endpoint for a tool
 */
function getToolEndpoint(toolName: string): string | null {
  const baseUrl = config.AGI_SUPABASE_FUNCTIONS_URL;
  
  // Map tools to edge functions
  const toolEndpoints: Record<string, string> = {
    // Profile tools -> wa-agent-call-center
    get_or_create_profile: `${baseUrl}/wa-agent-call-center`,
    update_profile: `${baseUrl}/wa-agent-call-center`,
    
    // Knowledge base
    search_knowledge_base: `${baseUrl}/retrieval-search`,
    
    // Agent dispatch
    run_specialized_agent: `${baseUrl}/wa-agent-call-center`,
    
    // Rides
    book_ride: `${baseUrl}/wa-webhook-mobility`,
    add_vehicle: `${baseUrl}/wa-webhook-mobility`,
    
    // Real estate
    search_properties: `${baseUrl}/wa-webhook-property`,
    create_property_listing: `${baseUrl}/wa-webhook-property`,
    
    // Jobs
    search_jobs: `${baseUrl}/wa-webhook-jobs`,
    register_job_seeker: `${baseUrl}/wa-webhook-jobs`,
    
    // Insurance
    create_insurance_lead: `${baseUrl}/wa-webhook-insurance`,
    
    // Wallet
    get_wallet_balance: `${baseUrl}/wa-agent-call-center`,
    initiate_transfer: `${baseUrl}/wa-agent-call-center`,
    generate_payment_qr: `${baseUrl}/qr-resolve`,
    
    // Call management
    transfer_to_human: `${baseUrl}/wa-agent-call-center`,
    log_call_summary: `${baseUrl}/wa-agent-call-center`,
  };

  return toolEndpoints[toolName] || null;
}

/**
 * Format tool result for OpenAI Realtime API response
 */
export function formatToolResult(
  callId: string,
  result: ToolExecutionResult
): Record<string, unknown> {
  return {
    type: 'conversation.item.create',
    item: {
      type: 'function_call_output',
      call_id: callId,
      output: JSON.stringify(result.success ? result.data : { error: result.error }),
    },
  };
}
