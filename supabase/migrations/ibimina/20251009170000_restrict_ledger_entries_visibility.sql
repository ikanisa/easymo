-- Drop overly permissive policy
DROP POLICY IF EXISTS "Users can view ledger entries" ON public.ledger_entries;
-- Helper to determine account visibility for a user
CREATE OR REPLACE FUNCTION public.can_user_access_account(_account_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.accounts a
    WHERE a.id = _account_id
      AND (
        public.has_role(_user_id, 'SYSTEM_ADMIN')
        OR (
          a.owner_type = 'SACCO'
          AND a.owner_id = public.get_user_sacco(_user_id)
        )
        OR (
          a.owner_type = 'IKIMINA'
          AND EXISTS (
            SELECT 1
            FROM public.ibimina i
            WHERE i.id = a.owner_id::UUID
              AND i.sacco_id = public.get_user_sacco(_user_id)
          )
        )
        OR (
          a.owner_type = 'MEMBER'
          AND EXISTS (
            SELECT 1
            FROM public.ikimina_members m
            JOIN public.ibimina i ON i.id = m.ikimina_id
            WHERE m.id = a.owner_id::UUID
              AND i.sacco_id = public.get_user_sacco(_user_id)
          )
        )
        OR (
          a.owner_type = 'USER'
          AND a.owner_id = _user_id
        )
      )
  );
$$;
-- Restrictive policy tying ledger entries to accessible accounts
CREATE POLICY "Users can view ledger entries for accessible accounts"
  ON public.ledger_entries FOR SELECT
  USING (
    public.has_role(auth.uid(), 'SYSTEM_ADMIN')
    OR public.can_user_access_account(ledger_entries.debit_id, auth.uid())
    OR public.can_user_access_account(ledger_entries.credit_id, auth.uid())
  );
