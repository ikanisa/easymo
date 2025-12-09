-- =====================================================================
-- POPULATE BUSINESS TAGS FROM BUY_SELL CATEGORIES
-- =====================================================================
-- This migration populates the tags column in the business table
-- based on the buy_sell_category field, mapping to comprehensive tag lists
-- for each buy_sell category (pharmacies, salons, electronics, etc.)
--
-- Tags enable:
-- - Natural language search ("I need medicine", "fix my phone")
-- - Multi-language support (English, French, Kinyarwanda)
-- - Synonym matching ("chemist" = "pharmacy")
-- - Product/service discovery
-- =====================================================================

BEGIN;

-- =====================================================================
-- ADD BUY_SELL_CATEGORY COLUMN IF IT DOESN'T EXIST
-- =====================================================================
ALTER TABLE public.business 
  ADD COLUMN IF NOT EXISTS buy_sell_category TEXT;

-- Create index for fast lookup
CREATE INDEX IF NOT EXISTS idx_business_buy_sell_category 
ON public.business(buy_sell_category)
WHERE buy_sell_category IS NOT NULL;

-- =====================================================================
-- UPDATE TAGS FOR PHARMACIES
-- =====================================================================
UPDATE public.business
SET tags = ARRAY[
  'pharmacy', 'pharmacies', 'chemist', 'drugstore', 'pharmacie',
  'medicine', 'meds', 'drugs', 'prescriptions', 'prescription refill',
  'over the counter', 'otc', 'generic medicine', 'branded medicine',
  'painkiller', 'paracetamol', 'ibuprofen', 'aspirin', 'antibiotics',
  'cough syrup', 'flu medicine', 'allergy medicine', 'antihistamine',
  'vitamins', 'supplements', 'multivitamin', 'first aid', 'bandage',
  'plaster', 'gauze', 'antiseptic', 'disinfectant', 'wound care',
  'thermometer', 'blood pressure machine', 'glucose meter', 'insulin supplies',
  'inhaler', 'asthma medicine', 'pregnancy test', 'ovulation test',
  'condoms', 'family planning', 'emergency pill', 'baby formula',
  'baby medicine', 'diaper rash cream', 'skin cream', 'eye drops',
  'ear drops', 'nasal spray', 'malaria test', 'malaria treatment',
  'covid test', 'vaccination', 'immunization', 'travel vaccine',
  'home delivery medicine', '24h pharmacy', 'night pharmacy',
  'emergency pharmacy', 'health shop'
]
WHERE buy_sell_category = 'pharmacies';

-- =====================================================================
-- UPDATE TAGS FOR SALONS & BARBERS
-- =====================================================================
UPDATE public.business
SET tags = ARRAY[
  'salon', 'beauty salon', 'hair salon', 'barber', 'barbershop',
  'coiffeur', 'hairdresser', 'hair stylist', 'haircut', 'men haircut',
  'women haircut', 'kids haircut', 'beard trim', 'shaving', 'shave',
  'beard grooming', 'line up', 'fade', 'braids', 'cornrows', 'twists',
  'locks', 'dreadlocks', 'retouch dreads', 'weave', 'wig',
  'hair extensions', 'hair coloring', 'hair dye', 'highlights',
  'relaxer', 'blow dry', 'hair treatment', 'hair wash', 'pedicure',
  'manicure', 'nails', 'nail salon', 'gel nails', 'acrylic nails',
  'nail art', 'makeup', 'bridal makeup', 'party makeup', 'eyelashes',
  'eyebrows', 'waxing', 'facial', 'spa', 'massage', 'body scrub',
  'beauty parlor', 'home service hair', 'home salon'
]
WHERE buy_sell_category = 'salons_barbers';

-- =====================================================================
-- UPDATE TAGS FOR ELECTRONICS
-- =====================================================================
UPDATE public.business
SET tags = ARRAY[
  'electronics shop', 'electronics store', 'tech shop', 'gadget shop',
  'phone shop', 'smartphone', 'android phone', 'iphone', 'basic phone',
  'feature phone', 'tablet', 'ipad', 'laptop', 'notebook', 'desktop',
  'computer', 'pc', 'monitor', 'printer', 'scanner', 'photocopier',
  'projector', 'tv', 'television', 'smart tv', 'decoder', 'sound system',
  'speakers', 'bluetooth speaker', 'headphones', 'earphones', 'earbuds',
  'charger', 'phone charger', 'laptop charger', 'usb cable', 'hdmi cable',
  'power bank', 'memory card', 'flash disk', 'hard drive', 'ssd',
  'router', 'modem', 'wifi router', 'cctv', 'security camera',
  'surveillance', 'inverter', 'ups', 'stabilizer', 'fridge',
  'refrigerator', 'freezer', 'microwave', 'oven', 'cooking stove',
  'gas cooker', 'washing machine', 'iron', 'fan', 'air conditioner',
  'ac', 'phone accessories', 'phone cover', 'screen protector',
  'sim card', 'sim registration', 'phone repair', 'screen repair',
  'laptop repair', 'electronics repair', 'unlocking', 'data recovery'
]
WHERE buy_sell_category = 'electronics';

-- =====================================================================
-- UPDATE TAGS FOR HARDWARE & TOOLS
-- =====================================================================
UPDATE public.business
SET tags = ARRAY[
  'hardware store', 'hardware shop', 'building materials',
  'construction materials', 'construction shop', 'cement', 'sand',
  'gravel', 'stones', 'bricks', 'blocks', 'iron sheets', 'roofing',
  'tiles', 'floor tiles', 'wall tiles', 'paint', 'primer', 'varnish',
  'thinner', 'paint brush', 'roller', 'plumbing', 'pipes', 'pvc pipe',
  'fittings', 'taps', 'mixers', 'shower', 'sink', 'toilet',
  'toilet seat', 'water tank', 'water pump', 'gutter', 'drainage',
  'electrical materials', 'cables', 'wires', 'sockets', 'switches',
  'bulbs', 'led lights', 'lamp', 'fuse', 'circuit breaker',
  'distribution board', 'tools', 'hand tools', 'hammer', 'screwdriver',
  'spanner', 'wrench', 'pliers', 'tape measure', 'level', 'drill',
  'power tools', 'grinder', 'saw', 'circular saw', 'welding machine',
  'ladder', 'scaffold', 'wheelbarrow', 'nails', 'screws', 'bolts',
  'nuts', 'hinges', 'door lock', 'padlock', 'chains', 'safety gear',
  'helmet', 'safety shoes', 'gloves', 'reflective jacket',
  'construction company', 'builder'
]
WHERE buy_sell_category = 'hardware_tools';

-- =====================================================================
-- UPDATE TAGS FOR GROCERIES & SUPERMARKETS
-- =====================================================================
UPDATE public.business
SET tags = ARRAY[
  'grocery', 'groceries', 'supermarket', 'mini market',
  'convenience store', 'shop', 'retail shop', 'wholesale',
  'wholesale shop', 'food store', 'corner shop', 'milk shop',
  'bakery', 'butcher', 'butchery', 'fruits', 'vegetables',
  'fruit and veg', 'fresh produce', 'banana', 'avocado', 'tomato',
  'potato', 'onion', 'cabbage', 'meat', 'beef', 'goat meat',
  'chicken', 'fish', 'eggs', 'bread', 'cake', 'pastries',
  'biscuits', 'snacks', 'crisps', 'chips', 'rice', 'beans',
  'maize flour', 'wheat flour', 'sugar', 'salt', 'cooking oil',
  'spices', 'tea', 'coffee', 'juice', 'soft drinks', 'soda',
  'water', 'bottled water', 'drinking water', 'yogurt', 'cheese',
  'butter', 'margarine', 'canned food', 'frozen food', 'cereal',
  'baby food', 'diapers', 'cleaning products', 'soap', 'detergent',
  'bleach', 'tissue', 'toilet paper', 'toiletries', 'hygiene products',
  'supermarket delivery', 'grocery delivery'
]
WHERE buy_sell_category = 'groceries_supermarkets';

-- =====================================================================
-- UPDATE TAGS FOR FASHION & CLOTHING
-- =====================================================================
UPDATE public.business
SET tags = ARRAY[
  'boutique', 'clothes shop', 'clothing store', 'fashion shop',
  'tailor', 'tailoring', 'fundi', 'dressmaker', 'men clothes',
  'women clothes', 'kids clothes', 'baby clothes', 't shirt', 'shirt',
  'blouse', 'dress', 'skirt', 'trousers', 'pants', 'jeans', 'shorts',
  'suit', 'tuxedo', 'blazer', 'jacket', 'coat', 'sweater', 'hoodie',
  'sportswear', 'gym wear', 'football jersey', 'school uniform',
  'work uniform', 'overalls', 'safety clothing', 'kitenge',
  'african wear', 'traditional wear', 'wedding dress',
  'bridesmaid dress', 'bridal gown', 'abaya', 'hijab', 'shoes',
  'sneakers', 'trainers', 'sandals', 'heels', 'boots', 'slippers',
  'children shoes', 'bags', 'handbags', 'backpack', 'wallet', 'belt',
  'cap', 'hat', 'tie', 'scarf', 'jewelry', 'earrings', 'necklace',
  'bracelet', 'watch', 'clothing repair', 'clothes alteration',
  'resizing clothes', 'dry cleaner', 'laundry'
]
WHERE buy_sell_category = 'fashion_clothing';

-- =====================================================================
-- UPDATE TAGS FOR AUTO SERVICES & PARTS
-- =====================================================================
UPDATE public.business
SET tags = ARRAY[
  'garage', 'mechanic', 'auto repair', 'car repair', 'vehicle service',
  'car service', 'oil change', 'engine repair', 'gearbox',
  'transmission', 'brakes', 'brake pads', 'suspension',
  'shock absorber', 'steering', 'wheel alignment', 'wheel balancing',
  'tyre', 'tire', 'tyre shop', 'tyre repair', 'puncture repair',
  'battery', 'car battery', 'alternator', 'radiator', 'aircon repair',
  'ac refill', 'car wash', 'hand car wash', 'pressure wash',
  'detailing', 'polishing', 'body work', 'body repair',
  'panel beating', 'spray painting', 'auto paint', 'windscreen',
  'glass repair', 'lights', 'headlights', 'fog lights', 'wiper',
  'auto parts', 'spare parts', 'car spares', 'genuine parts',
  'used parts', 'second hand parts', 'truck repair', 'bus repair',
  'motorcycle repair', 'moto garage', 'moto parts', 'breakdown',
  'towing', 'recovery truck', 'roadside assistance', 'car accessories',
  'seat covers', 'floor mats', 'music system', 'gps tracker',
  'number plates', 'tinting'
]
WHERE buy_sell_category = 'auto_services_parts';

-- =====================================================================
-- UPDATE TAGS FOR NOTARIES & LEGAL
-- =====================================================================
UPDATE public.business
SET tags = ARRAY[
  'notary', 'public notary', 'notaire', 'legal office', 'law firm',
  'lawyer', 'attorney', 'advocate', 'counsel', 'legal advice',
  'legal services', 'contract drafting', 'contract review', 'agreement',
  'land sale agreement', 'house sale agreement', 'lease agreement',
  'tenancy agreement', 'business contract', 'company registration',
  'business registration', 'trademark', 'copyright',
  'intellectual property', 'power of attorney', 'affidavit',
  'sworn statement', 'certified copy', 'document certification',
  'signature witnessing', 'marriage contract', 'divorce case',
  'inheritance', 'succession', 'land transfer', 'title deed',
  'dispute resolution', 'mediation', 'arbitration',
  'court representation'
]
WHERE buy_sell_category = 'notaries_legal';

-- =====================================================================
-- UPDATE TAGS FOR ACCOUNTANTS & CONSULTANTS
-- =====================================================================
UPDATE public.business
SET tags = ARRAY[
  'accounting firm', 'accountant', 'bookkeeper', 'bookkeeping',
  'financial statements', 'balance sheet', 'income statement', 'audit',
  'external audit', 'internal audit', 'tax', 'tax consultant',
  'tax advice', 'tax declaration', 'tax return', 'vat', 'paye',
  'payroll', 'salary processing', 'payslip', 'social security',
  'financial planning', 'budgeting', 'cash flow', 'business plan',
  'feasibility study', 'valuation', 'company formation',
  'business registration', 'corporate governance', 'compliance',
  'risk management', 'management consulting', 'strategy consulting',
  'hr consulting', 'it consulting', 'training', 'capacity building',
  'coaching', 'business coaching', 'startup support'
]
WHERE buy_sell_category = 'accountants_consultants';

-- =====================================================================
-- UPDATE TAGS FOR BANKS & FINANCE
-- =====================================================================
UPDATE public.business
SET tags = ARRAY[
  'bank', 'commercial bank', 'microfinance', 'mfi', 'sacco',
  'financial institution', 'branch', 'atm', 'cash machine',
  'cash point', 'deposit', 'withdrawal', 'cash in', 'cash out',
  'account opening', 'savings account', 'current account',
  'fixed deposit', 'loan', 'credit', 'personal loan', 'business loan',
  'salary loan', 'mortgage', 'overdraft', 'micro loan', 'group loan',
  'interest rate', 'repayment', 'mobile banking', 'internet banking',
  'ussd banking', 'card', 'debit card', 'credit card', 'visa',
  'mastercard', 'point of sale', 'pos', 'merchant', 'foreign exchange',
  'forex', 'currency exchange', 'money transfer',
  'international transfer', 'remittance', 'western union', 'moneygram',
  'mobile money', 'momo', 'momo agent', 'wallet topup', 'bill payment',
  'school fees payment', 'utility payment', 'bank insurance products',
  'bancassurance'
]
WHERE buy_sell_category = 'banks_finance';

-- =====================================================================
-- UPDATE TAGS FOR BARS & RESTAURANTS
-- =====================================================================
UPDATE public.business
SET tags = ARRAY[
  'bar', 'pub', 'lounge', 'nightclub', 'club', 'restaurant', 'cafe',
  'coffee shop', 'fast food', 'takeaway', 'takeaway food',
  'food delivery', 'order food', 'breakfast', 'brunch', 'lunch',
  'dinner', 'snacks', 'street food', 'buffet', 'grill', 'bbq',
  'nyama choma', 'brochette', 'burger', 'pizza', 'chips',
  'fried chicken', 'local food', 'traditional food', 'african food',
  'vegetarian', 'vegan', 'healthy food', 'salad', 'dessert',
  'cake shop', 'ice cream', 'bakery cafe', 'drinks', 'soft drinks',
  'juice bar', 'milkshake', 'tea', 'coffee', 'espresso', 'cappuccino',
  'beer', 'draft beer', 'cocktail', 'spirits', 'wine', 'shisha',
  'sports bar', 'live music', 'karaoke', 'rooftop bar', 'terrace',
  'garden restaurant', 'family restaurant', 'kids friendly',
  'reservation', 'table booking', 'waiter', 'ai waiter', 'happy hour'
]
WHERE buy_sell_category = 'bars_restaurants';

-- =====================================================================
-- UPDATE TAGS FOR HOSPITALS & CLINICS
-- =====================================================================
UPDATE public.business
SET tags = ARRAY[
  'hospital', 'clinic', 'health center', 'medical center', 'polyclinic',
  'dispensary', 'private clinic', 'public hospital', 'emergency',
  'casualty', 'ambulance', 'maternity', 'maternity hospital',
  'gynecology', 'obstetrics', 'pediatrics', 'children doctor',
  'general doctor', 'gp', 'internal medicine', 'surgery', 'surgeon',
  'orthopedics', 'trauma center', 'dental clinic', 'dentist',
  'orthodontist', 'eye clinic', 'eye hospital', 'ophthalmology',
  'optical shop', 'glasses', 'physiotherapy', 'physio',
  'mental health', 'counseling', 'psychologist', 'psychiatrist',
  'laboratory', 'lab tests', 'blood test', 'urine test', 'scan',
  'x ray', 'ultrasound', 'ct scan', 'mri', 'vaccination center',
  'immunization', 'travel clinic', 'dialysis',
  'pharmacy inside hospital', 'health insurance accepted', 'nhis',
  'clinic appointment', 'specialist doctor'
]
WHERE buy_sell_category = 'hospitals_clinics';

-- =====================================================================
-- UPDATE TAGS FOR HOTELS & LODGING
-- =====================================================================
UPDATE public.business
SET tags = ARRAY[
  'hotel', 'guest house', 'guesthouse', 'lodge', 'motel', 'hostel',
  'bnb', 'bed and breakfast', 'airbnb', 'serviced apartment',
  'furnished apartment', 'room booking', 'accommodation',
  'place to sleep', 'overnight stay', 'cheap hotel', 'budget hotel',
  'midrange hotel', 'luxury hotel', 'resort', 'conference hotel',
  'meeting room', 'conference hall', 'events venue', 'wedding venue',
  'banquet hall', 'reception hall', 'swimming pool', 'spa', 'gym',
  'restaurant in hotel', 'bar in hotel', 'airport hotel',
  'near airport', 'city center hotel', 'lake view', 'mountain view',
  'long stay', 'monthly stay', 'family room', 'single room',
  'double room', 'suite', 'wifi', 'parking', 'breakfast included',
  '24h reception'
]
WHERE buy_sell_category = 'hotels_lodging';

-- =====================================================================
-- UPDATE TAGS FOR REAL ESTATE & CONSTRUCTION
-- =====================================================================
UPDATE public.business
SET tags = ARRAY[
  'real estate', 'real estate agency', 'property agent', 'broker',
  'house for rent', 'apartment for rent', 'flat for rent',
  'room for rent', 'bedsitter', 'studio apartment', 'house for sale',
  'apartment for sale', 'condo for sale', 'land for sale',
  'plot for sale', 'commercial property', 'office space', 'shop space',
  'warehouse', 'storage', 'industrial land', 'farm land',
  'agricultural land', 'rent to own', 'short stay', 'long term rent',
  'furnished', 'unfurnished', 'shared house', 'roommate',
  'hostel bed', 'building contractor', 'construction company',
  'building works', 'renovation', 'remodeling', 'house extension',
  'painting', 'interior design', 'architect', 'architecture',
  'civil engineer', 'structural engineer', 'quantity surveyor',
  'land surveyor', 'landscaping', 'paving', 'gate installation',
  'fence', 'security systems', 'cctv installation', 'solar installation'
]
WHERE buy_sell_category = 'real_estate_construction';

-- =====================================================================
-- UPDATE TAGS FOR SCHOOLS & EDUCATION
-- =====================================================================
UPDATE public.business
SET tags = ARRAY[
  'school', 'nursery', 'kindergarten', 'preschool', 'daycare',
  'primary school', 'elementary school', 'secondary school',
  'high school', 'boarding school', 'day school',
  'international school', 'bilingual school', 'university', 'college',
  'institute', 'polytechnic', 'vocational school', 'tvet',
  'training center', 'language school', 'english course',
  'french course', 'language class', 'coding school',
  'programming course', 'computer training', 'driving school',
  'music school', 'art school', 'exam preparation', 'tutoring',
  'private tutor', 'home tutor', 'online course', 'e learning',
  'short course', 'professional course', 'scholarship info',
  'school transport', 'school bus'
]
WHERE buy_sell_category = 'schools_education';

-- =====================================================================
-- UPDATE TAGS FOR TRANSPORT & LOGISTICS
-- =====================================================================
UPDATE public.business
SET tags = ARRAY[
  'transport', 'transportation', 'taxi', 'cab', 'ride', 'ride hailing',
  'moto', 'moto taxi', 'boda boda', 'bike taxi', 'car hire',
  'car rental', 'self drive', 'driver with car', 'chauffeur',
  'shuttle', 'bus', 'bus ticket', 'minibus', 'coaster',
  'airport transfer', 'airport pickup', 'airport drop',
  'city transfer', 'intercity bus', 'coach service', 'logistics',
  'cargo', 'freight', 'truck', 'lorry', 'moving service',
  'house moving', 'relocation', 'delivery', 'courier', 'parcel',
  'package delivery', 'express delivery', 'same day delivery',
  'bike delivery', 'van delivery', 'shipment',
  'international shipping', 'clearing and forwarding',
  'customs broker', 'warehousing', 'storage', 'cold room',
  'cold chain', 'container transport', 'fuel transport'
]
WHERE buy_sell_category = 'transport_logistics';

-- =====================================================================
-- UPDATE TAGS FOR OTHER SERVICES
-- =====================================================================
UPDATE public.business
SET tags = ARRAY[
  'cleaner', 'cleaning service', 'house cleaning', 'home cleaning',
  'office cleaning', 'janitor', 'maid', 'nanny', 'babysitter',
  'childcare', 'caregiver', 'elder care', 'laundry', 'dry cleaning',
  'ironing', 'wash and fold', 'tailoring repair', 'shoe repair',
  'cobbler', 'plumbing service', 'plumber', 'blocked sink',
  'leaking pipe', 'toilet repair', 'electrician', 'electrical repair',
  'wiring', 'socket repair', 'light installation', 'generator service',
  'solar technician', 'carpenter', 'furniture maker',
  'furniture repair', 'kitchen cabinets', 'wardrobe', 'painter',
  'painting service', 'decorator', 'interior decorator', 'tiler',
  'mason', 'gardener', 'landscaping service', 'lawn care',
  'tree cutting', 'pest control', 'fumigation', 'exterminator',
  'security guard', 'security company', 'watchman', 'cctv installer',
  'locksmith', 'key cutting', 'printing', 'photocopy',
  'scan documents', 'lamination', 'binding', 'graphic design',
  'logo design', 'branding', 'signage', 'banner printing',
  't shirt printing', 'photography', 'photographer', 'videographer',
  'video editor', 'studio', 'dj', 'sound system hire',
  'event planner', 'wedding planner', 'catering', 'cake maker',
  'decorator events', 'tent and chairs', 'stage hire', 'mc', 'gym',
  'fitness trainer', 'personal trainer', 'yoga', 'aerobics',
  'spa service', 'massage therapist', 'therapist', 'life coach',
  'career coach', 'it support', 'computer repair', 'laptop repair',
  'software installation', 'internet provider', 'wifi provider',
  'cyber cafe', 'gaming center', 'pet care', 'vet', 'animal clinic',
  'dog walker', 'car rental small', 'courier small', 'handyman',
  'general fundi'
]
WHERE buy_sell_category = 'other_services';

-- =====================================================================
-- ADD STATISTICS
-- =====================================================================
DO $$
DECLARE
  v_total_businesses INT;
  v_tagged_businesses INT;
  v_pharmacies INT;
  v_salons INT;
  v_electronics INT;
BEGIN
  SELECT COUNT(*) INTO v_total_businesses FROM public.business WHERE is_active = true;
  SELECT COUNT(*) INTO v_tagged_businesses FROM public.business WHERE is_active = true AND tags != '{}';
  SELECT COUNT(*) INTO v_pharmacies FROM public.business WHERE is_active = true AND 'pharmacy' = ANY(tags);
  SELECT COUNT(*) INTO v_salons FROM public.business WHERE is_active = true AND 'salon' = ANY(tags);
  SELECT COUNT(*) INTO v_electronics FROM public.business WHERE is_active = true AND 'electronics shop' = ANY(tags);
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'BUSINESS TAGS POPULATION COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total active businesses: %', v_total_businesses;
  RAISE NOTICE 'Businesses with tags: %', v_tagged_businesses;
  RAISE NOTICE 'Pharmacies tagged: %', v_pharmacies;
  RAISE NOTICE 'Salons tagged: %', v_salons;
  RAISE NOTICE 'Electronics tagged: %', v_electronics;
  RAISE NOTICE '========================================';
END $$;

COMMIT;
