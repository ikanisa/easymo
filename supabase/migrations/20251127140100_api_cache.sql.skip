BEGIN;

-- =====================================================
-- API Cache Table for Google Places
-- =====================================================

CREATE TABLE IF NOT EXISTS api_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE INDEX idx_api_cache_key ON api_cache(key);
CREATE INDEX idx_api_cache_expires ON api_cache(expires_at);

COMMENT ON TABLE api_cache IS 'Cache for external API calls (Google Places, etc.)';

-- Auto-cleanup expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM api_cache
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-api-cache', '0 3 * * *', 'SELECT cleanup_expired_cache()');

COMMIT;
