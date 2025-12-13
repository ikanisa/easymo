/**
 * WhatsApp Broadcast Service
 * 
 * Frontend service for triggering WhatsApp broadcasts to vendors.
 * 
 * @see supabase/functions/whatsapp-broadcast
 */

export interface BusinessContact {
  businessName: string;
  businessPhone: string;
  tags?: string[];
  rating?: number;
}

export interface WhatsAppBroadcastPayload {
  requestId: string;
  userLocationLabel?: string;
  needDescription: string;
  vendorFilter?: {
    tags?: string[];
    minRating?: number;
    maxDistance?: number;
  };
}

export interface BroadcastResponse {
  success: boolean;
  requestId: string;
  sentCount: number;
  errorCount: number;
  totalVendors?: number;
  message?: string;
  error?: string;
  details?: string;
}

/**
 * Send WhatsApp broadcast to vendors
 * 
 * @param payload Broadcast configuration
 * @param apiKey API key for authentication
 * @returns Broadcast results
 */
export async function sendWhatsAppBroadcast(
  payload: WhatsAppBroadcastPayload,
  apiKey: string
): Promise<BroadcastResponse> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  
  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL not configured");
  }

  const functionUrl = `${supabaseUrl}/functions/v1/whatsapp-broadcast`;

  try {
    const response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "x-correlation-id": crypto.randomUUID()
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        requestId: payload.requestId,
        sentCount: 0,
        errorCount: 0,
        error: errorData.error || `HTTP ${response.status}`,
        details: errorData.details
      };
    }

    const result: BroadcastResponse = await response.json();
    return result;

  } catch (error) {
    return {
      success: false,
      requestId: payload.requestId,
      sentCount: 0,
      errorCount: 0,
      error: "Network error",
      details: (error as Error).message
    };
  }
}

/**
 * Get broadcast status
 * 
 * @param requestId Broadcast request ID
 * @param supabase Supabase client
 */
export async function getBroadcastStatus(
  requestId: string,
  supabase: any
): Promise<{
  status: string;
  sentCount: number;
  totalTargets: number;
  targets: Array<{
    businessName: string;
    status: string;
    createdAt: string;
  }>;
} | null> {
  try {
    // Get broadcast request
    const { data: broadcast } = await supabase
      .from("whatsapp_broadcast_requests")
      .select("*")
      .eq("request_id", requestId)
      .single();

    if (!broadcast) {
      return null;
    }

    // Get targets
    const { data: targets } = await supabase
      .from("whatsapp_broadcast_targets")
      .select("business_name, status, created_at")
      .eq("broadcast_id", broadcast.id)
      .order("created_at", { ascending: false });

    const sentCount = targets?.filter((t: any) => t.status === "sent" || t.status === "delivered").length || 0;

    return {
      status: broadcast.status,
      sentCount,
      totalTargets: targets?.length || 0,
      targets: targets?.map((t: any) => ({
        businessName: t.business_name,
        status: t.status,
        createdAt: t.created_at
      })) || []
    };

  } catch (error) {
    console.error("Failed to get broadcast status:", error);
    return null;
  }
}

/**
 * Get vendor replies for a broadcast
 * 
 * @param requestId Broadcast request ID
 * @param supabase Supabase client
 */
export async function getVendorReplies(
  requestId: string,
  supabase: any
): Promise<Array<{
  businessPhone: string;
  action: string | null;
  hasStock: boolean | null;
  rawBody: string;
  createdAt: string;
}>> {
  try {
    // Get broadcast
    const { data: broadcast } = await supabase
      .from("whatsapp_broadcast_requests")
      .select("id")
      .eq("request_id", requestId)
      .single();

    if (!broadcast) {
      return [];
    }

    // Get targets
    const { data: targets } = await supabase
      .from("whatsapp_broadcast_targets")
      .select("id, business_phone")
      .eq("broadcast_id", broadcast.id);

    if (!targets || targets.length === 0) {
      return [];
    }

    const phoneNumbers = targets.map((t: any) => t.business_phone);

    // Get replies
    const { data: replies } = await supabase
      .from("whatsapp_business_replies")
      .select("business_phone, action, has_stock, raw_body, created_at")
      .in("business_phone", phoneNumbers)
      .order("created_at", { ascending: false });

    return replies?.map((r: any) => ({
      businessPhone: r.business_phone,
      action: r.action,
      hasStock: r.has_stock,
      rawBody: r.raw_body,
      createdAt: r.created_at
    })) || [];

  } catch (error) {
    console.error("Failed to get vendor replies:", error);
    return [];
  }
}
