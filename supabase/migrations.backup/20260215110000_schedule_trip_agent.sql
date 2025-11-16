-- Migration for Schedule Trip Agent with pattern learning
BEGIN;

-- Add next_run_at column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='scheduled_trips' AND column_name='next_run_at') 
  THEN
    ALTER TABLE scheduled_trips ADD COLUMN next_run_at TIMESTAMPTZ;
  END IF;
END $$;

-- Add matched_driver_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='scheduled_trips' AND column_name='matched_driver_id') 
  THEN
    ALTER TABLE scheduled_trips ADD COLUMN matched_driver_id UUID;
  END IF;
END $$;

-- Scheduled trips table
CREATE TABLE IF NOT EXISTS scheduled_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  pickup_location GEOGRAPHY(POINT, 4326) NOT NULL,
  dropoff_location GEOGRAPHY(POINT, 4326) NOT NULL,
  pickup_address TEXT,
  dropoff_address TEXT,
  scheduled_time TIMESTAMPTZ NOT NULL,
  vehicle_preference TEXT NOT NULL CHECK (vehicle_preference IN ('Moto', 'Cab', 'Liffan', 'Truck', 'Others')),
  recurrence TEXT NOT NULL DEFAULT 'once' CHECK (recurrence IN ('once', 'daily', 'weekdays', 'weekends', 'weekly')),
  is_active BOOLEAN DEFAULT TRUE,
  notification_minutes INTEGER DEFAULT 30,
  flexibility_minutes INTEGER DEFAULT 15,
  max_price DECIMAL(10, 2),
  preferred_drivers UUID[],
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'searching', 'matched', 'completed', 'cancelled')),
  last_processed_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  matched_driver_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for scheduled trips
CREATE INDEX IF NOT EXISTS idx_scheduled_trips_user ON scheduled_trips(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_trips_scheduled_time ON scheduled_trips(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_scheduled_trips_status ON scheduled_trips(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_trips_next_run ON scheduled_trips(next_run_at) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_scheduled_trips_recurrence ON scheduled_trips(recurrence) WHERE is_active = TRUE;

-- Travel patterns table for ML
CREATE TABLE IF NOT EXISTS travel_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  hour INTEGER NOT NULL CHECK (hour >= 0 AND hour <= 23),
  pickup_location GEOGRAPHY(POINT, 4326),
  dropoff_location GEOGRAPHY(POINT, 4326),
  vehicle_type TEXT,
  frequency_count INTEGER DEFAULT 1,
  last_occurrence TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for pattern analysis
CREATE INDEX IF NOT EXISTS idx_travel_patterns_user ON travel_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_travel_patterns_day_hour ON travel_patterns(day_of_week, hour);
CREATE INDEX IF NOT EXISTS idx_travel_patterns_user_day_hour ON travel_patterns(user_id, day_of_week, hour);
CREATE INDEX IF NOT EXISTS idx_travel_patterns_created ON travel_patterns(created_at DESC);

-- Pattern predictions table (ML-generated)
CREATE TABLE IF NOT EXISTS trip_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  predicted_day_of_week INTEGER,
  predicted_hour INTEGER,
  predicted_route JSONB,
  confidence_score DECIMAL(5, 2),
  based_on_pattern_count INTEGER,
  suggested_at TIMESTAMPTZ DEFAULT NOW(),
  accepted BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trip_predictions_user ON trip_predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_trip_predictions_confidence ON trip_predictions(confidence_score DESC);

-- Function to calculate next run time for recurring trips
CREATE OR REPLACE FUNCTION calculate_next_run(
  p_current_time TIMESTAMPTZ,
  p_scheduled_time TIMESTAMPTZ,
  p_recurrence TEXT
)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  next_run TIMESTAMPTZ;
  scheduled_hour INTEGER;
  scheduled_minute INTEGER;
  current_day INTEGER;
  target_day INTEGER;
BEGIN
  scheduled_hour := EXTRACT(HOUR FROM p_scheduled_time);
  scheduled_minute := EXTRACT(MINUTE FROM p_scheduled_time);
  current_day := EXTRACT(DOW FROM p_current_time);

  CASE p_recurrence
    WHEN 'once' THEN
      RETURN p_scheduled_time;
    
    WHEN 'daily' THEN
      next_run := date_trunc('day', p_current_time) + 
                  (scheduled_hour || ' hours')::INTERVAL + 
                  (scheduled_minute || ' minutes')::INTERVAL;
      IF next_run <= p_current_time THEN
        next_run := next_run + INTERVAL '1 day';
      END IF;
      RETURN next_run;
    
    WHEN 'weekdays' THEN
      next_run := date_trunc('day', p_current_time) + 
                  (scheduled_hour || ' hours')::INTERVAL + 
                  (scheduled_minute || ' minutes')::INTERVAL;
      LOOP
        IF EXTRACT(DOW FROM next_run) BETWEEN 1 AND 5 AND next_run > p_current_time THEN
          RETURN next_run;
        END IF;
        next_run := next_run + INTERVAL '1 day';
      END LOOP;
    
    WHEN 'weekends' THEN
      next_run := date_trunc('day', p_current_time) + 
                  (scheduled_hour || ' hours')::INTERVAL + 
                  (scheduled_minute || ' minutes')::INTERVAL;
      LOOP
        IF EXTRACT(DOW FROM next_run) IN (0, 6) AND next_run > p_current_time THEN
          RETURN next_run;
        END IF;
        next_run := next_run + INTERVAL '1 day';
      END LOOP;
    
    WHEN 'weekly' THEN
      target_day := EXTRACT(DOW FROM p_scheduled_time);
      next_run := date_trunc('day', p_current_time) + 
                  (scheduled_hour || ' hours')::INTERVAL + 
                  (scheduled_minute || ' minutes')::INTERVAL;
      LOOP
        IF EXTRACT(DOW FROM next_run) = target_day AND next_run > p_current_time THEN
          RETURN next_run;
        END IF;
        next_run := next_run + INTERVAL '1 day';
      END LOOP;
  END CASE;
  
  RETURN p_scheduled_time;
END;
$$ LANGUAGE plpgsql;

-- Function to update travel patterns
CREATE OR REPLACE FUNCTION upsert_travel_pattern(
  p_user_id UUID,
  p_day_of_week INTEGER,
  p_hour INTEGER,
  p_pickup_location GEOGRAPHY,
  p_dropoff_location GEOGRAPHY,
  p_vehicle_type TEXT
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO travel_patterns (
    user_id,
    day_of_week,
    hour,
    pickup_location,
    dropoff_location,
    vehicle_type,
    frequency_count,
    last_occurrence
  ) VALUES (
    p_user_id,
    p_day_of_week,
    p_hour,
    p_pickup_location,
    p_dropoff_location,
    p_vehicle_type,
    1,
    NOW()
  )
  ON CONFLICT (user_id, day_of_week, hour) 
  DO UPDATE SET
    frequency_count = travel_patterns.frequency_count + 1,
    last_occurrence = NOW(),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Add unique constraint for pattern upserts
ALTER TABLE travel_patterns
  ADD CONSTRAINT unique_user_day_hour UNIQUE (user_id, day_of_week, hour);

-- Function to get user patterns for analysis
CREATE OR REPLACE FUNCTION get_user_travel_patterns(
  p_user_id UUID,
  p_days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
  day_of_week INTEGER,
  hour INTEGER,
  trip_count BIGINT,
  most_common_vehicle TEXT,
  average_frequency DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tp.day_of_week,
    tp.hour,
    COUNT(*)::BIGINT AS trip_count,
    MODE() WITHIN GROUP (ORDER BY tp.vehicle_type) AS most_common_vehicle,
    AVG(tp.frequency_count) AS average_frequency
  FROM travel_patterns tp
  WHERE 
    tp.user_id = p_user_id
    AND tp.created_at >= NOW() - (p_days_back || ' days')::INTERVAL
  GROUP BY tp.day_of_week, tp.hour
  HAVING COUNT(*) >= 2
  ORDER BY trip_count DESC, tp.day_of_week, tp.hour;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update next_run_at on scheduled_trips
CREATE OR REPLACE FUNCTION update_scheduled_trip_next_run()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.recurrence != 'once' AND NEW.is_active = TRUE THEN
    NEW.next_run_at := calculate_next_run(
      COALESCE(NEW.last_processed_at, NOW()),
      NEW.scheduled_time,
      NEW.recurrence
    );
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_next_run
  BEFORE INSERT OR UPDATE ON scheduled_trips
  FOR EACH ROW
  EXECUTE FUNCTION update_scheduled_trip_next_run();

-- RLS policies
ALTER TABLE scheduled_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_predictions ENABLE ROW LEVEL SECURITY;

-- Scheduled trips policies
CREATE POLICY "Users can view own scheduled trips"
  ON scheduled_trips FOR SELECT
  USING (auth.uid()::TEXT = user_id::TEXT);

CREATE POLICY "Users can create own scheduled trips"
  ON scheduled_trips FOR INSERT
  WITH CHECK (auth.uid()::TEXT = user_id::TEXT);

CREATE POLICY "Users can update own scheduled trips"
  ON scheduled_trips FOR UPDATE
  USING (auth.uid()::TEXT = user_id::TEXT);

CREATE POLICY "Users can delete own scheduled trips"
  ON scheduled_trips FOR DELETE
  USING (auth.uid()::TEXT = user_id::TEXT);

-- Travel patterns policies
CREATE POLICY "Users can view own patterns"
  ON travel_patterns FOR SELECT
  USING (auth.uid()::TEXT = user_id::TEXT);

CREATE POLICY "Service role can manage patterns"
  ON travel_patterns FOR ALL
  USING (true);

-- Predictions policies
CREATE POLICY "Users can view own predictions"
  ON trip_predictions FOR SELECT
  USING (auth.uid()::TEXT = user_id::TEXT);

COMMIT;
