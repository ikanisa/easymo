-- MomoTerminal Integration Schema
-- Adds tables for nonce validation, idempotency, security audit, and webhook stats

-- 1. Webhook nonces table (replay protection)
CREATE TABLE IF NOT EXISTS webhook_nonces (
    nonce TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    received_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_webhook_nonces_expires ON webhook_nonces(expires_at);
CREATE INDEX IF NOT EXISTS idx_webhook_nonces_device ON webhook_nonces(device_id);

-- 2. Idempotency keys table
CREATE TABLE IF NOT EXISTS idempotency_keys (
    key TEXT PRIMARY KEY,
    result JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires ON idempotency_keys(expires_at);

-- 3. Security audit log
CREATE TABLE IF NOT EXISTS security_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    device_id TEXT,
    ip_address INET,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created ON security_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_device ON security_audit_log(device_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_event_type ON security_audit_log(event_type);

-- 4. Webhook delivery stats
CREATE TABLE IF NOT EXISTS webhook_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    received INTEGER DEFAULT 0,
    processed INTEGER DEFAULT 0,
    failed INTEGER DEFAULT 0,
    duplicates_blocked INTEGER DEFAULT 0,
    replay_attacks_blocked INTEGER DEFAULT 0,
    avg_latency_ms INTEGER,
    error_breakdown JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'webhook_stats'
          AND c.relkind IN ('r', 'p') -- table or partitioned table
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_webhook_stats_period ON webhook_stats(period_start DESC);
    ELSE
        RAISE NOTICE 'Skipping idx_webhook_stats_period because webhook_stats is not a table.';
    END IF;
END $$;

-- 5. Add client_transaction_id to momo_transactions if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'momo_transactions' AND column_name = 'client_transaction_id'
    ) THEN
        ALTER TABLE momo_transactions ADD COLUMN client_transaction_id UUID UNIQUE;
    END IF;
END $$;

-- 6. MomoTerminal devices table
CREATE TABLE IF NOT EXISTS momo_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id TEXT UNIQUE NOT NULL,
    merchant_id UUID REFERENCES profiles(id),
    device_name TEXT,
    app_version TEXT,
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'blocked')),
    transaction_count INTEGER DEFAULT 0,
    country_code TEXT DEFAULT 'RW' CHECK (country_code IN ('RW', 'CD', 'BI', 'TZ')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_momo_devices_merchant ON momo_devices(merchant_id);
CREATE INDEX IF NOT EXISTS idx_momo_devices_status ON momo_devices(status);
CREATE INDEX IF NOT EXISTS idx_momo_devices_last_seen ON momo_devices(last_seen_at DESC);

-- 7. Merchant webhook configurations
CREATE TABLE IF NOT EXISTS merchant_webhook_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID REFERENCES profiles(id) NOT NULL,
    endpoint_url TEXT NOT NULL,
    hmac_secret TEXT NOT NULL,
    events TEXT[] DEFAULT ARRAY['payment_received', 'payment_sent'],
    is_active BOOLEAN DEFAULT true,
    last_delivery_at TIMESTAMPTZ,
    delivery_success_count INTEGER DEFAULT 0,
    delivery_failure_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_merchant_webhook_merchant ON merchant_webhook_configs(merchant_id);

-- 8. Webhook delivery log
CREATE TABLE IF NOT EXISTS webhook_delivery_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id UUID REFERENCES merchant_webhook_configs(id),
    transaction_id UUID,
    event_type TEXT NOT NULL,
    status_code INTEGER,
    response_time_ms INTEGER,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_delivery_config ON webhook_delivery_log(config_id);
CREATE INDEX IF NOT EXISTS idx_webhook_delivery_created ON webhook_delivery_log(created_at DESC);

-- 9. RLS Policies
ALTER TABLE webhook_nonces ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE momo_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_webhook_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_delivery_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'webhook_stats'
          AND c.relkind IN ('r', 'p')
    ) THEN
        ALTER TABLE webhook_stats ENABLE ROW LEVEL SECURITY;
    ELSE
        RAISE NOTICE 'Skipping RLS enablement for webhook_stats because it is not a table.';
    END IF;
END $$;

-- Service role can do everything
DROP POLICY IF EXISTS "service_role_all_webhook_nonces" ON webhook_nonces;
CREATE POLICY "service_role_all_webhook_nonces" ON webhook_nonces FOR ALL TO service_role USING (true);
DROP POLICY IF EXISTS "service_role_all_idempotency_keys" ON idempotency_keys;
CREATE POLICY "service_role_all_idempotency_keys" ON idempotency_keys FOR ALL TO service_role USING (true);
DROP POLICY IF EXISTS "service_role_all_security_audit_log" ON security_audit_log;
CREATE POLICY "service_role_all_security_audit_log" ON security_audit_log FOR ALL TO service_role USING (true);
DROP POLICY IF EXISTS "service_role_all_momo_devices" ON momo_devices;
CREATE POLICY "service_role_all_momo_devices" ON momo_devices FOR ALL TO service_role USING (true);
DROP POLICY IF EXISTS "service_role_all_merchant_webhook_configs" ON merchant_webhook_configs;
CREATE POLICY "service_role_all_merchant_webhook_configs" ON merchant_webhook_configs FOR ALL TO service_role USING (true);
DROP POLICY IF EXISTS "service_role_all_webhook_delivery_log" ON webhook_delivery_log;
CREATE POLICY "service_role_all_webhook_delivery_log" ON webhook_delivery_log FOR ALL TO service_role USING (true);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'webhook_stats'
          AND c.relkind IN ('r', 'p')
    ) THEN
        DROP POLICY IF EXISTS "service_role_all_webhook_stats" ON webhook_stats;
        CREATE POLICY "service_role_all_webhook_stats" ON webhook_stats FOR ALL TO service_role USING (true);
    ELSE
        RAISE NOTICE 'Skipping webhook_stats policies because relation is not a table.';
    END IF;
END $$;

-- Merchants can view their own devices
DROP POLICY IF EXISTS "merchants_view_own_devices" ON momo_devices;
CREATE POLICY "merchants_view_own_devices" ON momo_devices 
    FOR SELECT TO authenticated 
    USING (merchant_id = auth.uid());

-- Merchants can manage their webhook configs
DROP POLICY IF EXISTS "merchants_manage_own_webhooks" ON merchant_webhook_configs;
CREATE POLICY "merchants_manage_own_webhooks" ON merchant_webhook_configs 
    FOR ALL TO authenticated 
    USING (merchant_id = auth.uid());

-- 10. Function to cleanup expired records
CREATE OR REPLACE FUNCTION cleanup_expired_webhook_data()
RETURNS TABLE(nonces_deleted BIGINT, keys_deleted BIGINT) AS $$
DECLARE
    n_deleted BIGINT;
    k_deleted BIGINT;
BEGIN
    DELETE FROM webhook_nonces WHERE expires_at < NOW();
    GET DIAGNOSTICS n_deleted = ROW_COUNT;
    
    DELETE FROM idempotency_keys WHERE expires_at < NOW();
    GET DIAGNOSTICS k_deleted = ROW_COUNT;
    
    RETURN QUERY SELECT n_deleted, k_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Function to aggregate webhook stats hourly
CREATE OR REPLACE FUNCTION aggregate_webhook_stats_hourly()
RETURNS void AS $$
DECLARE
    hour_start TIMESTAMPTZ;
    hour_end TIMESTAMPTZ;
BEGIN
    hour_start := date_trunc('hour', NOW() - INTERVAL '1 hour');
    hour_end := date_trunc('hour', NOW());

    IF EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'webhook_stats'
          AND c.relkind IN ('r', 'p')
    ) THEN
        INSERT INTO webhook_stats (period_start, period_end, received, processed, failed, duplicates_blocked, replay_attacks_blocked, avg_latency_ms, error_breakdown)
        SELECT 
            hour_start,
            hour_end,
            COUNT(*) FILTER (WHERE true) as received,
            COUNT(*) FILTER (WHERE status IN ('matched', 'manual_review')) as processed,
            COUNT(*) FILTER (WHERE status = 'failed') as failed,
            0 as duplicates_blocked,
            0 as replay_attacks_blocked,
            AVG(EXTRACT(EPOCH FROM (processed_at - received_at)) * 1000)::INTEGER as avg_latency_ms,
            '{}'::JSONB as error_breakdown
        FROM momo_transactions
        WHERE received_at >= hour_start AND received_at < hour_end;
    ELSE
        RAISE NOTICE 'Skipping webhook_stats aggregation because webhook_stats is not a table.';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Trigger to update device last_seen and transaction_count
CREATE OR REPLACE FUNCTION update_device_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE momo_devices 
    SET 
        last_seen_at = NOW(),
        transaction_count = transaction_count + 1,
        updated_at = NOW()
    WHERE device_id = NEW.device_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_device_stats ON momo_transactions;
DROP TRIGGER IF EXISTS trg_update_device_stats ON ; -- FIXME: add table name
CREATE TRIGGER trg_update_device_stats
    AFTER INSERT ON momo_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_device_stats();
