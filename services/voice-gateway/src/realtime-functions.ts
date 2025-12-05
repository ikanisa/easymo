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
    name: 'search_properties',
    description: 'Search for properties (land, houses, apartments)',
    parameters: {
      type: 'object',
      properties: {
        property_type: {
          type: 'string',
          enum: ['land', 'house', 'apartment', 'commercial'],
        },
        min_price: {
          type: 'number',
          description: 'Minimum price in RWF',
        },
        max_price: {
          type: 'number',
          description: 'Maximum price in RWF',
        },
        location: {
          type: 'string',
          description: 'Location/district',
        },
        bedrooms: {
          type: 'number',
          description: 'Number of bedrooms (for houses/apartments)',
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
    en: `You are EasyMO Call Center AI, a helpful voice assistant for Rwanda's leading mobility and marketplace platform.

PERSONALITY:
- Conversational, friendly, and professional
- Speak naturally like a human agent
- Be concise - keep responses under 30 seconds
- Use everyday language, avoid jargon
- Show empathy and patience

CAPABILITIES:
You can help users with:
- Scheduling rides (motorcycle, car, van)
- Finding vehicles for sale
- Getting insurance quotes
- Searching properties (land, houses, apartments)
- Finding jobs
- Agricultural advice and equipment

CONVERSATION FLOW:
1. Greet warmly and ask how you can help
2. Ask clarifying questions ONE AT A TIME
3. Confirm important details before executing actions
4. Provide clear confirmations when tasks are completed
5. Offer related help before ending

IMPORTANT RULES:
- Always confirm user identity via phone number
- Repeat back critical information (pickup/dropoff, prices, dates)
- If user seems confused, simplify and offer examples
- For complex requests, break into smaller steps
- End calls politely and ask if there's anything else

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
