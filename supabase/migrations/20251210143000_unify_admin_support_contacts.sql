BEGIN;

-- Migration: Unify All Admin/Support Contacts
-- Purpose: Make insurance_admin_contacts the single source of truth for ALL admin/support contact info
-- Date: 2025-12-10
-- NOTE: This migration must be safe on fresh DBs where the table is created later.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'insurance_admin_contacts'
  ) THEN

    -- Add category column
    ALTER TABLE public.insurance_admin_contacts
      ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'support';

    -- Add check constraint (only if our named one doesn't exist)
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'insurance_admin_contacts_category_check'
    ) THEN
      ALTER TABLE public.insurance_admin_contacts
        ADD CONSTRAINT insurance_admin_contacts_category_check
        CHECK (category IN ('support', 'admin_auth', 'insurance', 'general', 'escalation'));
    END IF;

    -- Add priority column
    ALTER TABLE public.insurance_admin_contacts
      ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 100;

    -- De-dup destinations before adding unique constraint (keeps one row per destination)
    DELETE FROM public.insurance_admin_contacts a
    USING public.insurance_admin_contacts b
    WHERE a.destination = b.destination
      AND a.ctid > b.ctid;

    -- Add unique constraint on destination (only if doesn't exist)
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'insurance_admin_contacts_destination_unique'
    ) THEN
      ALTER TABLE public.insurance_admin_contacts
        ADD CONSTRAINT insurance_admin_contacts_destination_unique UNIQUE (destination);
    END IF;

    -- Create index (fallback if is_active column doesn't exist yet)
    BEGIN
      CREATE INDEX IF NOT EXISTS idx_insurance_admin_contacts_category
        ON public.insurance_admin_contacts(category, is_active)
        WHERE is_active = true;
    EXCEPTION WHEN undefined_column THEN
      CREATE INDEX IF NOT EXISTS idx_insurance_admin_contacts_category
        ON public.insurance_admin_contacts(category);
    END;

    -- Normalize existing records
    UPDATE public.insurance_admin_contacts
      SET category = 'insurance'
      WHERE category IS NULL OR category = 'support';

    -- Insert admin authentication numbers (with fallback if some columns don't exist yet)
    BEGIN
      INSERT INTO public.insurance_admin_contacts (
        channel,
        destination,
        display_name,
        category,
        display_order,
        priority,
        is_active
      ) VALUES
        ('whatsapp', '+250788767816', 'Admin Team 1', 'admin_auth', 1, 10, true),
        ('whatsapp', '+35677186193',  'Admin Team 2', 'admin_auth', 2, 10, true),
        ('whatsapp', '+250795588248', 'Admin Team 3', 'admin_auth', 3, 10, true),
        ('whatsapp', '+35699742524',  'Admin Team 4', 'admin_auth', 4, 10, true)
      ON CONFLICT (destination) DO UPDATE SET
        category = EXCLUDED.category,
        display_name = EXCLUDED.display_name,
        priority = EXCLUDED.priority,
        is_active = EXCLUDED.is_active;
    EXCEPTION WHEN undefined_column THEN
      INSERT INTO public.insurance_admin_contacts (channel, destination, display_name)
      VALUES
        ('whatsapp', '+250788767816', 'Admin Team 1'),
        ('whatsapp', '+35677186193',  'Admin Team 2'),
        ('whatsapp', '+250795588248', 'Admin Team 3'),
        ('whatsapp', '+35699742524',  'Admin Team 4')
      ON CONFLICT DO NOTHING;
    END;

    -- Comments (only safe if table exists)
    COMMENT ON COLUMN public.insurance_admin_contacts.category IS
      'Category: support (general help), admin_auth (admin verification), insurance (insurance-specific), general (catch-all), escalation (urgent issues)';
    COMMENT ON COLUMN public.insurance_admin_contacts.priority IS
      'Lower number = higher priority. Used for sorting within category.';

  ELSE
    RAISE NOTICE 'Skipping 20251210143000_unify_admin_support_contacts: public.insurance_admin_contacts does not exist yet (created by a later migration).';
  END IF;
END $$;

-- Helper function: returns empty set if table not present yet
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'insurance_admin_contacts'
  ) THEN
    EXECUTE $sql$
      CREATE OR REPLACE FUNCTION public.get_admin_contacts(
        p_category TEXT DEFAULT 'support',
        p_channel TEXT DEFAULT NULL
      )
      RETURNS TABLE (
        id UUID,
        channel TEXT,
        destination TEXT,
        display_name TEXT,
        category TEXT,
        display_order INTEGER
      ) LANGUAGE plpgsql STABLE SECURITY DEFINER AS $body$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'insurance_admin_contacts'
        ) THEN
          RETURN;
        END IF;

        RETURN QUERY
        SELECT
          c.id,
          c.channel,
          c.destination,
          c.display_name,
          c.category,
          c.display_order
        FROM public.insurance_admin_contacts c
        WHERE c.is_active = true
          AND (p_category IS NULL OR c.category = p_category)
          AND (p_channel IS NULL OR c.channel = p_channel)
        ORDER BY COALESCE(c.priority, 100) ASC,
                 COALESCE(c.display_order, 9999) ASC;
      END;
      $body$;
    $sql$;

    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_admin_contacts(TEXT, TEXT) TO authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_admin_contacts(TEXT, TEXT) TO anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_admin_contacts(TEXT, TEXT) TO service_role';
    EXECUTE $comment$
      COMMENT ON FUNCTION public.get_admin_contacts IS
        'Fetches admin/support contacts filtered by category and optionally by channel'
    $comment$;
  ELSE
    RAISE NOTICE 'Skipping get_admin_contacts creation: public.insurance_admin_contacts does not exist yet.';
  END IF;
END $$;

COMMIT;
