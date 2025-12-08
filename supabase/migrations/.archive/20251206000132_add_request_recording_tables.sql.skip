BEGIN;

-- Property Requests Table
CREATE TABLE IF NOT EXISTS property_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type VARCHAR(20) NOT NULL CHECK (request_type IN ('buy', 'rent', 'sell')),
  property_type VARCHAR(50) NOT NULL CHECK (property_type IN ('land', 'house', 'apartment', 'commercial')),
  location TEXT NOT NULL,
  country VARCHAR(50) NOT NULL CHECK (country IN ('rwanda', 'malta')),
  bedrooms INTEGER,
  budget_min DECIMAL(12,2),
  budget_max DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) NOT NULL CHECK (currency IN ('RWF', 'EUR', 'USD')),
  move_in_date TEXT,
  furnished BOOLEAN DEFAULT false,
  special_requirements TEXT,
  contact_phone VARCHAR(20) NOT NULL,
  contact_email VARCHAR(255),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'contacted', 'completed', 'cancelled')),
  source VARCHAR(50) DEFAULT 'voice_call',
  call_id UUID,
  user_id UUID,
  assigned_to UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_property_requests_status ON property_requests(status);
CREATE INDEX idx_property_requests_country ON property_requests(country);
CREATE INDEX idx_property_requests_created_at ON property_requests(created_at);
CREATE INDEX idx_property_requests_call_id ON property_requests(call_id);

-- Ride Requests Table
CREATE TABLE IF NOT EXISTS ride_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pickup_location TEXT NOT NULL,
  dropoff_location TEXT NOT NULL,
  vehicle_type VARCHAR(20) NOT NULL CHECK (vehicle_type IN ('moto', 'car', 'van')),
  passengers INTEGER DEFAULT 1,
  luggage BOOLEAN DEFAULT false,
  schedule_time TEXT NOT NULL,
  flight_time TEXT,
  special_requirements TEXT,
  contact_phone VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'accepted', 'in_progress', 'completed', 'cancelled')),
  source VARCHAR(50) DEFAULT 'voice_call',
  call_id UUID,
  user_id UUID,
  driver_id UUID,
  trip_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ride_requests_status ON ride_requests(status);
CREATE INDEX idx_ride_requests_schedule_time ON ride_requests(schedule_time);
CREATE INDEX idx_ride_requests_created_at ON ride_requests(created_at);
CREATE INDEX idx_ride_requests_call_id ON ride_requests(call_id);

-- General Inquiries Table
CREATE TABLE IF NOT EXISTS inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_type VARCHAR(50) NOT NULL CHECK (inquiry_type IN ('vehicle_sale', 'insurance', 'job_search', 'agriculture', 'business', 'other')),
  description TEXT NOT NULL,
  urgency VARCHAR(20) DEFAULT 'normal' CHECK (urgency IN ('urgent', 'normal', 'low')),
  preferred_contact_method VARCHAR(20) CHECK (preferred_contact_method IN ('phone', 'whatsapp', 'email')),
  contact_phone VARCHAR(20) NOT NULL,
  contact_email VARCHAR(255),
  best_time_to_call TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'contacted', 'resolved', 'closed')),
  source VARCHAR(50) DEFAULT 'voice_call',
  call_id UUID,
  user_id UUID,
  assigned_to UUID,
  resolution TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_inquiries_status ON inquiries(status);
CREATE INDEX idx_inquiries_urgency ON inquiries(urgency);
CREATE INDEX idx_inquiries_type ON inquiries(inquiry_type);
CREATE INDEX idx_inquiries_created_at ON inquiries(created_at);
CREATE INDEX idx_inquiries_call_id ON inquiries(call_id);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_property_requests_updated_at
  BEFORE UPDATE ON property_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ride_requests_updated_at
  BEFORE UPDATE ON ride_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inquiries_updated_at
  BEFORE UPDATE ON inquiries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE property_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE ride_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role has full access to property_requests"
  ON property_requests FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "Service role has full access to ride_requests"
  ON ride_requests FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "Service role has full access to inquiries"
  ON inquiries FOR ALL
  TO service_role
  USING (true);

-- Users can view their own requests
CREATE POLICY "Users can view own property requests"
  ON property_requests FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can view own ride requests"
  ON ride_requests FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can view own inquiries"
  ON inquiries FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

COMMIT;
