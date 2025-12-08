BEGIN;

-- Migration 6: Waiter AI tables for conversational ordering

-- Create waiter_conversations table to track AI chat sessions
CREATE TABLE IF NOT EXISTS public.waiter_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID NOT NULL,
  visitor_phone TEXT NOT NULL,
  visitor_name TEXT,
  dine_in_table TEXT,
  session_state TEXT NOT NULL DEFAULT 'active' CHECK (session_state IN ('active', 'ordering', 'checkout', 'completed', 'abandoned')),
  cart JSONB DEFAULT '[]',
  total_amount DECIMAL(10, 2) DEFAULT 0,
  currency TEXT DEFAULT 'RWF',
  ai_context JSONB DEFAULT '{}',
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  
  -- Foreign key to bars table
  CONSTRAINT fk_waiter_conv_bar FOREIGN KEY (bar_id) REFERENCES public.bars(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_waiter_conv_bar_id ON public.waiter_conversations(bar_id);
CREATE INDEX IF NOT EXISTS idx_waiter_conv_phone ON public.waiter_conversations(visitor_phone);
CREATE INDEX IF NOT EXISTS idx_waiter_conv_state ON public.waiter_conversations(session_state);
CREATE INDEX IF NOT EXISTS idx_waiter_conv_active ON public.waiter_conversations(bar_id, visitor_phone, session_state) 
  WHERE session_state IN ('active', 'ordering', 'checkout');

-- Enable RLS
ALTER TABLE public.waiter_conversations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "waiter_conv_read_bar_owner" ON public.waiter_conversations;
DROP POLICY IF EXISTS "waiter_conv_read_bar_owner" ON public.waiter_conversations;
CREATE POLICY "waiter_conv_read_bar_owner" ON public.waiter_conversations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bar_managers bm
      WHERE bm.bar_id = waiter_conversations.bar_id
        AND bm.user_id = auth.uid()
        AND bm.is_active = true
    )
  );

DROP POLICY IF EXISTS "waiter_conv_insert_bar_owner" ON public.waiter_conversations;
DROP POLICY IF EXISTS "waiter_conv_insert_bar_owner" ON public.waiter_conversations;
CREATE POLICY "waiter_conv_insert_bar_owner" ON public.waiter_conversations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bar_managers bm
      WHERE bm.bar_id = bar_id
        AND bm.user_id = auth.uid()
        AND bm.is_active = true
    )
  );

-- Add Waiter AI columns to orders table if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'waiter_session_id') THEN
      ALTER TABLE public.orders ADD COLUMN waiter_session_id UUID REFERENCES public.waiter_conversations(id) ON DELETE SET NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'visitor_phone') THEN
      ALTER TABLE public.orders ADD COLUMN visitor_phone TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'dine_in_table') THEN
      ALTER TABLE public.orders ADD COLUMN dine_in_table TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'bar_notified') THEN
      ALTER TABLE public.orders ADD COLUMN bar_notified BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'payment_ussd_code') THEN
      ALTER TABLE public.orders ADD COLUMN payment_ussd_code TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'payment_link') THEN
      ALTER TABLE public.orders ADD COLUMN payment_link TEXT;
    END IF;
    
    -- Create index on waiter_session_id
    CREATE INDEX IF NOT EXISTS idx_orders_waiter_session ON public.orders(waiter_session_id) WHERE waiter_session_id IS NOT NULL;
  END IF;
END $$;

COMMIT;
