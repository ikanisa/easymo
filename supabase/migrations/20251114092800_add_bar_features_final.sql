-- Add bar features and preferences columns
-- This migration adds all the feature columns we implemented

BEGIN;

-- Check if columns already exist, if not add them
DO $$ 
BEGIN
  -- Add features JSONB column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bars' AND column_name = 'features') THEN
    ALTER TABLE public.bars ADD COLUMN features jsonb DEFAULT '[]'::jsonb;
  END IF;

  -- Add individual boolean columns for preferences
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bars' AND column_name = 'has_live_music') THEN
    ALTER TABLE public.bars ADD COLUMN has_live_music boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bars' AND column_name = 'has_parking') THEN
    ALTER TABLE public.bars ADD COLUMN has_parking boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bars' AND column_name = 'has_free_wifi') THEN
    ALTER TABLE public.bars ADD COLUMN has_free_wifi boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bars' AND column_name = 'is_family_friendly') THEN
    ALTER TABLE public.bars ADD COLUMN is_family_friendly boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bars' AND column_name = 'has_vegetarian_options') THEN
    ALTER TABLE public.bars ADD COLUMN has_vegetarian_options boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bars' AND column_name = 'has_live_sports') THEN
    ALTER TABLE public.bars ADD COLUMN has_live_sports boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bars' AND column_name = 'has_outdoor_seating') THEN
    ALTER TABLE public.bars ADD COLUMN has_outdoor_seating boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bars' AND column_name = 'has_late_night_hours') THEN
    ALTER TABLE public.bars ADD COLUMN has_late_night_hours boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bars' AND column_name = 'has_events') THEN
    ALTER TABLE public.bars ADD COLUMN has_events boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bars' AND column_name = 'has_karaoke') THEN
    ALTER TABLE public.bars ADD COLUMN has_karaoke boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bars' AND column_name = 'has_happy_hour') THEN
    ALTER TABLE public.bars ADD COLUMN has_happy_hour boolean DEFAULT false;
  END IF;
END $$;

-- Create indexes for filtering performance (only if they don't exist)
CREATE INDEX IF NOT EXISTS idx_bars_live_music ON public.bars(has_live_music) WHERE has_live_music = true;
CREATE INDEX IF NOT EXISTS idx_bars_parking ON public.bars(has_parking) WHERE has_parking = true;
CREATE INDEX IF NOT EXISTS idx_bars_wifi ON public.bars(has_free_wifi) WHERE has_free_wifi = true;
CREATE INDEX IF NOT EXISTS idx_bars_family_friendly ON public.bars(is_family_friendly) WHERE is_family_friendly = true;
CREATE INDEX IF NOT EXISTS idx_bars_vegetarian ON public.bars(has_vegetarian_options) WHERE has_vegetarian_options = true;
CREATE INDEX IF NOT EXISTS idx_bars_sports ON public.bars(has_live_sports) WHERE has_live_sports = true;
CREATE INDEX IF NOT EXISTS idx_bars_outdoor ON public.bars(has_outdoor_seating) WHERE has_outdoor_seating = true;
CREATE INDEX IF NOT EXISTS idx_bars_late_night ON public.bars(has_late_night_hours) WHERE has_late_night_hours = true;

-- Add comments
COMMENT ON COLUMN public.bars.features IS 'JSONB array of features/amenities';
COMMENT ON COLUMN public.bars.has_live_music IS 'Offers live music performances';
COMMENT ON COLUMN public.bars.has_parking IS 'Has parking available';
COMMENT ON COLUMN public.bars.has_free_wifi IS 'Provides free WiFi';
COMMENT ON COLUMN public.bars.is_family_friendly IS 'Family-friendly / Kids-friendly';
COMMENT ON COLUMN public.bars.has_vegetarian_options IS 'Offers vegetarian/vegan options';
COMMENT ON COLUMN public.bars.has_live_sports IS 'Shows live sports (football streaming)';
COMMENT ON COLUMN public.bars.has_outdoor_seating IS 'Has outdoor/terrace seating';
COMMENT ON COLUMN public.bars.has_late_night_hours IS 'Open late night';
COMMENT ON COLUMN public.bars.has_events IS 'Has special events';
COMMENT ON COLUMN public.bars.has_karaoke IS 'Has karaoke nights';
COMMENT ON COLUMN public.bars.has_happy_hour IS 'Has happy hour specials';

COMMIT;
