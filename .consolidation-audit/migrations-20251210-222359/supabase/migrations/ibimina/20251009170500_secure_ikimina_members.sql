-- Restrict direct access to unmasked ikimina member data
DROP POLICY IF EXISTS "Users can view members in their SACCO's ibimina" ON public.ikimina_members;
CREATE POLICY "System admins can view ikimina members"
  ON public.ikimina_members FOR SELECT
  USING (public.has_role(auth.uid(), 'SYSTEM_ADMIN'));
DROP VIEW IF EXISTS public.ikimina_members_public;
CREATE VIEW public.ikimina_members_public
WITH (security_barrier = true)
AS
SELECT
  m.id,
  m.ikimina_id,
  m.member_code,
  m.full_name,
  m.status,
  m.joined_at,
  m.msisdn_masked AS msisdn,
  m.national_id_masked AS national_id,
  i.name AS ikimina_name,
  i.sacco_id
FROM public.ikimina_members m
JOIN public.ibimina i ON i.id = m.ikimina_id
WHERE
  public.has_role(auth.uid(), 'SYSTEM_ADMIN')
  OR i.sacco_id = public.get_user_sacco(auth.uid());
GRANT SELECT ON public.ikimina_members_public TO authenticated;
GRANT SELECT ON public.ikimina_members_public TO service_role;
