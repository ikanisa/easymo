/**
 * Example Notification Triggers
 * Demonstrates how to queue notifications from various domains
 */

import { queueNotification } from "./sender.ts";
import type { SupabaseClient } from "../deps.ts";

// =============================================================================
// BASKETS / SACCOS
// =============================================================================

/**
 * Send contribution reminder (3 days before due)
 */
export async function notifyContributionDueSoon(
  member: { wa_id: string; name: string },
  basket: { name: string; contribution_amount: number; due_date: string },
  supa?: SupabaseClient,
) {
  return await queueNotification({
    to: member.wa_id,
    template: {
      name: "baskets_contribution_due_soon",
      language: "en",
      components: [{
        type: "body",
        parameters: [
          { type: "text", text: basket.name },
          { type: "text", text: `${basket.contribution_amount} RWF` },
          { type: "text", text: basket.due_date },
        ],
      }],
    },
  }, {
    type: "baskets_contribution_reminder",
    domain: "baskets",
    correlation_id: `basket_${basket.name}_contrib_reminder_${member.name}`,
    supabase: supa,
  });
}

/**
 * Send loan status update
 */
export async function notifyLoanStatus(
  member: { wa_id: string; id: string },
  loan: {
    basket_name: string;
    amount: number;
    status: "approved" | "rejected" | "pending";
  },
  supa?: SupabaseClient,
) {
  return await queueNotification({
    to: member.wa_id,
    template: {
      name: "baskets_loan_status_update",
      language: "en",
      components: [{
        type: "body",
        parameters: [
          { type: "text", text: loan.basket_name },
          { type: "text", text: loan.status },
          { type: "text", text: `${loan.amount} RWF` },
        ],
      }],
    },
  }, {
    type: "baskets_loan_status",
    domain: "baskets",
    correlation_id: `loan_${member.id}_status_${loan.status}`,
    supabase: supa,
  });
}

/**
 * Send payment received confirmation
 */
export async function notifyPaymentReceived(
  member: { wa_id: string; id: string },
  payment: { basket_name: string; amount: number; new_balance: number },
  supa?: SupabaseClient,
) {
  return await queueNotification({
    to: member.wa_id,
    template: {
      name: "baskets_payment_confirmed",
      language: "en",
      components: [{
        type: "body",
        parameters: [
          { type: "text", text: payment.basket_name },
          { type: "text", text: `${payment.amount} RWF` },
          { type: "text", text: `${payment.new_balance} RWF` },
        ],
      }],
    },
  }, {
    type: "baskets_payment_received",
    domain: "baskets",
    correlation_id: `basket_payment_${member.id}_${Date.now()}`,
    supabase: supa,
  });
}

// =============================================================================
// ORDERS / DINE-IN
// =============================================================================

/**
 * Notify vendor of new order
 */
export async function notifyVendorNewOrder(
  vendor: { wa_id: string },
  order: { code: string; table: string; total: string; order_id: string },
  supa?: SupabaseClient,
) {
  return await queueNotification({
    to: vendor.wa_id,
    template: {
      name: "order_created_vendor",
      language: "en",
      components: [{
        type: "body",
        parameters: [
          { type: "text", text: order.code },
          { type: "text", text: order.table || "Counter" },
          { type: "text", text: order.total },
        ],
      }],
    },
  }, {
    type: "order_created_vendor",
    domain: "orders",
    correlation_id: `order_${order.order_id}_created`,
    orderId: order.order_id,
    supabase: supa,
  });
}

/**
 * Notify customer that order is ready
 */
export async function notifyCustomerOrderReady(
  customer: { wa_id: string },
  order: { code: string; order_id: string },
  supa?: SupabaseClient,
) {
  return await queueNotification({
    to: customer.wa_id,
    template: {
      name: "order_ready_pickup",
      language: "en",
      components: [{
        type: "body",
        parameters: [
          { type: "text", text: order.code },
        ],
      }],
    },
  }, {
    type: "order_ready",
    domain: "orders",
    correlation_id: `order_${order.order_id}_ready`,
    orderId: order.order_id,
    supabase: supa,
  });
}

// =============================================================================
// MOBILITY
// =============================================================================

/**
 * Notify customer that driver found
 */
export async function notifyRideMatchFound(
  customer: { wa_id: string; id: string },
  ride: {
    driver_name: string;
    vehicle: string;
    eta_minutes: number;
    ride_id: string;
  },
  supa?: SupabaseClient,
) {
  return await queueNotification({
    to: customer.wa_id,
    template: {
      name: "ride_match_found",
      language: "en",
      components: [{
        type: "body",
        parameters: [
          { type: "text", text: ride.driver_name },
          { type: "text", text: ride.vehicle },
          { type: "text", text: `${ride.eta_minutes} min` },
        ],
      }],
    },
  }, {
    type: "ride_match_found",
    domain: "mobility",
    correlation_id: `ride_${ride.ride_id}_match`,
    supabase: supa,
  });
}

/**
 * Notify driver of new ride request
 */
export async function notifyDriverRideRequest(
  driver: { wa_id: string; id: string },
  request: { pickup: string; destination: string; request_id: string },
  supa?: SupabaseClient,
) {
  return await queueNotification({
    to: driver.wa_id,
    template: {
      name: "ride_request_received",
      language: "en",
      components: [{
        type: "body",
        parameters: [
          { type: "text", text: request.pickup },
          { type: "text", text: request.destination },
        ],
      }],
    },
  }, {
    type: "ride_request_received",
    domain: "mobility",
    correlation_id: `ride_request_${request.request_id}_driver_${driver.id}`,
    supabase: supa,
  });
}

/**
 * Send ride receipt after completion
 */
export async function notifyRideReceipt(
  customer: { wa_id: string },
  trip: {
    fare: string;
    distance: string;
    duration: string;
    trip_id: string;
  },
  supa?: SupabaseClient,
) {
  return await queueNotification({
    to: customer.wa_id,
    template: {
      name: "ride_receipt",
      language: "en",
      components: [{
        type: "body",
        parameters: [
          { type: "text", text: trip.fare },
          { type: "text", text: trip.distance },
          { type: "text", text: trip.duration },
        ],
      }],
    },
  }, {
    type: "ride_receipt",
    domain: "mobility",
    correlation_id: `trip_${trip.trip_id}_receipt`,
    supabase: supa,
  });
}

// =============================================================================
// WALLET / PAYMENTS
// =============================================================================

/**
 * Notify user of payment received
 */
export async function notifyPaymentReceived(
  user: { wa_id: string; id: string },
  payment: { amount: number; new_balance: number; payment_id: string },
  supa?: SupabaseClient,
) {
  return await queueNotification({
    to: user.wa_id,
    template: {
      name: "payment_received",
      language: "en",
      components: [{
        type: "body",
        parameters: [
          { type: "text", text: `${payment.amount} RWF` },
          { type: "text", text: `${payment.new_balance} RWF` },
        ],
      }],
    },
  }, {
    type: "payment_received",
    domain: "wallet",
    correlation_id: `payment_${payment.payment_id}`,
    supabase: supa,
  });
}

/**
 * Notify user of low wallet balance
 */
export async function notifyLowBalance(
  user: { wa_id: string; id: string },
  balance: { amount: number; topup_link: string },
  supa?: SupabaseClient,
) {
  return await queueNotification({
    to: user.wa_id,
    template: {
      name: "wallet_low_balance",
      language: "en",
      components: [{
        type: "body",
        parameters: [
          { type: "text", text: `${balance.amount} RWF` },
          { type: "text", text: balance.topup_link },
        ],
      }],
    },
  }, {
    type: "wallet_low_balance",
    domain: "wallet",
    correlation_id: `low_balance_${user.id}_${Date.now()}`,
    supabase: supa,
  });
}

// =============================================================================
// OCR PIPELINE
// =============================================================================

/**
 * Notify user of OCR processing complete
 */
export async function notifyOCRComplete(
  user: { wa_id: string },
  ocr: { document_type: string; summary: string; job_id: string },
  supa?: SupabaseClient,
) {
  return await queueNotification({
    to: user.wa_id,
    template: {
      name: "ocr_processing_complete",
      language: "en",
      components: [{
        type: "body",
        parameters: [
          { type: "text", text: ocr.document_type },
          { type: "text", text: ocr.summary },
        ],
      }],
    },
  }, {
    type: "ocr_complete",
    domain: "ocr",
    correlation_id: `ocr_${ocr.job_id}_complete`,
    supabase: supa,
  });
}

// =============================================================================
// ADMIN / OPERATIONAL
// =============================================================================

/**
 * Alert admins of service down
 */
export async function alertServiceDown(
  admins: Array<{ wa_id: string }>,
  service: { name: string; details: string },
  supa?: SupabaseClient,
) {
  const correlationId = `service_down_${service.name}_${Date.now()}`;

  for (const admin of admins) {
    await queueNotification({
      to: admin.wa_id,
      template: {
        name: "service_down_alert",
        language: "en",
        components: [{
          type: "body",
          parameters: [
            { type: "text", text: service.name },
            { type: "text", text: service.details },
          ],
        }],
      },
    }, {
      type: "service_down",
      domain: "admin",
      correlation_id: correlationId,
      quiet_hours_override: true, // Critical alert
      supabase: supa,
    });
  }
}

/**
 * Alert admins of high failure rate
 */
export async function alertOutboxFailureSpike(
  admins: Array<{ wa_id: string }>,
  metrics: { failure_rate: number; period: string },
  supa?: SupabaseClient,
) {
  const correlationId = `failure_spike_${Date.now()}`;

  for (const admin of admins) {
    await queueNotification({
      to: admin.wa_id,
      template: {
        name: "outbox_failure_spike",
        language: "en",
        components: [{
          type: "body",
          parameters: [
            { type: "text", text: `${metrics.failure_rate}%` },
            { type: "text", text: metrics.period },
          ],
        }],
      },
    }, {
      type: "outbox_failure_spike",
      domain: "admin",
      correlation_id: correlationId,
      quiet_hours_override: true, // Operational alert
      supabase: supa,
    });
  }
}

// =============================================================================
// CAMPAIGNS
// =============================================================================

/**
 * Send campaign message to multiple recipients
 */
export async function sendCampaignBroadcast(
  recipients: Array<{ wa_id: string; id: string }>,
  campaign: {
    id: string;
    name: string;
    template_name: string;
    template_variables: Record<string, string>;
  },
  supa?: SupabaseClient,
) {
  const campaignId = campaign.id;

  for (const recipient of recipients) {
    // Build template parameters from variables
    const parameters = Object.values(campaign.template_variables).map(
      (value) => ({ type: "text", text: value }),
    );

    await queueNotification({
      to: recipient.wa_id,
      template: {
        name: campaign.template_name,
        language: "en",
        components: [{
          type: "body",
          parameters,
        }],
      },
    }, {
      type: "campaign_message",
      domain: "campaigns",
      campaign_id: campaignId,
      correlation_id: `campaign_${campaignId}_recipient_${recipient.id}`,
      supabase: supa,
    });
  }
}

// =============================================================================
// CORE PLATFORM
// =============================================================================

/**
 * Send welcome message to new user
 */
export async function notifyWelcome(
  user: { wa_id: string; name: string; id: string },
  supa?: SupabaseClient,
) {
  return await queueNotification({
    to: user.wa_id,
    template: {
      name: "welcome_message",
      language: "en",
      components: [{
        type: "body",
        parameters: [
          { type: "text", text: user.name },
        ],
      }],
    },
  }, {
    type: "welcome",
    domain: "core",
    correlation_id: `welcome_${user.id}`,
    supabase: supa,
  });
}

/**
 * Send OTP verification code
 */
export async function notifyOTP(
  user: { wa_id: string },
  otp: { code: string; expires_in_minutes: number; session_id: string },
  supa?: SupabaseClient,
) {
  return await queueNotification({
    to: user.wa_id,
    template: {
      name: "verification_code",
      language: "en",
      components: [{
        type: "body",
        parameters: [
          { type: "text", text: otp.code },
          { type: "text", text: `${otp.expires_in_minutes} minutes` },
        ],
      }],
    },
  }, {
    type: "otp_verification",
    domain: "core",
    correlation_id: `otp_${otp.session_id}`,
    quiet_hours_override: true, // Time-sensitive
    supabase: supa,
  });
}
