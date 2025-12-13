BEGIN;

-- Add RLS policies to restore access after enabling RLS
-- Service role has full access, authenticated users have read access by default
-- Specific tables may need more restrictive policies based on business logic

-- ============================================================================
-- HELPER FUNCTION: Check if user is admin
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if current user has admin role
  -- This is a placeholder - adjust based on your admin detection logic
  RETURN EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND raw_user_meta_data->>'role' = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Menu & Items
-- ============================================================================

-- menu_items: Service role full access, authenticated users can read
CREATE POLICY "service_role_all_menu_items" ON public.menu_items
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_menu_items" ON public.menu_items
  FOR SELECT TO authenticated USING (true);

-- ============================================================================
-- Authentication & Admin Tables
-- ============================================================================

-- admin_contacts: Service role full, authenticated read
CREATE POLICY "service_role_all_admin_contacts" ON public.admin_contacts
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_admin_contacts" ON public.admin_contacts
  FOR SELECT TO authenticated USING (true);

-- auth_qr_sessions: Service role full, staff can see their own sessions
CREATE POLICY "service_role_all_auth_qr_sessions" ON public.auth_qr_sessions
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "staff_read_own_qr_sessions" ON public.auth_qr_sessions
  FOR SELECT TO authenticated 
  USING (staff_id = auth.uid());

CREATE POLICY "staff_insert_own_qr_sessions" ON public.auth_qr_sessions
  FOR INSERT TO authenticated 
  WITH CHECK (staff_id = auth.uid());

-- staff_devices: Service role full, staff manage their own devices
CREATE POLICY "service_role_all_staff_devices" ON public.staff_devices
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "staff_manage_own_devices" ON public.staff_devices
  TO authenticated 
  USING (staff_id = auth.uid())
  WITH CHECK (staff_id = auth.uid());

-- auth_logs: Service role full, users can read their own logs
CREATE POLICY "service_role_all_auth_logs" ON public.auth_logs
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "users_read_own_auth_logs" ON public.auth_logs
  FOR SELECT TO authenticated 
  USING (user_id = auth.uid());

-- ============================================================================
-- SMS & Communication Tables
-- ============================================================================

-- sms_inbox: Service role full access (internal system)
CREATE POLICY "service_role_all_sms_inbox" ON public.sms_inbox
  TO service_role USING (true) WITH CHECK (true);

-- sms_parsed: Service role full access (internal system)
CREATE POLICY "service_role_all_sms_parsed" ON public.sms_parsed
  TO service_role USING (true) WITH CHECK (true);

-- sms_templates: Service role full, authenticated can read
CREATE POLICY "service_role_all_sms_templates" ON public.sms_templates
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_sms_templates" ON public.sms_templates
  FOR SELECT TO authenticated USING (true);

-- sms_review_queue: Service role full access (internal moderation)
CREATE POLICY "service_role_all_sms_review_queue" ON public.sms_review_queue
  TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- Financial Tables
-- ============================================================================

-- reconciliation_runs: Service role only (sensitive financial data)
CREATE POLICY "service_role_all_reconciliation_runs" ON public.reconciliation_runs
  TO service_role USING (true) WITH CHECK (true);

-- reconciliation_exceptions: Service role only (sensitive financial data)
CREATE POLICY "service_role_all_reconciliation_exceptions" ON public.reconciliation_exceptions
  TO service_role USING (true) WITH CHECK (true);

-- payments: Service role full, members can read their own payments
CREATE POLICY "service_role_all_payments" ON public.payments
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "members_read_own_payments" ON public.payments
  FOR SELECT TO authenticated 
  USING (member_id IN (SELECT id FROM public.members WHERE phone_number = (SELECT phone FROM auth.users WHERE id = auth.uid())));

-- settlements: Service role only (sensitive financial data)
CREATE POLICY "service_role_all_settlements" ON public.settlements
  TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- Organizations & Members Tables
-- ============================================================================

-- organizations: Service role full, authenticated can read
CREATE POLICY "service_role_all_organizations" ON public.organizations
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_organizations" ON public.organizations
  FOR SELECT TO authenticated USING (true);

-- members: Service role full, users can read their own membership
CREATE POLICY "service_role_all_members" ON public.members
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "users_read_own_membership" ON public.members
  FOR SELECT TO authenticated 
  USING (user_id = auth.uid());

-- groups: Service role full, authenticated can read
CREATE POLICY "service_role_all_groups" ON public.groups
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_groups" ON public.groups
  FOR SELECT TO authenticated USING (true);

-- group_members: Service role full, users can read their own memberships
CREATE POLICY "service_role_all_group_members" ON public.group_members
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "users_read_own_group_membership" ON public.group_members
  FOR SELECT TO authenticated 
  USING (user_id = auth.uid());

-- ============================================================================
-- Share Allocations
-- ============================================================================

-- share_allocations: Service role full, users can read their own allocations
CREATE POLICY "service_role_all_share_allocations" ON public.share_allocations
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "users_read_own_allocations" ON public.share_allocations
  FOR SELECT TO authenticated 
  USING (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()));

-- allocation_export_requests: Service role full, users can request their own exports
CREATE POLICY "service_role_all_allocation_exports" ON public.allocation_export_requests
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "users_manage_own_export_requests" ON public.allocation_export_requests
  TO authenticated 
  USING (requested_by = auth.uid())
  WITH CHECK (requested_by = auth.uid());

-- ============================================================================
-- Wallet Tables (Ibimina)
-- ============================================================================

-- wallet_accounts_ibimina: Service role full, users can read their own account
CREATE POLICY "service_role_all_wallet_accounts" ON public.wallet_accounts_ibimina
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "users_read_own_wallet" ON public.wallet_accounts_ibimina
  FOR SELECT TO authenticated 
  USING (user_id = auth.uid());

-- wallet_transactions_ibimina: Service role full, users can read their own transactions
CREATE POLICY "service_role_all_wallet_transactions" ON public.wallet_transactions_ibimina
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "users_read_own_transactions" ON public.wallet_transactions_ibimina
  FOR SELECT TO authenticated 
  USING (
    account_id IN (SELECT id FROM public.wallet_accounts_ibimina WHERE user_id = auth.uid())
  );

-- ============================================================================
-- Configuration & System Tables
-- ============================================================================

-- configuration: Service role full, authenticated read (system settings)
CREATE POLICY "service_role_all_configuration" ON public.configuration
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_configuration" ON public.configuration
  FOR SELECT TO authenticated USING (true);

-- org_feature_overrides: Service role full, authenticated read
CREATE POLICY "service_role_all_org_features" ON public.org_feature_overrides
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_org_features" ON public.org_feature_overrides
  FOR SELECT TO authenticated USING (true);

-- system_metrics: Service role only (internal monitoring)
CREATE POLICY "service_role_all_system_metrics" ON public.system_metrics
  TO service_role USING (true) WITH CHECK (true);

-- rate_limit_counters: Service role only (internal rate limiting)
CREATE POLICY "service_role_all_rate_limits" ON public.rate_limit_counters
  TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- Analytics & Notifications Tables
-- ============================================================================

-- analytics_events: Service role full, users can read their own events
CREATE POLICY "service_role_all_analytics_events" ON public.analytics_events
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "users_read_own_analytics" ON public.analytics_events
  FOR SELECT TO authenticated 
  USING (user_id = auth.uid());

-- notification_queue: Service role full, users can read their own notifications
CREATE POLICY "service_role_all_notification_queue" ON public.notification_queue
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "users_read_own_notifications" ON public.notification_queue
  FOR SELECT TO authenticated 
  USING (user_id = auth.uid());

-- user_push_subscriptions: Service role full, users manage their own subscriptions
CREATE POLICY "service_role_all_push_subscriptions" ON public.user_push_subscriptions
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "users_manage_own_subscriptions" ON public.user_push_subscriptions
  TO authenticated 
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- push_tokens: Service role full, users manage their own tokens
CREATE POLICY "service_role_all_push_tokens" ON public.push_tokens
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "users_manage_own_push_tokens" ON public.push_tokens
  TO authenticated 
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- Grant execute permissions on helper function
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO service_role;

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON FUNCTION public.is_admin() IS 'Helper function to check if current user is an admin. Adjust logic based on your admin detection mechanism.';

COMMIT;
