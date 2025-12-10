-- Function to increment member balance
CREATE OR REPLACE FUNCTION increment_member_balance(
  p_group_id UUID,
  p_user_id UUID,
  p_amount NUMERIC
)
RETURNS VOID AS $$
BEGIN
  UPDATE group_members
  SET balance = COALESCE(balance, 0) + p_amount,
      updated_at = NOW()
  WHERE group_id = p_group_id
    AND user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment group total balance
CREATE OR REPLACE FUNCTION increment_group_balance(
  p_group_id UUID,
  p_amount NUMERIC
)
RETURNS VOID AS $$
BEGIN
  UPDATE groups
  SET total_balance = COALESCE(total_balance, 0) + p_amount,
      updated_at = NOW()
  WHERE id = p_group_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create loan_applications table if not exists
CREATE TABLE IF NOT EXISTS loan_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  purpose TEXT NOT NULL,
  term_months INTEGER NOT NULL CHECK (term_months > 0),
  collateral TEXT,
  monthly_income NUMERIC,
  employment_status TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'disbursed', 'repaid')),
  monthly_payment NUMERIC,
  total_interest NUMERIC,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  disbursed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS policies for loan_applications
ALTER TABLE loan_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own loan applications"
  ON loan_applications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create loan applications"
  ON loan_applications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create push tokens table
CREATE TABLE IF NOT EXISTS user_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, token)
);

-- RLS for push tokens
ALTER TABLE user_push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own push tokens"
  ON user_push_tokens FOR ALL
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_loan_applications_user_id ON loan_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_loan_applications_status ON loan_applications(status);
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user_id ON user_push_tokens(user_id);
