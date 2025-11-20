/**
 * EasyMO Service Catalog
 * 
 * Defines allowed verticals and services for the EasyMO platform.
 * Used for scope validation in General Broker Agent.
 */

export const EASYMO_VERTICALS = [
  'mobility',
  'commerce',
  'hospitality',
  'insurance',
  'property',
  'legal',
  'jobs',
  'farming',
  'marketing',
  'sora_video',
  'payments',
  'support',
] as const;

export type EasyMOVertical = typeof EASYMO_VERTICALS[number];

export interface ServiceDefinition {
  name: string;
  description: string;
  agents: string[];
  keywords: string[];
}

export const SERVICE_CATALOG: Record<EasyMOVertical, ServiceDefinition> = {
  mobility: {
    name: 'Mobility & Transportation',
    description: 'Ride booking, driver matching, trip scheduling',
    agents: ['nearby-drivers', 'schedule-trip'],
    keywords: ['ride', 'driver', 'transport', 'trip', 'taxi', 'moto', 'car', 'travel'],
  },
  commerce: {
    name: 'Commerce & Shopping',
    description: 'Shop discovery, product search, vendor matching',
    agents: ['shops', 'quincaillerie', 'pharmacy'],
    keywords: ['shop', 'buy', 'purchase', 'product', 'store', 'vendor', 'sell'],
  },
  hospitality: {
    name: 'Hospitality & Dining',
    description: 'Restaurant booking, menu lookup, table reservations',
    agents: ['waiter-ai', 'booking'],
    keywords: ['restaurant', 'menu', 'table', 'book', 'reserve', 'food', 'drink', 'bar', 'waiter'],
  },
  insurance: {
    name: 'Insurance Services',
    description: 'Insurance quotes, policy management, claims',
    agents: ['insurance'],
    keywords: ['insurance', 'policy', 'claim', 'coverage', 'premium'],
  },
  property: {
    name: 'Real Estate',
    description: 'Property search, rental listings, landlord matching',
    agents: ['real-estate', 'property-rental'],
    keywords: ['rent', 'house', 'apartment', 'property', 'land', 'room', 'lease', 'tenant', 'landlord'],
  },
  legal: {
    name: 'Legal Services',
    description: 'Legal consultation, document preparation, lawyer matching',
    agents: ['legal'],
    keywords: ['legal', 'lawyer', 'attorney', 'contract', 'court', 'law'],
  },
  jobs: {
    name: 'Jobs & Employment',
    description: 'Job search, applications, employer matching',
    agents: ['jobs-board'],
    keywords: ['job', 'work', 'career', 'hire', 'vacancy', 'employment', 'apply', 'resume', 'cv'],
  },
  farming: {
    name: 'Farming & Agriculture',
    description: 'Commodity trading, market prices, farming services',
    agents: ['farmers-agent'],
    keywords: ['farm', 'crop', 'seed', 'fertilizer', 'harvest', 'market', 'commodity', 'agriculture'],
  },
  marketing: {
    name: 'Marketing & Sales',
    description: 'Campaign management, CRM, Sora video ads',
    agents: ['marketing-sales'],
    keywords: ['marketing', 'campaign', 'ads', 'crm', 'sales', 'promotion', 'sora', 'video'],
  },
  sora_video: {
    name: 'Sora Video Ads',
    description: 'AI-generated video advertisements using Sora-2',
    agents: ['sora-video'],
    keywords: ['sora', 'video', 'ad', 'advertisement', 'ai video', 'generate video'],
  },
  payments: {
    name: 'Payments & Wallet',
    description: 'Payment processing, wallet management, transfers',
    agents: ['payments', 'wallet'],
    keywords: ['pay', 'payment', 'wallet', 'transfer', 'money', 'balance', 'topup'],
  },
  support: {
    name: 'Customer Support',
    description: 'Help, troubleshooting, issue resolution',
    agents: ['customer-support'],
    keywords: ['help', 'support', 'problem', 'issue', 'question', 'complaint', 'error'],
  },
};

/**
 * Check if a vertical is valid EasyMO service
 */
export function isValidVertical(vertical: string): vertical is EasyMOVertical {
  return EASYMO_VERTICALS.includes(vertical as EasyMOVertical);
}

/**
 * Get service definition for a vertical
 */
export function getServiceDefinition(vertical: EasyMOVertical): ServiceDefinition | null {
  return SERVICE_CATALOG[vertical] || null;
}

/**
 * Get all available EasyMO services as a formatted string
 */
export function getAvailableServices(): string {
  return EASYMO_VERTICALS
    .map(v => SERVICE_CATALOG[v].name)
    .join(', ');
}

/**
 * Detect vertical from keywords in query
 */
export function detectVerticalFromQuery(query: string): EasyMOVertical | null {
  const lowerQuery = query.toLowerCase();
  
  for (const [vertical, service] of Object.entries(SERVICE_CATALOG)) {
    const matchCount = service.keywords.filter(kw => lowerQuery.includes(kw)).length;
    if (matchCount > 0) {
      return vertical as EasyMOVertical;
    }
  }
  
  return null;
}

/**
 * Out-of-scope patterns (topics NOT allowed)
 */
export const OUT_OF_SCOPE_PATTERNS = [
  /news|politics|election|government|president/i,
  /health|medical|doctor|medicine|covid|disease/i,
  /quantum|physics|chemistry|science|biology/i,
  /weather|climate|temperature|forecast/i,
  /sports|football|basketball|soccer|tennis/i,
  /celebrity|entertainment|movie|film|music|song/i,
  /school|homework|exam|study|university|college/i,
  /recipe|cooking(?! oil)|baking/i, // Allow "cooking oil" as commodity
  /history|geography|math|calculus/i,
];

/**
 * Check if query is out of EasyMO scope
 */
export function isOutOfScope(query: string): boolean {
  return OUT_OF_SCOPE_PATTERNS.some(pattern => pattern.test(query));
}

/**
 * Get out-of-scope response message
 */
export function getOutOfScopeMessage(language: 'en' | 'fr' | 'rw' | 'sw' | 'ln' = 'en'): string {
  const messages = {
    en: "I'm your EasyMO assistant. I can help with services like orders, property, jobs, farming, insurance, vendors, marketing and Sora videos. I can't help with topics outside EasyMO.",
    fr: "Je suis votre assistant EasyMO. Je peux vous aider avec des services comme les commandes, l'immobilier, les emplois, l'agriculture, l'assurance, les vendeurs, le marketing et les vidéos Sora. Je ne peux pas aider avec des sujets en dehors d'EasyMO.",
    rw: "Ndi umufasha wawe wa EasyMO. Nshobora kugufasha mu bikorwa nko gutumiza, imitungo, akazi, ubuhinzi, ubwishingizi, abacuruzi, kwamamaza na videwo za Sora. Sinshobora gufasha mu ngingo zitari za EasyMO.",
    sw: "Mimi ni msaidizi wako wa EasyMO. Ninaweza kusaidia na huduma kama maagizo, mali, kazi, kilimo, bima, wachuuzi, masoko na video za Sora. Siwezi kusaidia na mada nje ya EasyMO.",
    ln: "Nazali mosalisi na yo ya EasyMO. Nakoki kosalisa yo na misala lokola ba commandes, biloko, mosala, bilanga, assurance, bateki, marketing na ba vidéo Sora. Nakoki te kosalisa yo na makambo oyo ezali libanda ya EasyMO.",
  };
  
  return messages[language] || messages.en;
}
