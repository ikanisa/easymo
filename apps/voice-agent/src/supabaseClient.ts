import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { logger } from "./logger.js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

let supabaseClient: SupabaseClient | null = null;

/**
 * Get or create Supabase client instance.
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return supabaseClient;
}

/**
 * Persist a call event to Supabase.
 * 
 * Events are stored in the 'call_events' table with the following structure:
 * - call_sid: Twilio call identifier
 * - event_type: Type of event (start, stop, transcript, tool_call, error)
 * - payload: JSON payload with event-specific data
 * - created_at: Timestamp
 */
export async function persistCallEvent(
  callSid: string,
  eventType: string,
  payload: Record<string, any>,
): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    
    const { error } = await supabase.from("call_events").insert({
      call_sid: callSid,
      event_type: eventType,
      payload,
      created_at: new Date().toISOString(),
    });

    if (error) {
      logger.error({
        msg: "supabase.call_event.error",
        callSid,
        eventType,
        error: error.message,
      });
    } else {
      logger.debug({
        msg: "supabase.call_event.persisted",
        callSid,
        eventType,
      });
    }
  } catch (error) {
    logger.error({
      msg: "supabase.call_event.exception",
      callSid,
      eventType,
      error: (error as Error).message,
    });
  }
}

/**
 * Create or update a call record in Supabase.
 */
export async function upsertCall(
  callSid: string,
  data: {
    from_number?: string;
    to_number?: string;
    direction?: string;
    status?: string;
    transcript?: string;
    intent?: string;
    meta?: Record<string, any>;
  },
): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from("calls")
      .upsert(
        {
          call_sid: callSid,
          ...data,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "call_sid",
        },
      );

    if (error) {
      logger.error({
        msg: "supabase.call.upsert_error",
        callSid,
        error: error.message,
      });
    }
  } catch (error) {
    logger.error({
      msg: "supabase.call.upsert_exception",
      callSid,
      error: (error as Error).message,
    });
  }
}

/**
 * Get member balance from Supabase.
 * Used by MCP tool.
 */
export async function getMemberBalance(memberId: string): Promise<number | null> {
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from("savings")
      .select("balance")
      .eq("member_id", memberId)
      .single();

    if (error) {
      logger.error({
        msg: "supabase.member_balance.error",
        memberId,
        error: error.message,
      });
      return null;
    }

    return data?.balance ?? null;
  } catch (error) {
    logger.error({
      msg: "supabase.member_balance.exception",
      memberId,
      error: (error as Error).message,
    });
    return null;
  }
}

/**
 * Redeem a voucher in Supabase.
 * Used by MCP tool.
 */
export async function redeemVoucher(
  code: string,
): Promise<{ success: boolean; voucher?: any; error?: string }> {
  try {
    const supabase = getSupabaseClient();
    
    // First, check if voucher exists and is valid
    const { data: voucher, error: fetchError } = await supabase
      .from("vouchers")
      .select("*")
      .eq("code", code)
      .eq("status", "active")
      .single();

    if (fetchError || !voucher) {
      return {
        success: false,
        error: "Voucher not found or already redeemed",
      };
    }

    // Update voucher status
    const { error: updateError } = await supabase
      .from("vouchers")
      .update({
        status: "redeemed",
        redeemed_at: new Date().toISOString(),
      })
      .eq("code", code);

    if (updateError) {
      logger.error({
        msg: "supabase.voucher.redeem_error",
        code,
        error: updateError.message,
      });
      return {
        success: false,
        error: updateError.message,
      };
    }

    logger.info({
      msg: "supabase.voucher.redeemed",
      code,
      voucherId: voucher.id,
    });

    return {
      success: true,
      voucher,
    };
  } catch (error) {
    logger.error({
      msg: "supabase.voucher.redeem_exception",
      code,
      error: (error as Error).message,
    });
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}
