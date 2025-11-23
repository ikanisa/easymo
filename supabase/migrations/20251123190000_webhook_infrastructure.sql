BEGIN;

-- ============================================
-- COMPREHENSIVE WEBHOOK INFRASTRUCTURE
-- ============================================
-- High-performance webhook processing system with:
-- - Queue management with priorities and retries
-- - Full message tracking and conversation state
-- - Idempotency and rate limiting
-- - Comprehensive observability
-- Following GROUND_RULES.md: observability, security
-- ============================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- ============================================
-- WEBHOOK QUEUE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS webhook_queue (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  source text NOT NULL DEFAULT 'whatsapp',
  payload jsonb NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'dead')),
  priority integer DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  retry_count integer DEFAULT 0,
  max_retries integer DEFAULT 3,
  error_message text,
  error_details jsonb,
  correlation_id uuid DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  next_retry_at timestamptz,
  
  -- Partitioning by month for better performance
  partition_key text GENERATED ALWAYS AS (to_char(created_at, 'YYYY_MM')) STORED
) PARTITION BY LIST (partition_key);

-- Create partitions for next 6 months
DO $$
DECLARE
  i integer;
  partition_date date;
  partition_name text;
  partition_key text;
BEGIN
  FOR i IN 0..5 LOOP
    partition_date := date_trunc('month', CURRENT_DATE) + (i || ' months')::interval;
    partition_key := to_char(partition_date, 'YYYY_MM');
    partition_name := 'webhook_queue_' || partition_key;
    
    EXECUTE format('
      CREATE TABLE IF NOT EXISTS %I PARTITION OF webhook_queue
      FOR VALUES IN (%L)',
      partition_name, partition_key
    );
  END LOOP;
END $$;

-- Indexes for webhook_queue
CREATE INDEX IF NOT EXISTS idx_webhook_queue_status_retry 
  ON webhook_queue(status, next_retry_at) 
  WHERE status IN ('pending', 'failed');
  
CREATE INDEX IF NOT EXISTS idx_webhook_queue_correlation_id 
  ON webhook_queue(correlation_id);

CREATE INDEX IF NOT EXISTS idx_webhook_queue_created_at 
  ON webhook_queue(created_at DESC);

-- ============================================
-- CONVERSATIONS TABLE ENHANCEMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS conversations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number text NOT NULL,
  wa_contact_id text UNIQUE,
  display_name text,
  profile_picture_url text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'archived', 'blocked')),
  metadata jsonb DEFAULT '{}'::jsonb,
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_message_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_conversations_phone ON conversations(phone_number);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_conversations_tags ON conversations USING gin(tags);

-- ============================================
-- CONVERSATION STATES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS conversation_states (
  conversation_id uuid PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,
  current_state text NOT NULL DEFAULT 'idle',
  previous_state text,
  state_data jsonb DEFAULT '{}'::jsonb,
  state_history jsonb DEFAULT '[]'::jsonb,
  context jsonb DEFAULT '{}'::jsonb,
  last_activity timestamptz DEFAULT now(),
  expires_at timestamptz,
  lock_token uuid,
  locked_until timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversation_states_current ON conversation_states(current_state);
CREATE INDEX IF NOT EXISTS idx_conversation_states_expires ON conversation_states(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conversation_states_locked ON conversation_states(locked_until) WHERE locked_until IS NOT NULL;

-- ============================================
-- MESSAGES TABLE WITH FULL TRACKING
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  wa_message_id text UNIQUE,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  type text NOT NULL CHECK (type IN ('text', 'image', 'document', 'audio', 'video', 'location', 'contacts', 'interactive', 'template', 'reaction', 'sticker')),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed', 'deleted')),
  status_history jsonb DEFAULT '[]'::jsonb,
  
  -- Message content
  text_body text,
  media_url text,
  media_mime_type text,
  media_sha256 text,
  media_size bigint,
  caption text,
  
  -- Template message data
  template_name text,
  template_language text,
  template_parameters jsonb,
  
  -- Interactive message data
  interactive_type text,
  interactive_payload jsonb,
  
  -- Location data
  location_latitude numeric,
  location_longitude numeric,
  location_name text,
  location_address text,
  
  -- Reaction data
  reaction_message_id text,
  reaction_emoji text,
  
  -- Metadata
  metadata jsonb DEFAULT '{}'::jsonb,
  context_message_id text,
  forwarded boolean DEFAULT false,
  forwarded_many boolean DEFAULT false,
  broadcast boolean DEFAULT false,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  failed_at timestamptz,
  deleted_at timestamptz,
  
  -- Error tracking
  error_code text,
  error_message text,
  retry_count integer DEFAULT 0,
  
  -- Performance
  processing_time_ms integer,
  
  -- Partitioning by month
  partition_key text GENERATED ALWAYS AS (to_char(created_at, 'YYYY_MM')) STORED
) PARTITION BY LIST (partition_key);

-- Create message partitions
DO $$
DECLARE
  i integer;
  partition_date date;
  partition_name text;
  partition_key text;
BEGIN
  FOR i IN 0..5 LOOP
    partition_date := date_trunc('month', CURRENT_DATE) + (i || ' months')::interval;
    partition_key := to_char(partition_date, 'YYYY_MM');
    partition_name := 'messages_' || partition_key;
    
    EXECUTE format('
      CREATE TABLE IF NOT EXISTS %I PARTITION OF messages
      FOR VALUES IN (%L)',
      partition_name, partition_key
    );
  END LOOP;
END $$;

-- Comprehensive indexes for messages
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_wa_id ON messages(wa_message_id) WHERE wa_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status) WHERE status IN ('pending', 'failed');
CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(type);
CREATE INDEX IF NOT EXISTS idx_messages_direction ON messages(direction);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

-- ============================================
-- WEBHOOK SIGNATURES TABLE (for verification)
-- ============================================
CREATE TABLE IF NOT EXISTS webhook_signatures (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  signature_hash text NOT NULL,
  webhook_id uuid REFERENCES webhook_queue(id),
  verified boolean DEFAULT false,
  verification_error text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_signatures_hash ON webhook_signatures(signature_hash);
CREATE INDEX IF NOT EXISTS idx_webhook_signatures_created ON webhook_signatures(created_at DESC);

-- ============================================
-- RATE LIMITING TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS rate_limits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  identifier text NOT NULL, -- IP, phone number, or API key
  bucket text NOT NULL, -- 'webhook', 'api', etc.
  tokens integer NOT NULL DEFAULT 0,
  max_tokens integer NOT NULL DEFAULT 100,
  refill_rate integer NOT NULL DEFAULT 10, -- tokens per second
  last_refill timestamptz DEFAULT now(),
  blocked_until timestamptz,
  violation_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(identifier, bucket)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier_bucket ON rate_limits(identifier, bucket);
CREATE INDEX IF NOT EXISTS idx_rate_limits_blocked ON rate_limits(blocked_until) WHERE blocked_until IS NOT NULL;

-- ============================================
-- IDEMPOTENCY KEYS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key text PRIMARY KEY,
  response jsonb NOT NULL,
  status_code integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_keys(expires_at);

-- ============================================
-- METRICS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS webhook_metrics (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  metric_type text NOT NULL,
  metric_name text NOT NULL,
  metric_value numeric NOT NULL,
  tags jsonb DEFAULT '{}'::jsonb,
  timestamp timestamptz DEFAULT now(),
  
  -- Time-series optimization
  time_bucket timestamptz GENERATED ALWAYS AS (date_trunc('minute', timestamp)) STORED
);

CREATE INDEX IF NOT EXISTS idx_metrics_type_name_time ON webhook_metrics(metric_type, metric_name, time_bucket DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_tags ON webhook_metrics USING gin(tags);

-- ============================================
-- STORED PROCEDURES
-- ============================================

-- Function to process webhook with idempotency
CREATE OR REPLACE FUNCTION process_webhook_idempotent(
  p_wa_message_id text,
  p_payload jsonb
) RETURNS jsonb AS $$
DECLARE
  v_existing_id uuid;
  v_message_id uuid;
  v_conversation_id uuid;
BEGIN
  -- Check if message already exists
  SELECT id INTO v_existing_id
  FROM messages
  WHERE wa_message_id = p_wa_message_id;
  
  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'duplicate',
      'message_id', v_existing_id
    );
  END IF;
  
  -- Get or create conversation
  SELECT id INTO v_conversation_id
  FROM conversations
  WHERE phone_number = p_payload->>'from'
  LIMIT 1;
  
  IF v_conversation_id IS NULL THEN
    INSERT INTO conversations (phone_number)
    VALUES (p_payload->>'from')
    RETURNING id INTO v_conversation_id;
  END IF;
  
  -- Insert new message
  INSERT INTO messages (
    wa_message_id,
    conversation_id,
    direction,
    type,
    text_body,
    metadata
  ) VALUES (
    p_wa_message_id,
    v_conversation_id,
    'inbound',
    COALESCE(p_payload->>'type', 'text'),
    p_payload->'text'->>'body',
    p_payload
  )
  RETURNING id INTO v_message_id;
  
  -- Update conversation last_message_at
  UPDATE conversations
  SET last_message_at = now(), updated_at = now()
  WHERE id = v_conversation_id;
  
  RETURN jsonb_build_object(
    'status', 'processed',
    'message_id', v_message_id,
    'conversation_id', v_conversation_id
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'status', 'duplicate',
      'error', 'unique_violation'
    );
END;
$$ LANGUAGE plpgsql;

-- Function to update message status with history
CREATE OR REPLACE FUNCTION update_message_status(
  p_wa_message_id text,
  p_new_status text,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS void AS $$
BEGIN
  UPDATE messages 
  SET 
    status = p_new_status,
    status_history = status_history || jsonb_build_object(
      'status', p_new_status,
      'timestamp', now(),
      'metadata', p_metadata
    ),
    delivered_at = CASE WHEN p_new_status = 'delivered' THEN now() ELSE delivered_at END,
    read_at = CASE WHEN p_new_status = 'read' THEN now() ELSE read_at END,
    failed_at = CASE WHEN p_new_status = 'failed' THEN now() ELSE failed_at END,
    updated_at = now()
  WHERE wa_message_id = p_wa_message_id;
END;
$$ LANGUAGE plpgsql;

-- Function for rate limiting
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_identifier text,
  p_bucket text,
  p_tokens_requested integer DEFAULT 1
) RETURNS jsonb AS $$
DECLARE
  v_record rate_limits%ROWTYPE;
  v_now timestamptz := now();
  v_tokens_available integer;
  v_time_passed interval;
  v_tokens_to_add integer;
BEGIN
  -- Get or create rate limit record
  SELECT * INTO v_record
  FROM rate_limits
  WHERE identifier = p_identifier AND bucket = p_bucket
  FOR UPDATE;
  
  IF NOT FOUND THEN
    INSERT INTO rate_limits (identifier, bucket, tokens, max_tokens)
    VALUES (p_identifier, p_bucket, 100, 100)
    RETURNING * INTO v_record;
  END IF;
  
  -- Check if blocked
  IF v_record.blocked_until IS NOT NULL AND v_record.blocked_until > v_now THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'blocked_until', v_record.blocked_until,
      'reason', 'rate_limit_blocked'
    );
  END IF;
  
  -- Calculate tokens to add based on time passed
  v_time_passed := v_now - v_record.last_refill;
  v_tokens_to_add := floor(extract(epoch from v_time_passed) * v_record.refill_rate);
  v_tokens_available := least(v_record.max_tokens, v_record.tokens + v_tokens_to_add);
  
  -- Check if enough tokens
  IF v_tokens_available < p_tokens_requested THEN
    -- Increment violation count and potentially block
    UPDATE rate_limits
    SET 
      violation_count = violation_count + 1,
      blocked_until = CASE 
        WHEN violation_count >= 10 THEN v_now + interval '1 hour'
        ELSE NULL
      END,
      updated_at = v_now
    WHERE id = v_record.id;
    
    RETURN jsonb_build_object(
      'allowed', false,
      'tokens_available', v_tokens_available,
      'tokens_requested', p_tokens_requested,
      'reason', 'insufficient_tokens'
    );
  END IF;
  
  -- Consume tokens
  UPDATE rate_limits
  SET 
    tokens = v_tokens_available - p_tokens_requested,
    last_refill = v_now,
    violation_count = 0,
    updated_at = v_now
  WHERE id = v_record.id;
  
  RETURN jsonb_build_object(
    'allowed', true,
    'tokens_remaining', v_tokens_available - p_tokens_requested,
    'max_tokens', v_record.max_tokens
  );
END;
$$ LANGUAGE plpgsql;

-- Function to transition conversation state
CREATE OR REPLACE FUNCTION transition_conversation_state(
  p_conversation_id uuid,
  p_new_state text,
  p_state_data jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb AS $$
DECLARE
  v_current_state text;
  v_lock_token uuid;
BEGIN
  -- Acquire lock with timeout
  v_lock_token := gen_random_uuid();
  
  UPDATE conversation_states
  SET 
    lock_token = v_lock_token,
    locked_until = now() + interval '30 seconds'
  WHERE conversation_id = p_conversation_id
    AND (locked_until IS NULL OR locked_until < now())
  RETURNING current_state INTO v_current_state;
  
  IF NOT FOUND THEN
    -- Create new state record
    INSERT INTO conversation_states (
      conversation_id,
      current_state,
      state_data,
      lock_token,
      locked_until
    ) VALUES (
      p_conversation_id,
      p_new_state,
      p_state_data,
      v_lock_token,
      now() + interval '30 seconds'
    );
    
    RETURN jsonb_build_object(
      'success', true,
      'previous_state', null,
      'new_state', p_new_state,
      'lock_token', v_lock_token
    );
  END IF;
  
  -- Update state
  UPDATE conversation_states
  SET 
    previous_state = current_state,
    current_state = p_new_state,
    state_data = p_state_data,
    state_history = state_history || jsonb_build_object(
      'from', current_state,
      'to', p_new_state,
      'timestamp', now(),
      'data', p_state_data
    ),
    last_activity = now(),
    updated_at = now(),
    lock_token = null,
    locked_until = null
  WHERE conversation_id = p_conversation_id
    AND lock_token = v_lock_token;
  
  RETURN jsonb_build_object(
    'success', true,
    'previous_state', v_current_state,
    'new_state', p_new_state
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SCHEDULED JOBS (using pg_cron)
-- ============================================

-- Note: pg_cron jobs should be created manually via SQL after migration
-- as they persist across migrations and can cause conflicts

-- Clean old processed webhooks every hour
DO $$
BEGIN
  PERFORM cron.schedule(
    'cleanup-old-webhooks',
    '0 * * * *',
    $$
    DELETE FROM webhook_queue
    WHERE status = 'completed'
      AND completed_at < now() - interval '7 days';
    $$
  );
EXCEPTION
  WHEN duplicate_object THEN
    -- Job already exists, skip
    NULL;
END $$;

-- Clean expired idempotency keys every hour
DO $$
BEGIN
  PERFORM cron.schedule(
    'cleanup-idempotency-keys',
    '0 * * * *',
    $$
    DELETE FROM idempotency_keys
    WHERE expires_at < now();
    $$
  );
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_queue ENABLE ROW LEVEL SECURITY;

-- Service role policies (full access)
CREATE POLICY IF NOT EXISTS "Service role can manage all conversations"
  ON conversations
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY IF NOT EXISTS "Service role can manage all messages"
  ON messages
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY IF NOT EXISTS "Service role can manage all conversation states"
  ON conversation_states
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY IF NOT EXISTS "Service role can manage all webhook queue"
  ON webhook_queue
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

COMMIT;
