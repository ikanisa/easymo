-- =====================================================
-- ENHANCED WEBHOOK PROCESSING TABLES
-- =====================================================

-- 1. Processed Webhook Messages (Idempotency)
CREATE TABLE IF NOT EXISTS public.processed_webhook_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    whatsapp_message_id TEXT NOT NULL,
    conversation_id UUID,
    correlation_id TEXT,
    processing_time_ms INTEGER,
    payload JSONB,
    processed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_processed_webhook_messages_wa_id 
ON public.processed_webhook_messages(whatsapp_message_id);

CREATE INDEX IF NOT EXISTS idx_processed_webhook_messages_conversation_id 
ON public.processed_webhook_messages(conversation_id);

-- 2. Webhook Conversations (State Management)
CREATE TABLE IF NOT EXISTS public.webhook_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    whatsapp_phone TEXT NOT NULL,
    agent_type TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    metadata JSONB DEFAULT '{}'::jsonb,
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Locking mechanism fields
    lock_id TEXT,
    locked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_webhook_conversations_user_id 
ON public.webhook_conversations(user_id);

CREATE INDEX IF NOT EXISTS idx_webhook_conversations_phone 
ON public.webhook_conversations(whatsapp_phone);

CREATE INDEX IF NOT EXISTS idx_webhook_conversations_status 
ON public.webhook_conversations(status);

-- 3. Conversation State Transitions (Audit Trail)
CREATE TABLE IF NOT EXISTS public.conversation_state_transitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES public.webhook_conversations(id),
    from_state TEXT,
    to_state TEXT NOT NULL,
    transition_reason TEXT,
    correlation_id TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversation_transitions_conv_id 
ON public.conversation_state_transitions(conversation_id);

-- 4. Webhook Dead Letter Queue (Error Handling)
CREATE TABLE IF NOT EXISTS public.webhook_dlq (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payload JSONB,
    error TEXT,
    error_stack TEXT,
    correlation_id TEXT,
    whatsapp_message_id TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    next_retry_at TIMESTAMPTZ,
    resolution_status TEXT DEFAULT 'pending', -- pending, resolved, failed, ignored
    resolution_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_dlq_status 
ON public.webhook_dlq(resolution_status);

CREATE INDEX IF NOT EXISTS idx_webhook_dlq_next_retry 
ON public.webhook_dlq(next_retry_at) 
WHERE resolution_status = 'pending';

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE public.processed_webhook_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_state_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_dlq ENABLE ROW LEVEL SECURITY;

-- Service role access (Edge Functions)
CREATE POLICY service_role_processed_messages ON public.processed_webhook_messages
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);

CREATE POLICY service_role_conversations ON public.webhook_conversations
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);

CREATE POLICY service_role_transitions ON public.conversation_state_transitions
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);

CREATE POLICY service_role_dlq ON public.webhook_dlq
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);

-- Grants
GRANT ALL ON TABLE public.processed_webhook_messages TO service_role;
GRANT ALL ON TABLE public.webhook_conversations TO service_role;
GRANT ALL ON TABLE public.conversation_state_transitions TO service_role;
GRANT ALL ON TABLE public.webhook_dlq TO service_role;

-- =====================================================
-- FUNCTIONS (RPCs)
-- =====================================================

-- Acquire Conversation Lock
CREATE OR REPLACE FUNCTION public.acquire_conversation_lock(
    p_conversation_id UUID,
    p_lock_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_locked BOOLEAN;
BEGIN
    -- Try to acquire lock if not locked or lock expired (2 mins)
    UPDATE public.webhook_conversations
    SET 
        lock_id = p_lock_id,
        locked_at = NOW()
    WHERE 
        id = p_conversation_id
        AND (
            lock_id IS NULL 
            OR locked_at < NOW() - INTERVAL '2 minutes'
            OR lock_id = p_lock_id
        )
    RETURNING TRUE INTO v_locked;

    RETURN COALESCE(v_locked, FALSE);
END;
$$;

-- Release Conversation Lock
CREATE OR REPLACE FUNCTION public.release_conversation_lock(
    p_conversation_id UUID,
    p_lock_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_released BOOLEAN;
BEGIN
    UPDATE public.webhook_conversations
    SET 
        lock_id = NULL,
        locked_at = NULL
    WHERE 
        id = p_conversation_id
        AND lock_id = p_lock_id
    RETURNING TRUE INTO v_released;

    RETURN COALESCE(v_released, FALSE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.acquire_conversation_lock TO service_role;
GRANT EXECUTE ON FUNCTION public.release_conversation_lock TO service_role;
