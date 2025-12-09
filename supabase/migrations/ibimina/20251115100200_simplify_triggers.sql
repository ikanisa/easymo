-- Migration: Simplify and Optimize Triggers
-- Description: Refactors triggers to simplify logic and improve maintainability
-- Part of backend refactoring initiative.

-- Optimize handle_public_user_insert trigger function
-- Simplify the logic and add better error handling
CREATE OR REPLACE FUNCTION public.handle_public_user_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $$
DECLARE
  desired_role app_role;
BEGIN
  -- Use COALESCE with explicit default
  desired_role := COALESCE(NEW.role, 'SACCO_STAFF'::app_role);
  
  -- Insert or update user profile
  INSERT INTO app.user_profiles(user_id, role, sacco_id)
  VALUES (NEW.id, desired_role, NEW.sacco_id)
  ON CONFLICT (user_id) DO UPDATE
  SET 
    role = EXCLUDED.role,
    sacco_id = COALESCE(EXCLUDED.sacco_id, app.user_profiles.sacco_id),
    updated_at = timezone('UTC', now());
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error and re-raise it
    RAISE WARNING 'Error in handle_public_user_insert for user %: %', NEW.id, SQLERRM;
    RAISE;
END;
$$;

COMMENT ON FUNCTION public.handle_public_user_insert() IS 
  'Simplified trigger function to handle user inserts into public.users view. Includes error handling and logging.';

-- Optimize set_updated_at trigger function
-- Add IMMUTABLE timestamp function for better performance
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := timezone('UTC', now());
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_updated_at() IS 
  'Simple trigger function to set updated_at timestamp on record updates.';

-- Optimize app.handle_new_auth_user trigger function
-- Add error handling and better conflict resolution
CREATE OR REPLACE FUNCTION app.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'app', 'public'
AS $$
BEGIN
  -- Insert new user profile with default role
  INSERT INTO app.user_profiles(user_id, role, sacco_id)
  VALUES (NEW.id, 'SACCO_STAFF', NULL)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the auth operation
    RAISE WARNING 'Error in handle_new_auth_user for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION app.handle_new_auth_user() IS 
  'Simplified trigger function to create user profile on auth.users insert. Includes error handling to prevent auth failures.';
