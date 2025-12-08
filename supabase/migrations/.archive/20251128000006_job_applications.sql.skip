-- Transaction wrapper for production safety
BEGIN;

-- Job application tracking
CREATE TABLE IF NOT EXISTS job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES whatsapp_users(id) ON DELETE CASCADE,
  job_listing_id UUID REFERENCES job_listings(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'applied' CHECK (status IN ('applied', 'interviewing', 'offered', 'rejected', 'accepted', 'withdrawn')),
  applied_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT,
  follow_up_date DATE,
  reminder_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_job_applications_user ON job_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_job ON job_applications(job_listing_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_status ON job_applications(status);
CREATE INDEX IF NOT EXISTS idx_job_applications_follow_up ON job_applications(follow_up_date) WHERE follow_up_date IS NOT NULL AND reminder_sent = false;

-- RLS policies
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own applications" ON job_applications;
CREATE POLICY "Users can view own applications"
  ON job_applications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own applications" ON job_applications;
CREATE POLICY "Users can create own applications"
  ON job_applications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own applications" ON job_applications;
CREATE POLICY "Users can update own applications"
  ON job_applications FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own applications" ON job_applications;
CREATE POLICY "Users can delete own applications"
  ON job_applications FOR DELETE
  USING (auth.uid() = user_id);

-- Update trigger
DROP TRIGGER IF EXISTS update_job_applications_updated_at ON job_applications;
CREATE TRIGGER update_job_applications_updated_at
  BEFORE UPDATE ON job_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE job_applications IS 'Tracks user job applications with status and follow-up dates';
COMMENT ON COLUMN job_applications.status IS 'Current status of the application';
COMMENT ON COLUMN job_applications.follow_up_date IS 'Date to send follow-up reminder';

COMMIT;
