import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { supabase } from "../_shared/wa-webhook-shared/config.ts";
import { sendText } from "../_shared/wa-webhook-shared/wa/client.ts";
import { logStructuredEvent } from "../_shared/observability.ts";

serve(async (req) => {
  const requestId = crypto.randomUUID();
  
  try {
    await logStructuredEvent("INSURANCE_RENEWAL_REMINDER_START", {
      requestId,
      timestamp: new Date().toISOString()
    });

    // Get policies expiring in 7, 3, and 1 days
    const reminderDays = [7, 3, 1];
    let totalReminded = 0;
    const results: Array<{ days: number; reminded: number; errors: number }> = [];

    for (const days of reminderDays) {
      let reminded = 0;
      let errors = 0;

      try {
        // Call RPC function to get expiring policies
        const { data: expiring, error: rpcError } = await supabase.rpc(
          "get_expiring_policies",
          { days_ahead: days }
        );

        if (rpcError) {
          await logStructuredEvent("INSURANCE_RENEWAL_RPC_ERROR", {
            requestId,
            days,
            error: rpcError.message
          }, "error");
          errors++;
          continue;
        }

        for (const policy of expiring || []) {
          try {
            // Check if reminder already sent for this day
            const { data: existing } = await supabase
              .from("insurance_renewals")
              .select("*")
              .eq("lead_id", policy.lead_id)
              .eq("reminder_days", days)
              .maybeSingle();

            if (existing) {
              // Already sent reminder for this day
              continue;
            }

            // Format expiry date
            const expiryDate = new Date(policy.policy_expiry).toLocaleDateString();
            const dayText = days === 1 ? "day" : "days";

            // Send reminder with buttons
            await sendButtonsMessage(
              { from: policy.wa_id, supabase },
              `⚠️ *Policy Expiry Reminder*\n\n` +
              `Your ${policy.insurer_name || "insurance"} policy expires in *${days} ${dayText}*!\n\n` +
              `📅 Expiry Date: ${expiryDate}\n\n` +
              `Don't let your coverage lapse. Renew now to stay protected and avoid penalties.`,
              [
                { id: "renew_policy", title: "🔄 Renew Now" },
                { id: "remind_later", title: "⏰ Remind Me Later" }
              ]
            );

            // Record reminder sent
            const { error: insertError } = await supabase
              .from("insurance_renewals")
              .insert({
                lead_id: policy.lead_id,
                user_id: policy.user_id,
                reminder_days: days,
                sent_at: new Date().toISOString(),
                status: "sent",
                policy_expiry: policy.policy_expiry
              });

            if (insertError) {
              await logStructuredEvent("INSURANCE_RENEWAL_RECORD_ERROR", {
                requestId,
                leadId: policy.lead_id,
                days,
                error: insertError.message
              }, "error");
              errors++;
            } else {
              reminded++;
              await logStructuredEvent("INSURANCE_RENEWAL_SENT", {
                requestId,
                leadId: policy.lead_id,
                waId: policy.wa_id,
                days,
                expiryDate: policy.policy_expiry
              });
            }

          } catch (policyError) {
            errors++;
            await logStructuredEvent("INSURANCE_RENEWAL_POLICY_ERROR", {
              requestId,
              leadId: policy.lead_id,
              days,
              error: policyError instanceof Error ? policyError.message : String(policyError)
            }, "error");
          }
        }

        results.push({ days, reminded, errors });
        totalReminded += reminded;

      } catch (dayError) {
        await logStructuredEvent("INSURANCE_RENEWAL_DAY_ERROR", {
          requestId,
          days,
          error: dayError instanceof Error ? dayError.message : String(dayError)
        }, "error");
        results.push({ days, reminded: 0, errors: 1 });
      }
    }

    await logStructuredEvent("INSURANCE_RENEWAL_REMINDER_COMPLETE", {
      requestId,
      totalReminded,
      results
    });

    return new Response(JSON.stringify({
      success: true,
      totalReminded,
      results,
      timestamp: new Date().toISOString()
    }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    await logStructuredEvent("INSURANCE_RENEWAL_REMINDER_ERROR", {
      requestId,
      error: error instanceof Error ? error.message : String(error)
    }, "error");

    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
