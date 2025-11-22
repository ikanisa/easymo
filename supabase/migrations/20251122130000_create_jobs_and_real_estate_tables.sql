-- Jobs Ecosystem
CREATE TABLE IF NOT EXISTS public.job_listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    company TEXT,
    description TEXT,
    location TEXT,
    salary_min NUMERIC,
    salary_max NUMERIC,
    currency TEXT DEFAULT 'RWF',
    job_type TEXT CHECK (job_type IN ('full_time', 'part_time', 'contract', 'gig', 'internship')),
    requirements TEXT[], -- Array of strings
    contact_info JSONB, -- { email, phone, website }
    source_url TEXT, -- If scraped
    external_id TEXT, -- ID from source
    verified BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed', 'expired')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_scraped_at TIMESTAMPTZ
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_listings' AND column_name = 'source_url') THEN
        ALTER TABLE public.job_listings ADD COLUMN source_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_listings' AND column_name = 'external_id') THEN
        ALTER TABLE public.job_listings ADD COLUMN external_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_listings' AND column_name = 'last_scraped_at') THEN
        ALTER TABLE public.job_listings ADD COLUMN last_scraped_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_listings' AND column_name = 'verified') THEN
        ALTER TABLE public.job_listings ADD COLUMN verified BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_job_listings_location ON public.job_listings(location);
CREATE INDEX IF NOT EXISTS idx_job_listings_title ON public.job_listings USING gin(to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_job_listings_status ON public.job_listings(status);

CREATE TABLE IF NOT EXISTS public.worker_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- Link to auth user
    skills TEXT[],
    experience_years NUMERIC,
    location TEXT,
    preferred_roles TEXT[],
    resume_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS public.job_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES public.job_listings(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    cover_message TEXT,
    status TEXT DEFAULT 'submitted' CHECK (status IN ('submitted', 'viewed', 'interviewing', 'accepted', 'rejected')),
    applied_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Real Estate Ecosystem
CREATE TABLE IF NOT EXISTS public.property_listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    location TEXT,
    price NUMERIC,
    currency TEXT DEFAULT 'RWF',
    bedrooms NUMERIC,
    bathrooms NUMERIC,
    size_sqm NUMERIC,
    property_type TEXT CHECK (property_type IN ('apartment', 'house', 'villa', 'office', 'shop', 'land', 'warehouse', 'commercial')),
    listing_type TEXT CHECK (listing_type IN ('rent', 'sale', 'short_term')),
    amenities TEXT[],
    photos TEXT[], -- Array of URLs
    owner_phone TEXT,
    owner_email TEXT,
    source_url TEXT,
    external_id TEXT,
    verified BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'sold', 'rented', 'expired')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_scraped_at TIMESTAMPTZ
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'property_listings' AND column_name = 'source_url') THEN
        ALTER TABLE public.property_listings ADD COLUMN source_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'property_listings' AND column_name = 'external_id') THEN
        ALTER TABLE public.property_listings ADD COLUMN external_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'property_listings' AND column_name = 'last_scraped_at') THEN
        ALTER TABLE public.property_listings ADD COLUMN last_scraped_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'property_listings' AND column_name = 'verified') THEN
        ALTER TABLE public.property_listings ADD COLUMN verified BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_property_listings_location ON public.property_listings(location);
CREATE INDEX IF NOT EXISTS idx_property_listings_price ON public.property_listings(price);
CREATE INDEX IF NOT EXISTS idx_property_listings_type ON public.property_listings(property_type);
CREATE INDEX IF NOT EXISTS idx_property_listings_status ON public.property_listings(status);

CREATE TABLE IF NOT EXISTS public.property_inquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES public.property_listings(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    message TEXT,
    status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'read', 'replied')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.property_viewings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES public.property_listings(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    viewing_date DATE,
    viewing_time TIME,
    status TEXT DEFAULT 'requested' CHECK (status IN ('requested', 'confirmed', 'cancelled', 'completed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.property_favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES public.property_listings(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, property_id)
);

-- Enable RLS
ALTER TABLE public.job_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_viewings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_favorites ENABLE ROW LEVEL SECURITY;

-- Policies
-- Listings are public read
CREATE POLICY "Job listings are public" ON public.job_listings FOR SELECT USING (true);
CREATE POLICY "Property listings are public" ON public.property_listings FOR SELECT USING (true);

-- Service role can manage all (for scrapers/admin)
-- (Implicit with service_role key, but good to be explicit if we add other roles)

-- User specific policies
CREATE POLICY "Users can manage own profile" ON public.worker_profiles
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own applications" ON public.job_applications
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create applications" ON public.job_applications
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own inquiries" ON public.property_inquiries
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create inquiries" ON public.property_inquiries
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own viewings" ON public.property_viewings
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create viewings" ON public.property_viewings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own favorites" ON public.property_favorites
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
