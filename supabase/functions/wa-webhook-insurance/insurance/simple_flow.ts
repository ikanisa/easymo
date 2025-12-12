/**
 * Simplified Insurance Flow
 * - NO OCR processing
 * - Direct file forwarding to admins
 * - Simple chat connection
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js";
import { sendText, sendDocument, sendImage } from "../../_shared/wa-webhook-shared/wa/client.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";

interface InsuranceAdmin {
  wa_id: string;
  display_name: string;
  is_active: boolean;
}

/**
 * Fetch all active insurance admin contacts
 */
async function getInsuranceAdmins(supabase: SupabaseClient): Promise<InsuranceAdmin[]> {
  const { data, error } = await supabase
    .from("insurance_admin_contacts")
    .select("contact_value, display_name, is_active")
    .eq("contact_type", "whatsapp")
    .eq("category", "insurance")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) {
    await logStructuredEvent("INSURANCE_ADMIN_FETCH_ERROR", { error: error.message }, "error");
    return [];
  }

  return (data || []).map(row => ({
    wa_id: row.contact_value.replace("+", ""),
    display_name: row.display_name,
    is_active: row.is_active
  }));
}

/**
 * Handle certificate/carte jaune upload - forward directly to admins
 */
export async function handleDocumentUpload(
  supabase: SupabaseClient,
  userWaId: string,
  userName: string,
  documentType: "certificate" | "carte_jaune",
  mediaId: string,
  mediaUrl: string,
  mimeType: string
): Promise<{ success: boolean; message: string }> {
  
  const correlationId = crypto.randomUUID();
  await logStructuredEvent("INSURANCE_DOC_UPLOAD_START", {
    correlationId,
    userWaId,
    documentType,
    mediaId
  });

  try {
    const admins = await getInsuranceAdmins(supabase);
    
    if (admins.length === 0) {
      await logStructuredEvent("INSURANCE_NO_ADMINS", { correlationId }, "error");
      return {
        success: false,
        message: "No insurance team members available. Please try again later."
      };
    }

    const documentLabel = documentType === "certificate" 
      ? "Insurance Certificate" 
      : "Carte Jaune (Yellow Card)";
    
    const adminNotificationText = `🔔 NEW INSURANCE REQUEST

📄 Document: ${documentLabel}
👤 From: ${userName}
📱 WhatsApp: wa.me/${userWaId}
🕐 Time: ${new Date().toLocaleString("en-RW", { timeZone: "Africa/Kigali" })}

Please review the attached document and contact the user.`;

    const results = await Promise.allSettled(
      admins.map(async (admin) => {
        await sendText(admin.wa_id, adminNotificationText);
        
        if (mimeType.startsWith("image/")) {
          await sendImage(admin.wa_id, mediaUrl, `${documentLabel} from ${userName}`);
        } else {
          await sendDocument(admin.wa_id, mediaUrl, `${documentLabel}_${userWaId}.pdf`);
        }
        
        return admin.wa_id;
      })
    );

    const successful = results.filter(r => r.status === "fulfilled").length;
    const failed = results.filter(r => r.status === "rejected").length;

    await logStructuredEvent("INSURANCE_DOC_FORWARDED", {
      correlationId,
      documentType,
      adminCount: admins.length,
      successful,
      failed
    });

    await supabase.from("insurance_requests_simple").insert({
      user_wa_id: userWaId,
      user_name: userName,
      document_type: documentType,
      media_id: mediaId,
      status: "forwarded",
      admins_notified: successful,
      created_at: new Date().toISOString()
    });

    return {
      success: true,
      message: `✅ Your ${documentLabel} has been received!\n\nOur insurance team (${successful} members) has been notified and will contact you shortly via WhatsApp.\n\nReference: INS-${Date.now().toString(36).toUpperCase()}`
    };

  } catch (error) {
    await logStructuredEvent("INSURANCE_DOC_UPLOAD_ERROR", {
      correlationId,
      error: error instanceof Error ? error.message : String(error)
    }, "error");
    
    return {
      success: false,
      message: "Sorry, something went wrong. Please try again or contact us directly."
    };
  }
}

/**
 * Handle "Chat with Team" request - notify admins with user contact
 */
export async function handleChatRequest(
  supabase: SupabaseClient,
  userWaId: string,
  userName: string
): Promise<{ success: boolean; message: string }> {
  
  const correlationId = crypto.randomUUID();
  await logStructuredEvent("INSURANCE_CHAT_REQUEST_START", { correlationId, userWaId });

  try {
    const admins = await getInsuranceAdmins(supabase);
    
    if (admins.length === 0) {
      return {
        success: false,
        message: "No insurance team members available. Please try again later."
      };
    }

    const chatNotificationText = `💬 INSURANCE CHAT REQUEST

👤 User: ${userName}
📱 WhatsApp: wa.me/${userWaId}
🕐 Time: ${new Date().toLocaleString("en-RW", { timeZone: "Africa/Kigali" })}

User wants to chat about insurance. Please message them directly.`;

    const results = await Promise.allSettled(
      admins.map(admin => sendText(admin.wa_id, chatNotificationText))
    );

    const successful = results.filter(r => r.status === "fulfilled").length;

    await logStructuredEvent("INSURANCE_CHAT_NOTIFIED", {
      correlationId,
      adminCount: admins.length,
      successful
    });

    await supabase.from("insurance_requests_simple").insert({
      user_wa_id: userWaId,
      user_name: userName,
      document_type: "chat_request",
      status: "forwarded",
      admins_notified: successful,
      created_at: new Date().toISOString()
    });

    return {
      success: true,
      message: `✅ Our insurance team has been notified!\n\n${successful} team member(s) will message you shortly via WhatsApp.\n\nPlease keep this chat open.`
    };

  } catch (error) {
    await logStructuredEvent("INSURANCE_CHAT_REQUEST_ERROR", {
      correlationId,
      error: error instanceof Error ? error.message : String(error)
    }, "error");
    
    return {
      success: false,
      message: "Sorry, something went wrong. Please try again."
    };
  }
}
