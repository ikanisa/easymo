-- Migration: AI Agent Infrastructure (Autonomous Multi-tenant Customer Support)
-- Description: Knowledge bases, tickets, and conversation management for AI agent
-- Date: 2025-10-31

-- Enable pgvector extension for RAG embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Organization-specific knowledge base (SACCO-specific help articles)
-- Note: org_id references are conditional - table will be created properly after organizations table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organizations') THEN
    EXECUTE '
      CREATE TABLE IF NOT EXISTS public.org_kb (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        tags TEXT[] DEFAULT ''{}''::text[],
        embedding vector(1536),
        policy_tag TEXT,
        created_by UUID REFERENCES auth.users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )';
  ELSE
    -- Create without FK constraint; will be added by later migration
    EXECUTE '
      CREATE TABLE IF NOT EXISTS public.org_kb (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        tags TEXT[] DEFAULT ''{}''::text[],
        embedding vector(1536),
        policy_tag TEXT,
        created_by UUID REFERENCES auth.users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )';
  END IF;
END $$;

-- Ensure embedding column exists (in case table was created without it)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'org_kb' AND column_name = 'embedding') THEN
    ALTER TABLE public.org_kb ADD COLUMN embedding vector(1536);
  END IF;
END $$;

-- Create vector index for similarity search
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'org_kb' AND column_name = 'embedding') THEN
    CREATE INDEX IF NOT EXISTS idx_org_kb_embedding ON public.org_kb USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_org_kb_org_id ON public.org_kb(org_id);
CREATE INDEX IF NOT EXISTS idx_org_kb_tags ON public.org_kb USING GIN(tags);

-- Global knowledge base (system-wide policies, USSD best practices, etc.)
CREATE TABLE IF NOT EXISTS public.global_kb (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  embedding vector(1536),
  policy_tag TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_global_kb_embedding ON public.global_kb USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_global_kb_tags ON public.global_kb USING GIN(tags);

-- FAQ table (common Q&A)
CREATE TABLE IF NOT EXISTS public.faq (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE, -- NULL = global FAQ
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  embedding vector(1536),
  view_count INTEGER DEFAULT 0,
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_faq_embedding ON public.faq USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_faq_org_id ON public.faq(org_id);
CREATE INDEX IF NOT EXISTS idx_faq_tags ON public.faq USING GIN(tags);

-- Tickets table (multi-channel support tickets)
CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  channel TEXT CHECK (channel IN ('in_app', 'whatsapp', 'email', 'ivr')) NOT NULL,
  subject TEXT NOT NULL,
  status TEXT CHECK (status IN ('open', 'pending', 'resolved', 'closed')) NOT NULL DEFAULT 'open',
  priority TEXT CHECK (priority IN ('low', 'normal', 'high', 'urgent')) DEFAULT 'normal',
  meta JSONB DEFAULT '{}'::jsonb, -- e.g., {"reference_token": "...", "group_id": "...", "whatsapp_number": "..."}
  assigned_to UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tickets_org_id ON public.tickets(org_id);
CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON public.tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_channel ON public.tickets(channel);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON public.tickets(assigned_to);

-- Ticket messages (conversation history)
CREATE TABLE IF NOT EXISTS public.ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  sender TEXT CHECK (sender IN ('user', 'agent', 'staff')) NOT NULL,
  content TEXT NOT NULL,
  attachments JSONB DEFAULT '[]'::jsonb, -- Array of signed URLs
  metadata JSONB DEFAULT '{}'::jsonb, -- Agent metadata, tool calls, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id ON public.ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_sender ON public.ticket_messages(sender);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_created_at ON public.ticket_messages(created_at DESC);

-- Enable RLS on all tables
ALTER TABLE public.org_kb ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_kb ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faq ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for org_kb
CREATE POLICY "Staff can manage their org KB"
  ON public.org_kb
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships
      WHERE org_id = org_kb.org_id
      AND user_id = auth.uid()
    )
  );

-- RLS Policies for global_kb (admin only for write, read-only for authenticated)
CREATE POLICY "Admins manage global KB"
  ON public.global_kb
  FOR ALL
  USING (public.has_role(auth.uid(), 'SYSTEM_ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'SYSTEM_ADMIN'));

CREATE POLICY "Authenticated users can read global KB"
  ON public.global_kb
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- RLS Policies for FAQ
CREATE POLICY "Staff can manage their org FAQ"
  ON public.faq
  FOR ALL
  USING (
    org_id IS NULL AND public.has_role(auth.uid(), 'SYSTEM_ADMIN')
    OR EXISTS (
      SELECT 1 FROM public.org_memberships
      WHERE org_id = faq.org_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can read FAQ"
  ON public.faq
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- RLS Policies for tickets
CREATE POLICY "Users can view their own tickets"
  ON public.tickets
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create tickets"
  ON public.tickets
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Staff can view their org tickets"
  ON public.tickets
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships
      WHERE org_id = tickets.org_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can update their org tickets"
  ON public.tickets
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships
      WHERE org_id = tickets.org_id
      AND user_id = auth.uid()
    )
  );

-- RLS Policies for ticket_messages
CREATE POLICY "Users can view messages for their tickets"
  ON public.ticket_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets
      WHERE id = ticket_messages.ticket_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add messages to their tickets"
  ON public.ticket_messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tickets
      WHERE id = ticket_messages.ticket_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can view messages for org tickets"
  ON public.ticket_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
      INNER JOIN public.org_memberships om ON om.org_id = t.org_id
      WHERE t.id = ticket_messages.ticket_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can add messages to org tickets"
  ON public.ticket_messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tickets t
      INNER JOIN public.org_memberships om ON om.org_id = t.org_id
      WHERE t.id = ticket_messages.ticket_id
      AND om.user_id = auth.uid()
    )
  );

-- Add updated_at triggers
DROP TRIGGER IF EXISTS update_org_kb_updated_at ON public.org_kb;
CREATE TRIGGER update_org_kb_updated_at
  BEFORE UPDATE ON public.org_kb
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_global_kb_updated_at ON public.global_kb;
CREATE TRIGGER update_global_kb_updated_at
  BEFORE UPDATE ON public.global_kb
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_faq_updated_at ON public.faq;
CREATE TRIGGER update_faq_updated_at
  BEFORE UPDATE ON public.faq
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_tickets_updated_at ON public.tickets;
CREATE TRIGGER update_tickets_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Grant permissions
GRANT SELECT ON public.org_kb TO authenticated;
GRANT SELECT ON public.global_kb TO authenticated;
GRANT SELECT ON public.faq TO authenticated;
GRANT ALL ON public.tickets TO authenticated;
GRANT ALL ON public.ticket_messages TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- Comments
COMMENT ON TABLE public.org_kb IS 'Organization-specific knowledge base for AI agent RAG';
COMMENT ON TABLE public.global_kb IS 'Global knowledge base with system-wide policies and best practices';
COMMENT ON TABLE public.faq IS 'Frequently asked questions with embeddings for semantic search';
COMMENT ON TABLE public.tickets IS 'Multi-channel support tickets (in-app, WhatsApp, email, IVR)';
COMMENT ON TABLE public.ticket_messages IS 'Conversation history for support tickets';
COMMENT ON COLUMN public.org_kb.embedding IS 'Vector embedding for RAG similarity search (OpenAI text-embedding-3-large)';
COMMENT ON COLUMN public.tickets.meta IS 'Ticket metadata: reference_token, group_id, whatsapp_number, etc.';
COMMENT ON COLUMN public.ticket_messages.metadata IS 'Agent metadata: tool calls, confidence scores, citations, etc.';
