import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import { setState, getState } from "../../_shared/wa-webhook-shared/state/store.ts";
import { sendListMessage, sendText, sendButtonsMessage } from "../../_shared/wa-webhook-shared/wa/client.ts";
import { IDS } from "../../_shared/wa-webhook-shared/wa/ids.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";

// Claim state keys
export const CLAIM_STATES = {
  TYPE: "claim_type",
  DESCRIPTION: "claim_description",
  DOCUMENTS: "claim_documents",
  REVIEW: "claim_review",
  SUBMITTED: "claim_submitted"
};

export async function startClaimFlow(ctx: RouterContext): Promise<boolean> {
  const claimId = crypto.randomUUID();
  
  await setState(ctx.supabase, ctx.profileId!, {
    key: CLAIM_STATES.TYPE,
    data: { claimId, documents: [] }
  });

  await logStructuredEvent("INSURANCE_CLAIM_FLOW_START", {
    profileId: ctx.profileId,
    claimId,
    from: ctx.from
  });

  await sendListMessage(ctx, {
    title: "📋 File Insurance Claim",
    body: "What type of claim are you filing?",
    buttonText: "Select Type",
    rows: [
      { 
        id: "claim_accident", 
        title: "🚗 Vehicle Accident", 
        description: "Collision or crash damage" 
      },
      { 
        id: "claim_theft", 
        title: "🔒 Vehicle Theft", 
        description: "Stolen vehicle or parts" 
      },
      { 
        id: "claim_damage", 
        title: "💥 Vehicle Damage", 
        description: "Non-accident damage" 
      },
      { 
        id: "claim_third_party", 
        title: "👥 Third Party Liability", 
        description: "Damage to others" 
      },
      { 
        id: IDS.BACK_MENU, 
        title: "← Back to Menu" 
      }
    ]
  });

  return true;
}

export async function handleClaimType(
  ctx: RouterContext,
  claimType: string
): Promise<boolean> {
  const state = await getState(ctx.supabase, ctx.profileId!);
  const { claimId, documents = [] } = state?.data || {};

  if (!claimId) {
    await sendText(ctx.from, "❌ Claim session expired. Please start again by typing 'claim'.");
    return false;
  }

  // Store claim type
  await setState(ctx.supabase, ctx.profileId!, {
    key: CLAIM_STATES.DESCRIPTION,
    data: { claimId, claimType, documents }
  });

  await logStructuredEvent("INSURANCE_CLAIM_TYPE_SELECTED", {
    profileId: ctx.profileId,
    claimId,
    claimType
  });

  const typeLabels: Record<string, string> = {
    claim_accident: "Vehicle Accident",
    claim_theft: "Vehicle Theft",
    claim_damage: "Vehicle Damage",
    claim_third_party: "Third Party Liability"
  };

  await sendText(
    ctx.from,
    `📝 *${typeLabels[claimType] || "Insurance"} Claim*\n\n` +
    `Please describe what happened in detail.\n\n` +
    `Include:\n` +
    `• Date and time of incident\n` +
    `• Location (address or area)\n` +
    `• What happened\n` +
    `• Any injuries or damages\n` +
    `• Other parties involved (if any)\n\n` +
    `Type your description below:`
  );

  return true;
}

export async function handleClaimDescription(
  ctx: RouterContext,
  description: string
): Promise<boolean> {
  const state = await getState(ctx.supabase, ctx.profileId!);
  const { claimId, claimType, documents = [] } = state?.data || {};

  if (!claimId) {
    await sendText(ctx.from, "❌ Claim session expired. Please start again.");
    return false;
  }

  // Store description
  await setState(ctx.supabase, ctx.profileId!, {
    key: CLAIM_STATES.DOCUMENTS,
    data: { claimId, claimType, description, documents }
  });

  await logStructuredEvent("INSURANCE_CLAIM_DESCRIPTION_ADDED", {
    profileId: ctx.profileId,
    claimId,
    descriptionLength: description.length
  });

  await sendText(
    ctx.from,
    `📸 *Upload Supporting Documents*\n\n` +
    `Please send photos or documents:\n\n` +
    `✓ Photos of damage\n` +
    `✓ Police report (if applicable)\n` +
    `✓ Witness statements\n` +
    `✓ Medical reports (if injuries)\n` +
    `✓ Any other relevant documents\n\n` +
    `Send each document, then type *'done'* when finished.`
  );

  return true;
}

export async function handleClaimDocuments(
  ctx: RouterContext,
  mediaId: string,
  mimeType?: string
): Promise<boolean> {
  const state = await getState(ctx.supabase, ctx.profileId!);
  const { claimId, claimType, description, documents = [] } = state?.data || {};

  if (!claimId) {
    await sendText(ctx.from, "❌ Claim session expired. Please start again.");
    return false;
  }

  // Add document to list
  documents.push({ mediaId, mimeType, uploadedAt: new Date().toISOString() });

  await setState(ctx.supabase, ctx.profileId!, {
    key: CLAIM_STATES.DOCUMENTS,
    data: { claimId, claimType, description, documents }
  });

  await logStructuredEvent("INSURANCE_CLAIM_DOCUMENT_ADDED", {
    profileId: ctx.profileId,
    claimId,
    documentCount: documents.length,
    mimeType
  });

  await sendButtonsMessage(
    ctx,
    `✅ Document ${documents.length} uploaded successfully.\n\n` +
    `Total documents: ${documents.length}\n\n` +
    `What would you like to do next?`,
    [
      { id: "claim_add_more", title: "📎 Add More Documents" },
      { id: "claim_submit_now", title: "✅ Submit Claim" }
    ]
  );

  return true;
}

export async function handleClaimSubmit(ctx: RouterContext): Promise<boolean> {
  const state = await getState(ctx.supabase, ctx.profileId!);
  const { claimId, claimType, description, documents = [] } = state?.data || {};

  if (!claimId) {
    await sendText(ctx.from, "❌ Claim session expired. Please start again.");
    return false;
  }

  if (!description || description.trim().length < 10) {
    await sendText(ctx.from, "❌ Please provide a detailed description of the incident.");
    return false;
  }

  try {
    // Insert claim into database
    const { error: claimError } = await ctx.supabase.from("insurance_claims").insert({
      id: claimId,
      user_id: ctx.profileId,
      whatsapp: ctx.from,
      claim_type: claimType,
      description,
      documents: documents.map((d: any) => d.mediaId),
      status: "submitted",
      submitted_at: new Date().toISOString()
    });

    if (claimError) {
      await logStructuredEvent("INSURANCE_CLAIM_SUBMIT_ERROR", {
        profileId: ctx.profileId,
        claimId,
        error: claimError.message
      }, "error");
      
      await sendText(ctx.from, "❌ Error submitting claim. Please try again or contact support.");
      return false;
    }

    // Clear state
    await setState(ctx.supabase, ctx.profileId!, {
      key: "home",
      data: {}
    });

    await logStructuredEvent("INSURANCE_CLAIM_SUBMITTED", {
      profileId: ctx.profileId,
      claimId,
      claimType,
      documentCount: documents.length
    });

    const claimRef = claimId.slice(0, 8).toUpperCase();

    await sendText(
      ctx.from,
      `✅ *Claim Submitted Successfully*\n\n` +
      `📋 Claim Reference: *${claimRef}*\n` +
      `📅 Submitted: ${new Date().toLocaleDateString()}\n` +
      `📎 Documents: ${documents.length}\n\n` +
      `🔍 Our team will review your claim and contact you within 24-48 hours.\n\n` +
      `💬 You can check your claim status anytime by typing:\n` +
      `*"claim status ${claimRef}"*\n\n` +
      `Thank you for your patience!`
    );

    // Notify admins about new claim
    await notifyAdminsAboutClaim(ctx, claimId, claimType, description, documents.length);

    return true;
  } catch (error) {
    await logStructuredEvent("INSURANCE_CLAIM_SUBMIT_EXCEPTION", {
      profileId: ctx.profileId,
      claimId,
      error: error instanceof Error ? error.message : String(error)
    }, "error");

    await sendText(ctx.from, "❌ Unexpected error. Please try again later.");
    return false;
  }
}

export async function handleClaimStatus(
  ctx: RouterContext,
  claimRef?: string
): Promise<boolean> {
  try {
    let query = ctx.supabase
      .from("insurance_claims")
      .select("id, claim_type, status, submitted_at, reviewed_at, reviewer_comment")
      .eq("whatsapp", ctx.from)
      .order("submitted_at", { ascending: false });

    if (claimRef) {
      // Search by claim reference (first 8 chars of ID)
      query = query.ilike("id", `${claimRef}%`);
    }

    const { data: claims, error } = await query.limit(5);

    if (error) {
      await logStructuredEvent("INSURANCE_CLAIM_STATUS_ERROR", {
        profileId: ctx.profileId,
        error: error.message
      }, "error");
      
      await sendText(ctx.from, "❌ Error retrieving claim status. Please try again.");
      return false;
    }

    if (!claims || claims.length === 0) {
      await sendText(
        ctx.from,
        claimRef
          ? `❌ No claim found with reference *${claimRef}*.\n\nPlease check the reference and try again.`
          : `📋 You have no claims on record.\n\nTo file a new claim, type *"file claim"*.`
      );
      return true;
    }

    const statusEmoji: Record<string, string> = {
      submitted: "📝",
      reviewing: "🔍",
      approved: "✅",
      rejected: "❌",
      pending_info: "⏳",
      closed: "🔒"
    };

    const claimMessages = claims.map((claim, index) => {
      const ref = claim.id.slice(0, 8).toUpperCase();
      const emoji = statusEmoji[claim.status] || "📋";
      const submittedDate = new Date(claim.submitted_at).toLocaleDateString();
      
      let message = `${index + 1}. ${emoji} *${ref}*\n`;
      message += `   Type: ${claim.claim_type.replace("claim_", "").replace("_", " ")}\n`;
      message += `   Status: ${claim.status}\n`;
      message += `   Submitted: ${submittedDate}`;
      
      if (claim.reviewer_comment) {
        message += `\n   Note: ${claim.reviewer_comment}`;
      }
      
      return message;
    });

    await sendText(
      ctx.from,
      `📋 *Your Insurance Claims*\n\n` +
      claimMessages.join("\n\n") +
      `\n\n💬 For more details, contact our support team.`
    );

    return true;
  } catch (error) {
    await logStructuredEvent("INSURANCE_CLAIM_STATUS_EXCEPTION", {
      profileId: ctx.profileId,
      error: error instanceof Error ? error.message : String(error)
    }, "error");

    await sendText(ctx.from, "❌ Unexpected error. Please try again later.");
    return false;
  }
}

async function notifyAdminsAboutClaim(
  ctx: RouterContext,
  claimId: string,
  claimType: string,
  description: string,
  documentCount: number
): Promise<void> {
  try {
    const claimRef = claimId.slice(0, 8).toUpperCase();
    const typeLabel = claimType.replace("claim_", "").replace("_", " ");
    
    const adminMessage =
      `🚨 *New Insurance Claim Submitted*\n\n` +
      `📋 Claim Ref: *${claimRef}*\n` +
      `📱 Customer: https://wa.me/${ctx.from}\n` +
      `🏷️ Type: ${typeLabel}\n` +
      `📎 Documents: ${documentCount}\n\n` +
      `📝 *Description:*\n${description.slice(0, 500)}${description.length > 500 ? "..." : ""}\n\n` +
      `⚡ Action Required: Review claim in admin panel`;

    // Get admin contacts
    const { data: admins } = await ctx.supabase
      .from("insurance_admin_contacts")
      .select("contact_value")
      .eq("is_active", true)
      .eq("contact_type", "whatsapp");

    if (admins && admins.length > 0) {
      for (const admin of admins) {
        try {
          await sendText(admin.contact_value, adminMessage);
        } catch (error) {
          console.error("Failed to notify admin:", admin.contact_value, error);
        }
      }
    }

    await logStructuredEvent("INSURANCE_CLAIM_ADMIN_NOTIFIED", {
      claimId,
      adminsNotified: admins?.length || 0
    });
  } catch (error) {
    console.error("Failed to notify admins about claim:", error);
  }
}
