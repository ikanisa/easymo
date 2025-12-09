-- TapMoMo NFC Payment System
-- Schema for merchants, transactions, and reconciliation

-- Merchants table (stores merchant configurations and HMAC keys)
CREATE TABLE IF NOT EXISTS app.tapmomo_merchants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sacco_id UUID NOT NULL REFERENCES app.saccos(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- staff member who registered this merchant
    merchant_code TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    network TEXT NOT NULL CHECK (network IN ('MTN', 'Airtel')),
    secret_key BYTEA NOT NULL, -- HMAC secret key for payload signing
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);

-- Transactions table (tracks all TapMoMo payment attempts)
CREATE TABLE IF NOT EXISTS app.tapmomo_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES app.tapmomo_merchants(id) ON DELETE CASCADE,
    sacco_id UUID NOT NULL REFERENCES app.saccos(id) ON DELETE CASCADE,
    nonce UUID NOT NULL UNIQUE, -- From payload; prevents replay attacks
    amount INTEGER, -- In minor units (e.g., 2500 = 25.00 RWF)
    currency TEXT NOT NULL DEFAULT 'RWF',
    ref TEXT, -- Optional reference from merchant
    network TEXT NOT NULL CHECK (network IN ('MTN', 'Airtel')),
    status TEXT NOT NULL DEFAULT 'initiated' CHECK (
        status IN ('initiated', 'pending', 'settled', 'failed', 'expired')
    ),
    payer_hint TEXT, -- Phone number or identifier of payer
    error_message TEXT,
    payload_ts TIMESTAMPTZ NOT NULL, -- Timestamp from the NFC payload
    initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    settled_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL, -- Based on TTL in payload
    payment_id UUID REFERENCES app.payments(id), -- Link to reconciled payment
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS tapmomo_merchants_sacco_idx ON app.tapmomo_merchants(sacco_id);
CREATE INDEX IF NOT EXISTS tapmomo_merchants_code_idx ON app.tapmomo_merchants(merchant_code);
CREATE INDEX IF NOT EXISTS tapmomo_merchants_network_idx ON app.tapmomo_merchants(network) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS tapmomo_transactions_merchant_idx ON app.tapmomo_transactions(merchant_id);
CREATE INDEX IF NOT EXISTS tapmomo_transactions_sacco_idx ON app.tapmomo_transactions(sacco_id);
CREATE INDEX IF NOT EXISTS tapmomo_transactions_status_idx ON app.tapmomo_transactions(status);
CREATE INDEX IF NOT EXISTS tapmomo_transactions_created_idx ON app.tapmomo_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS tapmomo_transactions_nonce_idx ON app.tapmomo_transactions(nonce);
CREATE INDEX IF NOT EXISTS tapmomo_transactions_payment_idx ON app.tapmomo_transactions(payment_id) WHERE payment_id IS NOT NULL;

-- Function to auto-expire old transactions
CREATE OR REPLACE FUNCTION app.expire_tapmomo_transactions()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    UPDATE app.tapmomo_transactions
    SET status = 'expired',
        updated_at = NOW()
    WHERE status = 'initiated'
        AND expires_at < NOW();
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule expiration job (runs every 5 minutes)
SELECT cron.schedule(
    'expire-tapmomo-transactions',
    '*/5 * * * *',
    $$
    SELECT app.expire_tapmomo_transactions();
    $$
);

-- Function to generate merchant secret key
CREATE OR REPLACE FUNCTION app.generate_merchant_secret()
RETURNS BYTEA AS $$
BEGIN
    RETURN gen_random_bytes(32);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create a TapMoMo transaction
CREATE OR REPLACE FUNCTION app.create_tapmomo_transaction(
    p_merchant_id UUID,
    p_nonce UUID,
    p_amount INTEGER,
    p_currency TEXT,
    p_ref TEXT,
    p_network TEXT,
    p_payload_ts TIMESTAMPTZ,
    p_ttl_seconds INTEGER DEFAULT 120
)
RETURNS UUID AS $$
DECLARE
    v_sacco_id UUID;
    v_transaction_id UUID;
    v_expires_at TIMESTAMPTZ;
BEGIN
    -- Get sacco_id from merchant
    SELECT sacco_id INTO v_sacco_id
    FROM app.tapmomo_merchants
    WHERE id = p_merchant_id AND is_active = true;
    
    IF v_sacco_id IS NULL THEN
        RAISE EXCEPTION 'Merchant not found or inactive';
    END IF;
    
    v_expires_at := p_payload_ts + (p_ttl_seconds || ' seconds')::INTERVAL;
    
    -- Create transaction
    INSERT INTO app.tapmomo_transactions (
        merchant_id,
        sacco_id,
        nonce,
        amount,
        currency,
        ref,
        network,
        status,
        payload_ts,
        expires_at
    ) VALUES (
        p_merchant_id,
        v_sacco_id,
        p_nonce,
        p_amount,
        p_currency,
        p_ref,
        p_network,
        'initiated',
        p_payload_ts,
        v_expires_at
    )
    RETURNING id INTO v_transaction_id;
    
    RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies
ALTER TABLE app.tapmomo_merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.tapmomo_transactions ENABLE ROW LEVEL SECURITY;

-- Merchants: staff can view merchants for their SACCO
CREATE POLICY tapmomo_merchants_select_policy ON app.tapmomo_merchants
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM app.staff_profiles sp
            WHERE sp.user_id = auth.uid()
                AND (sp.sacco_id = tapmomo_merchants.sacco_id OR sp.role = 'admin')
        )
    );

-- Merchants: admin staff can insert merchants
CREATE POLICY tapmomo_merchants_insert_policy ON app.tapmomo_merchants
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM app.staff_profiles sp
            WHERE sp.user_id = auth.uid()
                AND sp.sacco_id = tapmomo_merchants.sacco_id
                AND sp.role IN ('admin', 'manager')
        )
    );

-- Merchants: admin staff can update merchants
CREATE POLICY tapmomo_merchants_update_policy ON app.tapmomo_merchants
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM app.staff_profiles sp
            WHERE sp.user_id = auth.uid()
                AND sp.sacco_id = tapmomo_merchants.sacco_id
                AND sp.role IN ('admin', 'manager')
        )
    );

-- Transactions: staff can view transactions for their SACCO
CREATE POLICY tapmomo_transactions_select_policy ON app.tapmomo_transactions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM app.staff_profiles sp
            WHERE sp.user_id = auth.uid()
                AND (sp.sacco_id = tapmomo_transactions.sacco_id OR sp.role = 'admin')
        )
    );

-- Transactions: staff can insert transactions
CREATE POLICY tapmomo_transactions_insert_policy ON app.tapmomo_transactions
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM app.staff_profiles sp
            WHERE sp.user_id = auth.uid()
                AND sp.sacco_id = tapmomo_transactions.sacco_id
        )
    );

-- Transactions: staff can update transactions for their SACCO
CREATE POLICY tapmomo_transactions_update_policy ON app.tapmomo_transactions
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM app.staff_profiles sp
            WHERE sp.user_id = auth.uid()
                AND sp.sacco_id = tapmomo_transactions.sacco_id
        )
    );

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON app.tapmomo_merchants TO authenticated;
GRANT SELECT, INSERT, UPDATE ON app.tapmomo_transactions TO authenticated;
GRANT EXECUTE ON FUNCTION app.expire_tapmomo_transactions() TO service_role;
GRANT EXECUTE ON FUNCTION app.generate_merchant_secret() TO authenticated;
GRANT EXECUTE ON FUNCTION app.create_tapmomo_transaction(UUID, UUID, INTEGER, TEXT, TEXT, TEXT, TIMESTAMPTZ, INTEGER) TO authenticated;

-- Create view for transaction summary
CREATE OR REPLACE VIEW app.tapmomo_transaction_summary AS
SELECT
    t.id,
    t.merchant_id,
    t.sacco_id,
    t.nonce,
    t.amount,
    t.currency,
    t.ref,
    t.network,
    t.status,
    t.payer_hint,
    t.payload_ts,
    t.initiated_at,
    t.settled_at,
    t.expires_at,
    t.payment_id,
    m.merchant_code,
    m.display_name AS merchant_name,
    p.reference AS payment_reference,
    p.status AS payment_status,
    s.name AS sacco_name
FROM app.tapmomo_transactions t
JOIN app.tapmomo_merchants m ON t.merchant_id = m.id
LEFT JOIN app.payments p ON t.payment_id = p.id
LEFT JOIN app.saccos s ON t.sacco_id = s.id;

GRANT SELECT ON app.tapmomo_transaction_summary TO authenticated;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION app.update_tapmomo_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tapmomo_merchants_updated_at
    BEFORE UPDATE ON app.tapmomo_merchants
    FOR EACH ROW
    EXECUTE FUNCTION app.update_tapmomo_updated_at();

CREATE TRIGGER tapmomo_transactions_updated_at
    BEFORE UPDATE ON app.tapmomo_transactions
    FOR EACH ROW
    EXECUTE FUNCTION app.update_tapmomo_updated_at();

-- Comments for documentation
COMMENT ON TABLE app.tapmomo_merchants IS 'TapMoMo merchant configurations with HMAC keys for NFC payment validation';
COMMENT ON TABLE app.tapmomo_transactions IS 'TapMoMo payment transactions initiated via NFC tap';
COMMENT ON FUNCTION app.expire_tapmomo_transactions() IS 'Automatically expire TapMoMo transactions past their TTL';
COMMENT ON FUNCTION app.create_tapmomo_transaction(UUID, UUID, INTEGER, TEXT, TEXT, TEXT, TIMESTAMPTZ, INTEGER) IS 'Create a new TapMoMo transaction with validation';
