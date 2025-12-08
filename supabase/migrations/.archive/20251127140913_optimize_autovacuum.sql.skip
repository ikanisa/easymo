-- Optimize Auto-Vacuum Settings for High-Traffic Tables
-- Improves write performance and reduces table bloat

BEGIN;

-- High-traffic event/log tables: Aggressive vacuum
ALTER TABLE IF EXISTS wa_events SET (
  autovacuum_vacuum_scale_factor = 0.05,  -- Vacuum at 5% dead tuples (was 20%)
  autovacuum_analyze_scale_factor = 0.02, -- Analyze at 2% changes (was 10%)
  autovacuum_vacuum_cost_delay = 5,       -- Faster vacuum
  autovacuum_naptime = 30                  -- Check every 30 seconds
);

ALTER TABLE IF EXISTS whatsapp_messages SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_vacuum_cost_delay = 5
);

ALTER TABLE IF EXISTS webhook_logs SET (
  autovacuum_vacuum_scale_factor = 0.1,   -- Very aggressive for logs
  autovacuum_analyze_scale_factor = 0.05
);

ALTER TABLE IF EXISTS processed_webhook_messages SET (
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_scale_factor = 0.05
);

ALTER TABLE IF EXISTS conversation_history SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);

-- Transaction tables: Moderate vacuum
ALTER TABLE IF EXISTS marketplace_transactions SET (
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_scale_factor = 0.05
);

ALTER TABLE IF EXISTS momo_transactions SET (
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_scale_factor = 0.05
);

-- Voice/events: Moderate vacuum
ALTER TABLE IF EXISTS voice_events SET (
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_scale_factor = 0.05
);

ALTER TABLE IF EXISTS unified_agent_events SET (
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_scale_factor = 0.05
);

-- DLQ table: Moderate vacuum
ALTER TABLE IF EXISTS webhook_dlq SET (
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_scale_factor = 0.05
);

-- Add comment for documentation
COMMENT ON TABLE wa_events IS 
  'WhatsApp webhook events. Auto-vacuum tuned for high write volume (5% threshold).';

COMMENT ON TABLE whatsapp_messages IS 
  'WhatsApp messages. Auto-vacuum tuned for high write volume (5% threshold).';

COMMIT;
