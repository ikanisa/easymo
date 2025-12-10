-- Member app tables and policies
CREATE TYPE public.member_id_type AS ENUM ('NID', 'DL', 'PASSPORT');
CREATE TYPE public.join_request_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.group_invite_status AS ENUM ('sent', 'accepted', 'expired');
CREATE TYPE public.notification_type AS ENUM ('new_member', 'payment_confirmed', 'invite_accepted');

CREATE TABLE public.members_app_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  whatsapp_msisdn TEXT NOT NULL,
  momo_msisdn TEXT NOT NULL,
  id_type public.member_id_type,
  id_number TEXT,
  id_files JSONB,
  ocr_json JSONB,
  lang TEXT DEFAULT 'en',
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.user_saccos (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sacco_id UUID NOT NULL REFERENCES public.saccos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, sacco_id)
);

CREATE TABLE public.join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sacco_id UUID NOT NULL REFERENCES public.saccos(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.ibimina(id) ON DELETE CASCADE,
  note TEXT,
  status public.join_request_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  decided_at TIMESTAMPTZ,
  decided_by UUID REFERENCES auth.users(id)
);

CREATE TABLE public.group_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.ibimina(id) ON DELETE CASCADE,
  invitee_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_msisdn TEXT,
  token TEXT NOT NULL UNIQUE,
  status public.group_invite_status DEFAULT 'sent',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ
);

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.notification_type NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE INDEX ON public.members_app_profiles (user_id);
CREATE INDEX ON public.user_saccos (user_id);
CREATE INDEX ON public.user_saccos (sacco_id);
CREATE INDEX ON public.join_requests (user_id);
CREATE INDEX ON public.join_requests (group_id);
CREATE INDEX ON public.group_invites (token);
CREATE INDEX ON public.notifications (user_id, created_at DESC);

ALTER TABLE public.members_app_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_saccos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own profile" ON public.members_app_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Members can insert own profile" ON public.members_app_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Members can update own profile" ON public.members_app_profiles
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Members manage their SACCO list" ON public.user_saccos
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Members view their join requests" ON public.join_requests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Members create join requests" ON public.join_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Staff can manage join requests" ON public.join_requests
  FOR ALL USING (
    public.has_role(auth.uid(), 'SYSTEM_ADMIN') OR
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.sacco_id = join_requests.sacco_id
    )
  );

CREATE POLICY "Members view their invites" ON public.group_invites
  FOR SELECT USING (
    (invitee_user_id IS NOT NULL AND invitee_user_id = auth.uid())
    OR token = COALESCE(current_setting('request.jwt.claims', true), '{}')::json->>'invite_token'
  );

CREATE POLICY "Members accept their invites" ON public.group_invites
  FOR UPDATE USING (
    invitee_user_id = auth.uid()
    OR token = COALESCE(current_setting('request.jwt.claims', true), '{}')::json->>'invite_token'
  )
  WITH CHECK (
    invitee_user_id = auth.uid()
    OR token = COALESCE(current_setting('request.jwt.claims', true), '{}')::json->>'invite_token'
  );

CREATE POLICY "Service role manages invites" ON public.group_invites
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Members view their notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Members update their notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Allow members to view SACCOs they added
CREATE POLICY "Members view linked SACCOs" ON public.saccos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_saccos us
      WHERE us.sacco_id = saccos.id AND us.user_id = auth.uid()
    )
  );

-- Allow members to view ibimina in their SACCOs
CREATE POLICY "Members view ibimina via membership" ON public.ibimina
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_saccos us
      WHERE us.sacco_id = ibimina.sacco_id AND us.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'SYSTEM_ADMIN')
  );

-- Notifications insert by service role only
CREATE POLICY "Service role can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
