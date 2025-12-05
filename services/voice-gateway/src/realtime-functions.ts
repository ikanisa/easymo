/**
 * OpenAI Realtime Function Definitions
 * 
 * Maps all Call Center AGI tools to OpenAI Realtime function format
 */

export const REALTIME_FUNCTIONS = [
  // Profile Management
  {
    name: 'get_profile',
    description: 'Get or create user profile information',
    parameters: {
      type: 'object',
      properties: {
        phone: {
          type: 'string',
          description: 'User phone number in E.164 format',
        },
      },
      required: ['phone'],
    },
  },

  // Rides (Mobility)
  {
    name: 'schedule_ride',
    description: 'Schedule a ride for the user',
    parameters: {
      type: 'object',
      properties: {
        pickup_location: {
          type: 'string',
          description: 'Pickup location (address or landmark)',
        },
        dropoff_location: {
          type: 'string',
          description: 'Dropoff location (address or landmark)',
        },
        pickup_time: {
          type: 'string',
          description: 'Pickup time (ISO 8601 format) or "now"',
        },
        vehicle_type: {
          type: 'string',
          enum: ['motorcycle', 'car', 'van'],
          description: 'Type of vehicle needed',
        },
        passengers: {
          type: 'number',
          description: 'Number of passengers',
        },
      },
      required: ['pickup_location', 'dropoff_location'],
    },
  },
  {
    name: 'check_ride_status',
    description: 'Check status of a ride',
    parameters: {
      type: 'object',
      properties: {
        ride_id: {
          type: 'string',
          description: 'Ride ID to check',
        },
      },
      required: ['ride_id'],
    },
  },
  {
    name: 'cancel_ride',
    description: 'Cancel a scheduled ride',
    parameters: {
      type: 'object',
      properties: {
        ride_id: {
          type: 'string',
          description: 'Ride ID to cancel',
        },
        reason: {
          type: 'string',
          description: 'Reason for cancellation',
        },
      },
      required: ['ride_id'],
    },
  },
  {
    name: 'get_nearby_drivers',
    description: 'Find drivers nearby a location',
    parameters: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'Location to search around',
        },
        vehicle_type: {
          type: 'string',
          enum: ['motorcycle', 'car', 'van'],
        },
        radius_km: {
          type: 'number',
          description: 'Search radius in kilometers',
        },
      },
      required: ['location'],
    },
  },

  // Marketplace (Vehicles)
  {
    name: 'search_vehicles',
    description: 'Search for vehicles for sale',
    parameters: {
      type: 'object',
      properties: {
        vehicle_type: {
          type: 'string',
          enum: ['car', 'motorcycle', 'truck', 'van'],
        },
        make: {
          type: 'string',
          description: 'Vehicle manufacturer',
        },
        model: {
          type: 'string',
          description: 'Vehicle model',
        },
        min_price: {
          type: 'number',
          description: 'Minimum price in RWF',
        },
        max_price: {
          type: 'number',
          description: 'Maximum price in RWF',
        },
        min_year: {
          type: 'number',
          description: 'Minimum year',
        },
        max_year: {
          type: 'number',
          description: 'Maximum year',
        },
        location: {
          type: 'string',
          description: 'Location/city',
        },
      },
    },
  },
  {
    name: 'get_vehicle_details',
    description: 'Get detailed information about a specific vehicle',
    parameters: {
      type: 'object',
      properties: {
        vehicle_id: {
          type: 'string',
          description: 'Vehicle ID',
        },
      },
      required: ['vehicle_id'],
    },
  },

  // Insurance
  {
    name: 'create_insurance_quote',
    description: 'Create an insurance quote for a vehicle',
    parameters: {
      type: 'object',
      properties: {
        vehicle_id: {
          type: 'string',
          description: 'Vehicle ID to insure',
        },
        coverage_type: {
          type: 'string',
          enum: ['comprehensive', 'third_party', 'third_party_fire_theft'],
          description: 'Type of coverage',
        },
        driver_age: {
          type: 'number',
          description: 'Age of primary driver',
        },
      },
      required: ['vehicle_id', 'coverage_type'],
    },
  },

  // Real Estate
  {
    name: 'create_property_request',
    description: 'Record a property search request for the property team to handle',
    parameters: {
      type: 'object',
      properties: {
        request_type: {
          type: 'string',
          enum: ['buy', 'rent', 'sell'],
          description: 'Type of property request',
        },
        property_type: {
          type: 'string',
          enum: ['land', 'house', 'apartment', 'commercial'],
        },
        location: {
          type: 'string',
          description: 'City and specific area (e.g., "Valletta, near city center")',
        },
        country: {
          type: 'string',
          enum: ['rwanda', 'malta'],
          description: 'Country for property search',
        },
        bedrooms: {
          type: 'number',
          description: 'Number of bedrooms',
        },
        budget_min: {
          type: 'number',
          description: 'Minimum budget',
        },
        budget_max: {
          type: 'number',
          description: 'Maximum budget',
        },
        currency: {
          type: 'string',
          enum: ['RWF', 'EUR', 'USD'],
          description: 'Currency for budget',
        },
        move_in_date: {
          type: 'string',
          description: 'When they need to move in (e.g., "immediately", "next month")',
        },
        furnished: {
          type: 'boolean',
          description: 'Whether they need furnished property',
        },
        special_requirements: {
          type: 'string',
          description: 'Any special requirements (parking, garden, etc.)',
        },
        contact_phone: {
          type: 'string',
          description: 'Phone number to contact user',
        },
        contact_email: {
          type: 'string',
          description: 'Email address (optional)',
        },
      },
      required: ['request_type', 'property_type', 'location', 'country', 'budget_max', 'currency', 'contact_phone'],
    },
  },

  {
    name: 'create_ride_request',
    description: 'Record a ride booking request for immediate or scheduled dispatch',
    parameters: {
      type: 'object',
      properties: {
        pickup_location: {
          type: 'string',
          description: 'Full pickup address or landmark',
        },
        dropoff_location: {
          type: 'string',
          description: 'Full destination address or landmark',
        },
        vehicle_type: {
          type: 'string',
          enum: ['moto', 'car', 'van'],
        },
        passengers: {
          type: 'number',
          description: 'Number of passengers',
        },
        luggage: {
          type: 'boolean',
          description: 'Whether they have luggage',
        },
        schedule_time: {
          type: 'string',
          description: 'When they need the ride (e.g., "now", "tomorrow 9am", "Dec 10 at 3pm")',
        },
        flight_time: {
          type: 'string',
          description: 'Flight time if going to airport (for timing)',
        },
        special_requirements: {
          type: 'string',
          description: 'Any special needs (child seat, wheelchair, etc.)',
        },
        contact_phone: {
          type: 'string',
          description: 'Phone number to contact user',
        },
      },
      required: ['pickup_location', 'dropoff_location', 'vehicle_type', 'schedule_time', 'contact_phone'],
    },
  },

  {
    name: 'create_inquiry',
    description: 'Record a general inquiry or request that needs follow-up',
    parameters: {
      type: 'object',
      properties: {
        inquiry_type: {
          type: 'string',
          enum: ['vehicle_sale', 'insurance', 'job_search', 'agriculture', 'business', 'other'],
        },
        description: {
          type: 'string',
          description: 'Full description of what the user needs',
        },
        urgency: {
          type: 'string',
          enum: ['urgent', 'normal', 'low'],
          description: 'How urgent is this request',
        },
        preferred_contact_method: {
          type: 'string',
          enum: ['phone', 'whatsapp', 'email'],
        },
        contact_phone: {
          type: 'string',
        },
        contact_email: {
          type: 'string',
        },
        best_time_to_call: {
          type: 'string',
          description: 'Best time to reach them',
        },
      },
      required: ['inquiry_type', 'description', 'contact_phone'],
    },
  },

  // Keep existing search_properties for immediate info only
  {
    name: 'search_properties',
    description: 'Quick search to give user general info about availability (use create_property_request to record actual request)',
    parameters: {
      type: 'object',
      properties: {
        property_type: {
          type: 'string',
          enum: ['land', 'house', 'apartment', 'commercial'],
        },
        location: {
          type: 'string',
          description: 'Location/district',
        },
      },
    },
  },

  // Jobs
  {
    name: 'search_jobs',
    description: 'Search for job opportunities',
    parameters: {
      type: 'object',
      properties: {
        job_category: {
          type: 'string',
          description: 'Job category or industry',
        },
        location: {
          type: 'string',
          description: 'Job location',
        },
        experience_level: {
          type: 'string',
          enum: ['entry', 'mid', 'senior'],
        },
      },
    },
  },

  // Agriculture
  {
    name: 'get_farming_advice',
    description: 'Get agricultural advice and tips',
    parameters: {
      type: 'object',
      properties: {
        crop_type: {
          type: 'string',
          description: 'Type of crop',
        },
        issue: {
          type: 'string',
          description: 'Problem or question about farming',
        },
      },
    },
  },
  {
    name: 'search_equipment',
    description: 'Search for farming equipment',
    parameters: {
      type: 'object',
      properties: {
        equipment_type: {
          type: 'string',
          description: 'Type of equipment needed',
        },
        rental_or_purchase: {
          type: 'string',
          enum: ['rent', 'buy'],
        },
      },
    },
  },

  // General
  {
    name: 'get_help',
    description: 'Get help with using EasyMO services',
    parameters: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'Topic user needs help with',
        },
      },
    },
  },
];

/**
 * Build system prompt for Call Center AGI in Realtime mode
 */
export function buildCallCenterPrompt(config: {
  language?: string;
  userName?: string;
  userContext?: Record<string, any>;
}): string {
  const lang = config.language || 'en';
  
  const prompts: Record<string, string> = {
    en: `You are EasyMO Call Center AI, a helpful voice assistant for EasyMO's multi-country mobility and marketplace platform (Rwanda & Malta).

YOUR ROLE:
You are an INFORMATION COLLECTOR and FIRST CONTACT agent. Your job is to:
1. Understand what the user needs through natural conversation
2. Ask ALL relevant questions to collect complete information
3. Record the request in the system
4. Let specialized agents handle the actual fulfillment later

PERSONALITY:
- Conversational, friendly, and professional
- Speak naturally like a human receptionist
- Be proactive - ask questions before user realizes they're needed
- Keep responses under 30 seconds
- Show empathy and patience

SERVICES:
- Rwanda: Rides (moto/car), vehicles, properties, jobs, agriculture (currency: RWF)
- Malta: Properties, rentals (currency: EUR)

YOUR CONVERSATION STRATEGY:
1. LISTEN & UNDERSTAND: "I can help with that! Let me get some details..."
2. ASK SMART QUESTIONS: Ask one question at a time, collect ALL needed info
3. CONFIRM & CLARIFY: Repeat back to ensure accuracy
4. RECORD REQUEST: Save to database with complete information
5. SET EXPECTATIONS: "I've recorded your request. Our [property/ride/vehicle] team will contact you within [timeframe]"

CRITICAL: BE PROACTIVE WITH QUESTIONS

Example - Property Search:
User: "I need a 2 bedroom apartment in Valletta for 2000 euro per month"
You ask:
  - "When are you looking to move in?" (timing)
  - "Is this for yourself or family?" (occupancy)
  - "Any specific area in Valletta you prefer?" (location details)
  - "Do you need furnished or unfurnished?" (requirements)
  - "What's your phone number so our property team can reach you?" (contact)
  
Example - Ride Request:
User: "I need a ride to the airport"
You ask:
  - "Which airport - Kigali International?" (destination)
  - "When do you need the ride?" (timing)
  - "What time is your flight?" (context for timing)
  - "Where should we pick you up?" (pickup location)
  - "How many passengers?" (vehicle type)
  - "Do you have luggage?" (vehicle size)

INFORMATION COLLECTION RULES:
- ALWAYS ask for contact information (phone/email)
- ALWAYS ask for timing (when they need it)
- ALWAYS ask for budget/price range
- ALWAYS ask for specific locations (not just "city")
- ALWAYS ask for any special requirements
- For currency: Detect from location (Valletta=EUR, Kigali=RWF) or ask explicitly

TOOLS YOU HAVE:
Use tools to RECORD requests, not to search immediately:
- create_property_request: Record property search details
- create_ride_request: Record ride booking details  
- create_inquiry: Record general questions
- get_user_info: Look up returning customers

DO NOT promise immediate results. Instead say:
✅ "I've recorded your request for a 2-bedroom apartment in Valletta under €2000/month. Our property team will send you available options within 2 hours."
❌ "Let me search for apartments now..." (Don't do real-time search)

ENDING CALLS:
- Confirm what you've recorded
- Give timeframe for follow-up
- Ask "Is there anything else I can help you with?"
- End warmly: "Thank you for calling EasyMO, have a great day!"

${config.userName ? `USER: ${config.userName}` : ''}
${config.userContext ? `CONTEXT: ${JSON.stringify(config.userContext)}` : ''}`,

    rw: `Uri EasyMO Call Center AI, umufasha w'ijwi wifuza gufasha mu Rwanda ku serivisi z'ubutwararane n'isoko.

IMICO:
- Kugira ubucuti, kwerekana ishyaka n'ubwubahizi
- Vugana nk'umuntu usanzwe
- Vuga muri make - igisubizo kitarenze amasegonda 30
- Koresha ururimi rworoshye
- Erekana impuhwe n'umwete

UBUSHOBOZI:
Urashobora gufasha abakiriya muri:
- Guteganya urugendo (pikipiki, imodoka, van)
- Gushaka ibinyabiziga bigurishwa
- Kubona amakuru ku bwishingizi
- Gushaka imitungo (ubutaka, amazu, apartman)
- Gushaka akazi
- Ubujyanama ku buhinzi n'ibikoresho

${config.userName ? `UMUKORESHA: ${config.userName}` : ''}`,

    fr: `Vous êtes l'IA du Centre d'Appels EasyMO, un assistant vocal utile pour la principale plateforme de mobilité et de marché du Rwanda.

PERSONNALITÉ:
- Conversationnel, amical et professionnel
- Parlez naturellement comme un agent humain
- Soyez concis - gardez les réponses sous 30 secondes
- Utilisez un langage courant
- Montrez de l'empathie et de la patience

CAPACITÉS:
Vous pouvez aider avec:
- Planifier des trajets (moto, voiture, van)
- Trouver des véhicules à vendre
- Obtenir des devis d'assurance
- Rechercher des propriétés
- Trouver des emplois
- Conseils agricoles

${config.userName ? `UTILISATEUR: ${config.userName}` : ''}`,

    sw: `Wewe ni EasyMO Call Center AI, msaidizi wa sauti anayesaidia kwenye jukwaa kuu la usafiri na soko nchini Rwanda.

TABIA:
- Uwe wa mazungumzo, rafiki na mtaalamu
- Zungumza asilia kama wakala wa binadamu
- Kuwa mfupi - weka majibu chini ya sekunde 30
- Tumia lugha ya kawaida
- Onyesha huruma na uvumilivu

UWEZO:
Unaweza kusaidia na:
- Kupanga safari (pikipiki, gari, van)
- Kutafuta magari ya kuuza
- Kupata nukuu za bima
- Kutafuta mali
- Kutafuta kazi
- Ushauri wa kilimo

${config.userName ? `MTUMIAJI: ${config.userName}` : ''}`,
  };

  return prompts[lang] || prompts['en'];
}
