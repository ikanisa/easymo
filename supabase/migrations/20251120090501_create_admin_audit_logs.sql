BEGIN;

-- Migration: Create admin_audit_logs table
-- Purpose: Create admin_audit_logs table used by Edge Function audit entries.
-- This table tracks administrative actions for accountability.

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  actor text NOT NULL,
  action text NOT NULL,
  changed_keys jsonb,
  ip text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create index for faster lookups by created_at
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at 
  ON public.admin_audit_logs (created_at DESC);

-- Create index for faster lookups by actor
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_actor 
  ON public.admin_audit_logs (actor);

-- Enable RLS on admin_audit_logs
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Only service role can write to audit logs
-- Authenticated admins can read audit logs
DROP POLICY IF EXISTS "service_role_insert_audit_logs" ON public.admin_audit_logs;
CREATE POLICY "service_role_insert_audit_logs" 
  ON public.admin_audit_logs 
  FOR INSERT 
  TO service_role 
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_audit_logs" ON public.admin_audit_logs;
CREATE POLICY "authenticated_read_audit_logs" 
  ON public.admin_audit_logs 
  FOR SELECT 
  TO authenticated 
  USING (true);

-- Grant necessary permissions
GRANT SELECT ON public.admin_audit_logs TO authenticated;
GRANT INSERT ON public.admin_audit_logs TO service_role;

COMMIT;
