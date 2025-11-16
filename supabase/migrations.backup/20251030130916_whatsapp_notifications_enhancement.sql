BEGIN;

-- ============================================================================
-- WhatsApp Notifications Enhancement Migration
-- Comprehensive notification system for WhatsApp-first platform
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Enhance notifications table with additional columns
-- ----------------------------------------------------------------------------

-- Add campaign and correlation tracking
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS campaign_id uuid,
  ADD COLUMN IF NOT EXISTS correlation_id text,
  ADD COLUMN IF NOT EXISTS domain text,
  ADD COLUMN IF NOT EXISTS quiet_hours_override boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_error_code text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT timezone('utc', now());

-- Add indices for efficient queue processing
CREATE INDEX IF NOT EXISTS idx_notifications_status_next_attempt 
  ON public.notifications(status, next_attempt_at) 
  WHERE status = 'queued';

CREATE INDEX IF NOT EXISTS idx_notifications_campaign 
  ON public.notifications(campaign_id) 
  WHERE campaign_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_domain 
  ON public.notifications(domain) 
  WHERE domain IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_correlation 
  ON public.notifications(correlation_id) 
  WHERE correlation_id IS NOT NULL;

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notifications_updated_at ON public.notifications;
CREATE TRIGGER trigger_notifications_updated_at
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_notifications_updated_at();

-- ----------------------------------------------------------------------------
-- 2. Create whatsapp_templates catalog table
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL UNIQUE,
  template_name text NOT NULL,
  domain text NOT NULL,
  category text NOT NULL,
  description text,
  locale text NOT NULL DEFAULT 'en',
  variables jsonb DEFAULT '[]'::jsonb,
  meta_template_id text,
  approval_status text DEFAULT 'pending',
  is_active boolean DEFAULT true,
  retry_policy jsonb DEFAULT '{"max_retries": 5, "backoff_base_seconds": 30}'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_domain 
  ON public.whatsapp_templates(domain);

CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_key 
  ON public.whatsapp_templates(template_key);

CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_active 
  ON public.whatsapp_templates(is_active) 
  WHERE is_active = true;

-- Updated_at trigger for templates
CREATE TRIGGER trigger_whatsapp_templates_updated_at
  BEFORE UPDATE ON public.whatsapp_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_notifications_updated_at();

-- ----------------------------------------------------------------------------
-- 3. Create contact_preferences table for quiet hours, locale, opt-out
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.contact_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  wa_id text NOT NULL UNIQUE,
  preferred_locale text DEFAULT 'en',
  opted_out boolean DEFAULT false,
  opt_out_at timestamptz,
  opt_out_reason text,
  consent_topics jsonb DEFAULT '[]'::jsonb,
  quiet_hours_start time,
  quiet_hours_end time,
  timezone text DEFAULT 'Africa/Kigali',
  notification_preferences jsonb DEFAULT '{}'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_contact_preferences_wa_id 
  ON public.contact_preferences(wa_id);

CREATE INDEX IF NOT EXISTS idx_contact_preferences_profile 
  ON public.contact_preferences(profile_id);

CREATE INDEX IF NOT EXISTS idx_contact_preferences_opted_out 
  ON public.contact_preferences(opted_out) 
  WHERE opted_out = true;

-- Updated_at trigger for contact preferences
CREATE TRIGGER trigger_contact_preferences_updated_at
  BEFORE UPDATE ON public.contact_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_notifications_updated_at();

-- ----------------------------------------------------------------------------
-- 4. Create notification_audit_log for compliance tracking
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notification_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid REFERENCES public.notifications(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_notification_audit_notification 
  ON public.notification_audit_log(notification_id);

CREATE INDEX IF NOT EXISTS idx_notification_audit_created 
  ON public.notification_audit_log(created_at);

-- ----------------------------------------------------------------------------
-- 5. Seed WhatsApp templates for all domains
-- ----------------------------------------------------------------------------

-- Core Platform Templates
INSERT INTO public.whatsapp_templates (template_key, template_name, domain, category, description, variables) VALUES
  ('tmpl_welcome', 'welcome_message', 'core', 'utility', 'Welcome message for new users', '["name"]'::jsonb),
  ('tmpl_verify_code', 'verification_code', 'core', 'authentication', 'OTP verification code', '["code", "expires_in"]'::jsonb),
  ('tmpl_quiet_hours_deferred', 'quiet_hours_notice', 'core', 'utility', 'Message deferred due to quiet hours', '["resume_time"]'::jsonb),
  ('tmpl_preferences_updated', 'preferences_confirmation', 'core', 'utility', 'Notification preferences updated', '["changes"]'::jsonb),
  ('tmpl_service_incident', 'service_incident_alert', 'core', 'utility', 'System incident notification', '["severity", "message", "eta"]'::jsonb)
ON CONFLICT (template_key) DO NOTHING;

-- Baskets / SACCOs Templates
INSERT INTO public.whatsapp_templates (template_key, template_name, domain, category, description, variables) VALUES
  ('tmpl_baskets_invite', 'baskets_invite', 'baskets', 'utility', 'Invite to join basket/SACCO', '["basket_name", "invite_code", "link"]'::jsonb),
  ('tmpl_baskets_invite_accepted', 'baskets_invite_accepted', 'baskets', 'utility', 'Invite accepted notification', '["member_name", "basket_name"]'::jsonb),
  ('tmpl_baskets_member_approved', 'baskets_member_approved', 'baskets', 'utility', 'Membership approved', '["basket_name"]'::jsonb),
  ('tmpl_baskets_due_in_3', 'baskets_contribution_due_soon', 'baskets', 'utility', 'Contribution due in 3 days', '["basket_name", "amount", "due_date"]'::jsonb),
  ('tmpl_baskets_due_today', 'baskets_contribution_due_today', 'baskets', 'utility', 'Contribution due today', '["basket_name", "amount"]'::jsonb),
  ('tmpl_baskets_overdue', 'baskets_contribution_overdue', 'baskets', 'utility', 'Contribution overdue reminder', '["basket_name", "amount", "days_overdue"]'::jsonb),
  ('tmpl_baskets_payment_received', 'baskets_payment_confirmed', 'baskets', 'utility', 'Contribution received confirmation', '["basket_name", "amount", "balance"]'::jsonb),
  ('tmpl_baskets_payment_failed', 'baskets_payment_failed', 'baskets', 'utility', 'Contribution payment failed', '["basket_name", "amount", "reason"]'::jsonb),
  ('tmpl_baskets_loan_submitted', 'baskets_loan_request', 'baskets', 'utility', 'Loan request submitted', '["basket_name", "amount"]'::jsonb),
  ('tmpl_baskets_loan_status', 'baskets_loan_status_update', 'baskets', 'utility', 'Loan status update', '["basket_name", "status", "amount"]'::jsonb),
  ('tmpl_baskets_loan_committee', 'baskets_committee_review', 'baskets', 'utility', 'Committee review prompt', '["member_name", "amount", "basket_name"]'::jsonb),
  ('tmpl_baskets_loan_disbursed', 'baskets_loan_disbursed', 'baskets', 'utility', 'Loan disbursement notice', '["amount", "account"]'::jsonb),
  ('tmpl_baskets_repay_due_in_3', 'baskets_repayment_due_soon', 'baskets', 'utility', 'Loan repayment due in 3 days', '["amount", "due_date"]'::jsonb),
  ('tmpl_baskets_repay_due_today', 'baskets_repayment_due_today', 'baskets', 'utility', 'Loan repayment due today', '["amount"]'::jsonb),
  ('tmpl_baskets_repay_overdue', 'baskets_repayment_overdue', 'baskets', 'utility', 'Loan repayment overdue', '["amount", "days_overdue"]'::jsonb),
  ('tmpl_baskets_close_notice', 'baskets_closure_notice', 'baskets', 'utility', 'Basket closure notice', '["basket_name", "reason"]'::jsonb),
  ('tmpl_baskets_meeting_notice', 'baskets_meeting_announcement', 'baskets', 'utility', 'Meeting announcement', '["basket_name", "date", "agenda"]'::jsonb),
  ('tmpl_baskets_resolution', 'baskets_decision_summary', 'baskets', 'utility', 'Governance decision summary', '["basket_name", "decision"]'::jsonb)
ON CONFLICT (template_key) DO NOTHING;

-- Orders / Dine-in / Marketplace Templates  
INSERT INTO public.whatsapp_templates (template_key, template_name, domain, category, description, variables) VALUES
  ('tmpl_order_created_vendor', 'order_created_vendor', 'orders', 'utility', 'New order notification for vendor', '["order_code", "table_label", "total_formatted"]'::jsonb),
  ('tmpl_order_pending_vendor', 'order_pending_vendor', 'orders', 'utility', 'Pending order reminder for vendor', '["order_code", "age_minutes"]'::jsonb),
  ('tmpl_order_paid_customer', 'order_paid_customer', 'orders', 'utility', 'Order paid confirmation', '["order_code", "bar_name"]'::jsonb),
  ('tmpl_order_served_customer', 'order_served_customer', 'orders', 'utility', 'Order served notification', '["order_code", "table_label"]'::jsonb),
  ('tmpl_order_cancelled_customer', 'order_cancelled_customer', 'orders', 'utility', 'Order cancelled notification', '["order_code", "reason"]'::jsonb),
  ('tmpl_order_accepted_vendor', 'order_accepted_to_customer', 'orders', 'utility', 'Order accepted by vendor', '["order_code", "estimated_time"]'::jsonb),
  ('tmpl_order_ready', 'order_ready_pickup', 'orders', 'utility', 'Order ready for pickup', '["order_code"]'::jsonb),
  ('tmpl_order_delivery_eta', 'order_delivery_eta', 'orders', 'utility', 'Delivery ETA update', '["order_code", "eta", "driver_name"]'::jsonb),
  ('tmpl_order_refund_processed', 'order_refund_processed', 'orders', 'utility', 'Refund processed notification', '["order_code", "amount"]'::jsonb),
  ('tmpl_order_receipt_url', 'order_receipt_link', 'orders', 'utility', 'Order receipt with link', '["order_code", "receipt_url"]'::jsonb),
  ('tmpl_cart_reminder_customer', 'cart_reminder_customer', 'orders', 'utility', 'Cart reminder for customer', '["bar_name", "items_count"]'::jsonb),
  ('tmpl_vendor_inventory_low', 'vendor_inventory_low', 'orders', 'utility', 'Low inventory alert for vendor', '["item_name", "quantity"]'::jsonb),
  ('tmpl_vendor_action_required', 'vendor_action_required', 'orders', 'utility', 'Vendor action required', '["action", "details"]'::jsonb)
ON CONFLICT (template_key) DO NOTHING;

-- Mobility Templates
INSERT INTO public.whatsapp_templates (template_key, template_name, domain, category, description, variables) VALUES
  ('tmpl_ride_match_found', 'ride_match_found', 'mobility', 'utility', 'Driver found for ride', '["driver_name", "vehicle", "eta"]'::jsonb),
  ('tmpl_ride_no_match', 'ride_no_match', 'mobility', 'utility', 'No drivers available', '["tips"]'::jsonb),
  ('tmpl_ride_scheduled', 'ride_scheduled', 'mobility', 'utility', 'Ride scheduled confirmation', '["date", "time", "pickup"]'::jsonb),
  ('tmpl_ride_reminder', 'ride_reminder', 'mobility', 'utility', 'Pre-ride reminder', '["time", "pickup"]'::jsonb),
  ('tmpl_driver_arrived', 'driver_arrived', 'mobility', 'utility', 'Driver arrived at pickup', '["driver_name", "vehicle"]'::jsonb),
  ('tmpl_ride_updated', 'ride_schedule_updated', 'mobility', 'utility', 'Ride schedule changed', '["old_time", "new_time"]'::jsonb),
  ('tmpl_ride_cancelled', 'ride_cancelled', 'mobility', 'utility', 'Ride cancellation notice', '["cancelled_by", "reason"]'::jsonb),
  ('tmpl_ride_receipt', 'ride_receipt', 'mobility', 'utility', 'Ride completion receipt', '["fare", "distance", "duration"]'::jsonb)
ON CONFLICT (template_key) DO NOTHING;

-- OCR Pipeline Templates
INSERT INTO public.whatsapp_templates (template_key, template_name, domain, category, description, variables) VALUES
  ('tmpl_ocr_upload_received', 'ocr_upload_received', 'ocr', 'utility', 'Document upload received', '["document_type"]'::jsonb),
  ('tmpl_ocr_started', 'ocr_processing_started', 'ocr', 'utility', 'Processing started', '["document_type"]'::jsonb),
  ('tmpl_ocr_complete', 'ocr_processing_complete', 'ocr', 'utility', 'Processing complete with summary', '["document_type", "summary"]'::jsonb),
  ('tmpl_ocr_failed_retry', 'ocr_failed_retry', 'ocr', 'utility', 'Processing failed with retry', '["document_type", "retry_link"]'::jsonb),
  ('tmpl_ocr_manual_review', 'ocr_manual_review', 'ocr', 'utility', 'Manual review required', '["document_type", "reason"]'::jsonb)
ON CONFLICT (template_key) DO NOTHING;

-- QR / Deep Links Templates
INSERT INTO public.whatsapp_templates (template_key, template_name, domain, category, description, variables) VALUES
  ('tmpl_qr_created', 'qr_created', 'qr', 'utility', 'QR code generated', '["purpose", "qr_link"]'::jsonb),
  ('tmpl_qr_scanned_info', 'qr_scanned', 'qr', 'utility', 'QR code scanned', '["scanned_by"]'::jsonb),
  ('tmpl_qr_consumed', 'qr_consumed', 'qr', 'utility', 'QR code used/redeemed', '["action"]'::jsonb),
  ('tmpl_qr_invalid', 'qr_invalid', 'qr', 'utility', 'Invalid or expired QR', '["reason"]'::jsonb),
  ('tmpl_deeplink_followup', 'deeplink_followup', 'qr', 'utility', 'Deep link follow-up', '["action"]'::jsonb)
ON CONFLICT (template_key) DO NOTHING;

-- Wallet / Payments Templates
INSERT INTO public.whatsapp_templates (template_key, template_name, domain, category, description, variables) VALUES
  ('tmpl_payment_request', 'payment_request', 'wallet', 'utility', 'Payment request generated', '["amount", "payment_link"]'::jsonb),
  ('tmpl_payment_received', 'payment_received', 'wallet', 'utility', 'Payment received confirmation', '["amount", "balance"]'::jsonb),
  ('tmpl_payment_failed', 'payment_failed', 'wallet', 'utility', 'Payment failed notification', '["amount", "reason"]'::jsonb),
  ('tmpl_refund_processed', 'refund_processed', 'wallet', 'utility', 'Refund processed', '["amount", "reason"]'::jsonb),
  ('tmpl_wallet_low_balance', 'wallet_low_balance', 'wallet', 'utility', 'Low balance alert', '["balance", "topup_link"]'::jsonb),
  ('tmpl_wallet_statement_ready', 'wallet_statement_ready', 'wallet', 'utility', 'Statement ready for download', '["period", "statement_link"]'::jsonb)
ON CONFLICT (template_key) DO NOTHING;

-- Voice / Calls Templates
INSERT INTO public.whatsapp_templates (template_key, template_name, domain, category, description, variables) VALUES
  ('tmpl_call_missed_followup', 'call_missed_followup', 'voice', 'utility', 'Missed call follow-up', '["caller", "options"]'::jsonb),
  ('tmpl_call_transcript', 'call_transcript', 'voice', 'utility', 'Voicemail transcript', '["caller", "transcript"]'::jsonb),
  ('tmpl_call_summary', 'call_summary', 'voice', 'utility', 'Post-call summary', '["duration", "summary"]'::jsonb),
  ('tmpl_callback_scheduled', 'callback_scheduled', 'voice', 'utility', 'Callback scheduled', '["time", "agent"]'::jsonb),
  ('tmpl_callback_reminder', 'callback_reminder', 'voice', 'utility', 'Callback reminder', '["time"]'::jsonb),
  ('tmpl_call_consent_confirmed', 'call_consent', 'voice', 'utility', 'Call consent confirmation', '["purpose"]'::jsonb)
ON CONFLICT (template_key) DO NOTHING;

-- Campaign / Broadcast Templates
INSERT INTO public.whatsapp_templates (template_key, template_name, domain, category, description, variables) VALUES
  ('tmpl_campaign_dispatch_receipt', 'campaign_dispatch_receipt', 'campaigns', 'utility', 'Campaign dispatch receipt', '["campaign_name", "recipients_count"]'::jsonb),
  ('tmpl_campaign_dispatch_failed', 'campaign_dispatch_failed', 'campaigns', 'utility', 'Campaign dispatch error', '["campaign_name", "error"]'::jsonb),
  ('tmpl_drip_n', 'drip_sequence', 'campaigns', 'utility', 'Drip sequence message', '["sequence_num", "content"]'::jsonb)
ON CONFLICT (template_key) DO NOTHING;

-- Admin / Operational Templates
INSERT INTO public.whatsapp_templates (template_key, template_name, domain, category, description, variables) VALUES
  ('tmpl_webhook_error_notice', 'webhook_error_alert', 'admin', 'utility', 'Webhook error alert', '["endpoint", "error", "count"]'::jsonb),
  ('tmpl_outbox_failure_spike', 'outbox_failure_spike', 'admin', 'utility', 'High failure rate detected', '["failure_rate", "period"]'::jsonb),
  ('tmpl_template_status_changed', 'template_status_changed', 'admin', 'utility', 'Template approval status change', '["template_name", "old_status", "new_status"]'::jsonb),
  ('tmpl_quiet_hours_changed', 'quiet_hours_changed', 'admin', 'utility', 'Quiet hours policy changed', '["old_hours", "new_hours"]'::jsonb),
  ('tmpl_data_anomaly_alert', 'data_anomaly_alert', 'admin', 'utility', 'Data anomaly detected', '["anomaly_type", "details"]'::jsonb)
ON CONFLICT (template_key) DO NOTHING;

-- Flow Interaction Templates
INSERT INTO public.whatsapp_templates (template_key, template_name, domain, category, description, variables) VALUES
  ('tmpl_flow_continue', 'flow_continue_reminder', 'flows', 'utility', 'Flow completion reminder', '["flow_name", "link"]'::jsonb),
  ('tmpl_flow_result', 'flow_result_confirmation', 'flows', 'utility', 'Flow result confirmation', '["flow_name", "result"]'::jsonb),
  ('tmpl_admin_task_assigned', 'admin_task_assigned', 'flows', 'utility', 'Admin task assigned', '["task_type", "assignee"]'::jsonb),
  ('tmpl_admin_task_closed', 'admin_task_closed', 'flows', 'utility', 'Admin task closed', '["task_type", "result"]'::jsonb)
ON CONFLICT (template_key) DO NOTHING;

-- Buyer/Customer Mobility Notifications
INSERT INTO public.whatsapp_templates (template_key, template_name, domain, category, description, variables) VALUES
  ('tmpl_search_initiated', 'search_initiated', 'mobility', 'utility', 'Searching for transport', '[]'::jsonb),
  ('tmpl_wallet_topped_up', 'wallet_topped_up', 'wallet', 'utility', 'Wallet top-up successful', '["amount", "new_balance"]'::jsonb),
  ('tmpl_rate_trip', 'rate_trip_request', 'mobility', 'utility', 'Rate your trip', '["driver_name", "trip_id"]'::jsonb)
ON CONFLICT (template_key) DO NOTHING;

-- Vendor/Driver Notifications
INSERT INTO public.whatsapp_templates (template_key, template_name, domain, category, description, variables) VALUES
  ('tmpl_vendor_account_approved', 'vendor_account_activated', 'vendor', 'utility', 'Account approved/activated', '[]'::jsonb),
  ('tmpl_ride_request_received', 'ride_request_received', 'mobility', 'utility', 'New ride request', '["pickup", "destination"]'::jsonb),
  ('tmpl_ride_request_missed', 'ride_request_missed', 'mobility', 'utility', 'Missed ride request', '[]'::jsonb),
  ('tmpl_rating_received', 'new_rating_received', 'mobility', 'utility', 'New rating received', '["rating", "comment"]'::jsonb),
  ('tmpl_weekly_performance', 'weekly_performance_report', 'mobility', 'utility', 'Weekly performance summary', '["trips", "rating", "acceptance_rate"]'::jsonb)
ON CONFLICT (template_key) DO NOTHING;

-- System Health Notifications (Internal)
INSERT INTO public.whatsapp_templates (template_key, template_name, domain, category, description, variables) VALUES
  ('tmpl_service_down', 'service_down_alert', 'admin', 'utility', 'Service down/unhealthy alert', '["service_name", "details"]'::jsonb)
ON CONFLICT (template_key) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 6. Add RLS policies for new tables
-- ----------------------------------------------------------------------------

-- RLS for whatsapp_templates (admin and service role only)
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_all_whatsapp_templates
  ON public.whatsapp_templates
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- RLS for contact_preferences (users can view their own)
ALTER TABLE public.contact_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_all_contact_preferences
  ON public.contact_preferences
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY users_view_own_preferences
  ON public.contact_preferences
  FOR SELECT
  USING (auth.uid() = profile_id);

-- RLS for notification_audit_log (service role only)
ALTER TABLE public.notification_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_all_notification_audit
  ON public.notification_audit_log
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMIT;
