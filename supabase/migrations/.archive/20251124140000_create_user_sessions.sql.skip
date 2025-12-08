BEGIN;

CREATE TABLE IF NOT EXISTS public.user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number TEXT NOT NULL UNIQUE,
    active_service TEXT,
    context JSONB DEFAULT '{}'::jsonb,
    last_interaction TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_phone ON public.user_sessions(phone_number);

CREATE TABLE IF NOT EXISTS public.conversation_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.user_sessions(id) ON DELETE CASCADE,
    service TEXT NOT NULL,
    state JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversation_states_session_service
    ON public.conversation_states(session_id, service);

CREATE OR REPLACE FUNCTION public.touch_user_session_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_touch_user_sessions'
    ) THEN
        CREATE TRIGGER trg_touch_user_sessions
        BEFORE UPDATE ON public.user_sessions
        FOR EACH ROW EXECUTE FUNCTION public.touch_user_session_updated_at();
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_touch_conversation_states'
    ) THEN
        CREATE TRIGGER trg_touch_conversation_states
        BEFORE UPDATE ON public.conversation_states
        FOR EACH ROW EXECUTE FUNCTION public.touch_user_session_updated_at();
    END IF;
END $$;

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_states ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'user_sessions'
        AND policyname = 'service_role_user_sessions'
    ) THEN
        CREATE POLICY service_role_user_sessions
        ON public.user_sessions
        FOR ALL USING (auth.role() = 'service_role');
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'conversation_states'
        AND policyname = 'service_role_conversation_states'
    ) THEN
        CREATE POLICY service_role_conversation_states
        ON public.conversation_states
        FOR ALL USING (auth.role() = 'service_role');
    END IF;
END $$;

GRANT ALL ON public.user_sessions TO service_role;
GRANT ALL ON public.conversation_states TO service_role;

COMMIT;
