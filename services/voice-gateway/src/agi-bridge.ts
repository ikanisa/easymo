/**
 * AGI Bridge for Voice Gateway
 * 
 * Connects OpenAI Realtime API to Call Center AGI tools
 * Executes tool calls during real-time voice conversations
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

import { config } from './config';
import { logger } from './logger';

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface ToolResult {
  id: string;
  result: any;
  error?: string;
}

/**
 * Bridge between OpenAI Realtime and AGI Tools
 */
export class AGIBridge {
  private supabase: SupabaseClient;
  private callId: string;
  private userId?: string;

  constructor(callId: string, userId?: string) {
    this.callId = callId;
    this.userId = userId;
    
    this.supabase = createClient(
      config.SUPABASE_URL,
      config.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );
  }

  /**
   * Execute a tool call from OpenAI Realtime
   */
  async executeTool(toolCall: ToolCall): Promise<ToolResult> {
    const startTime = Date.now();
    
    logger.info({
      callId: this.callId,
      toolCallId: toolCall.id,
      toolName: toolCall.name,
      msg: 'agi_bridge.tool_execution_started',
    });

    try {
      // Call the appropriate AGI tool via Supabase function
      const result = await this.callAGITool(toolCall.name, toolCall.arguments);
      
      const duration = Date.now() - startTime;
      
      logger.info({
        callId: this.callId,
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        duration,
        msg: 'agi_bridge.tool_execution_success',
      });

      // Log tool execution in database
      await this.logToolExecution(toolCall, result, duration);

      return {
        id: toolCall.id,
        result,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error({
        callId: this.callId,
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        error: errorMessage,
        duration,
        msg: 'agi_bridge.tool_execution_error',
      });

      return {
        id: toolCall.id,
        result: null,
        error: errorMessage,
      };
    }
  }

  /**
   * Call an AGI tool via the Call Center AGI function
   */
  private async callAGITool(toolName: string, args: Record<string, any>): Promise<any> {
    // Handle request recording tools locally (don't need AGI function)
    if (toolName === 'create_property_request') {
      return await this.createPropertyRequest(args);
    }
    if (toolName === 'create_ride_request') {
      return await this.createRideRequest(args);
    }
    if (toolName === 'create_inquiry') {
      return await this.createInquiry(args);
    }

    // Map Realtime tool names to AGI tool names
    const toolMap: Record<string, string> = {
      'get_profile': 'get_or_create_profile',
      'schedule_ride': 'rides_schedule_trip',
      'check_ride_status': 'rides_check_trip',
      'cancel_ride': 'rides_cancel_trip',
      'get_nearby_drivers': 'rides_get_nearby_drivers',
      'search_vehicles': 'marketplace_search_vehicles',
      'get_vehicle_details': 'marketplace_get_vehicle_details',
      'create_insurance_quote': 'insurance_create_quote',
      'search_properties': 'real_estate_search_properties',
      // Add more mappings as needed
    };

    const agiToolName = toolMap[toolName] || toolName;

    // Execute via wa-agent-call-center function
    const response = await fetch(`${config.SUPABASE_URL}/functions/v1/wa-agent-call-center/tools/${agiToolName}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'X-Call-ID': this.callId,
        'X-User-ID': this.userId || '',
      },
      body: JSON.stringify(args),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`AGI tool execution failed: ${error}`);
    }

    return await response.json();
  }

  /**
   * Record a property request for the property team to handle
   */
  private async createPropertyRequest(args: Record<string, any>): Promise<any> {
    const { data, error } = await this.supabase
      .from('property_requests')
      .insert({
        request_type: args.request_type,
        property_type: args.property_type,
        location: args.location,
        country: args.country,
        bedrooms: args.bedrooms,
        budget_min: args.budget_min,
        budget_max: args.budget_max,
        currency: args.currency,
        move_in_date: args.move_in_date,
        furnished: args.furnished,
        special_requirements: args.special_requirements,
        contact_phone: args.contact_phone,
        contact_email: args.contact_email,
        status: 'pending',
        source: 'voice_call',
        call_id: this.callId,
        user_id: this.userId,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      request_id: data.id,
      message: `Property request recorded. ID: ${data.id}. The property team will contact you within 2 hours.`,
    };
  }

  /**
   * Record a ride request
   */
  private async createRideRequest(args: Record<string, any>): Promise<any> {
    const { data, error } = await this.supabase
      .from('ride_requests')
      .insert({
        pickup_location: args.pickup_location,
        dropoff_location: args.dropoff_location,
        vehicle_type: args.vehicle_type,
        passengers: args.passengers,
        luggage: args.luggage,
        schedule_time: args.schedule_time,
        flight_time: args.flight_time,
        special_requirements: args.special_requirements,
        contact_phone: args.contact_phone,
        status: 'pending',
        source: 'voice_call',
        call_id: this.callId,
        user_id: this.userId,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      request_id: data.id,
      message: `Ride request recorded. ID: ${data.id}. A driver will be assigned shortly.`,
    };
  }

  /**
   * Record a general inquiry
   */
  private async createInquiry(args: Record<string, any>): Promise<any> {
    const { data, error } = await this.supabase
      .from('inquiries')
      .insert({
        inquiry_type: args.inquiry_type,
        description: args.description,
        urgency: args.urgency,
        preferred_contact_method: args.preferred_contact_method,
        contact_phone: args.contact_phone,
        contact_email: args.contact_email,
        best_time_to_call: args.best_time_to_call,
        status: 'pending',
        source: 'voice_call',
        call_id: this.callId,
        user_id: this.userId,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      inquiry_id: data.id,
      message: `Inquiry recorded. ID: ${data.id}. Our team will follow up with you soon.`,
    };
  }

  /**
   * Log tool execution in database for analytics
   */
  private async logToolExecution(
    toolCall: ToolCall,
    result: any,
    duration: number
  ): Promise<void> {
    try {
      await this.supabase.from('ai_tool_executions').insert({
        agent_id: 'call_center',
        tool_name: toolCall.name,
        input_params: toolCall.arguments,
        output_result: result,
        execution_time_ms: duration,
        status: result ? 'success' : 'error',
        call_id: this.callId,
        user_id: this.userId,
        metadata: {
          tool_call_id: toolCall.id,
          source: 'realtime_api',
        },
      });
    } catch (error) {
      logger.error({
        callId: this.callId,
        error,
        msg: 'agi_bridge.log_execution_failed',
      });
    }
  }

  /**
   * Get user context for the call
   */
  async getUserContext(): Promise<Record<string, any>> {
    if (!this.userId) {
      return {};
    }

    try {
      const { data: profile } = await this.supabase
        .from('profiles')
        .select('*')
        .eq('id', this.userId)
        .single();

      return profile || {};
    } catch {
      return {};
    }
  }

  /**
   * Update user context during the call
   */
  async updateUserContext(updates: Record<string, any>): Promise<void> {
    if (!this.userId) {
      return;
    }

    try {
      await this.supabase
        .from('profiles')
        .update(updates)
        .eq('id', this.userId);
    } catch (error) {
      logger.error({
        callId: this.callId,
        error,
        msg: 'agi_bridge.update_context_failed',
      });
    }
  }
}
