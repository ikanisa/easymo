BEGIN;

-- Enable RLS on all public tables that currently have it disabled
-- This addresses security lint errors: rls_disabled_in_public

-- Menu & Items
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

-- Authentication & Admin
ALTER TABLE public.admin_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_qr_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_logs ENABLE ROW LEVEL SECURITY;

-- SMS & Communication
ALTER TABLE public.sms_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_parsed ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_review_queue ENABLE ROW LEVEL SECURITY;

-- Financial
ALTER TABLE public.reconciliation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;

-- Organizations & Members
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- Share Allocations
ALTER TABLE public.share_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allocation_export_requests ENABLE ROW LEVEL SECURITY;

-- Wallets
ALTER TABLE public.wallet_accounts_ibimina ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions_ibimina ENABLE ROW LEVEL SECURITY;

-- Configuration & System
ALTER TABLE public.configuration ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_feature_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_counters ENABLE ROW LEVEL SECURITY;

-- Analytics & Notifications
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- Spatial (PostGIS system table)
ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;

COMMIT;
