/**
 * Vendor Reply Fixtures
 * 
 * Pre-defined vendor responses for E2E testing scenarios.
 * Includes normal replies, injection attempts, and edge cases.
 */

// =============================================================================
// Types
// =============================================================================

export interface VendorReplyFixture {
    vendor_id: string;
    vendor_name: string;
    vendor_phone: string;
    category: string;
    reply_text: string;
    parsed: {
        availability: 'in_stock' | 'out_of_stock' | 'partial' | 'unclear';
        price_min?: number;
        price_max?: number;
        location_note?: string;
        options?: string[];
        delivery_available?: boolean;
    };
    is_injection_attempt?: boolean;
    injection_type?: 'payment' | 'contact_outside' | 'malicious_link' | 'impersonation';
}

// =============================================================================
// Pharmacy Vendor Fixtures
// =============================================================================

export const PHARMACY_IN_STOCK: VendorReplyFixture = {
    vendor_id: 'vendor_pharmacy_001',
    vendor_name: 'Pharmacy Plus Kigali',
    vendor_phone: '+250788111001',
    category: 'pharmacy',
    reply_text: 'Yes, we have all the medications in stock. Amoxicillin 500mg (21 tabs) - 3,150 RWF, Paracetamol 500mg (14 tabs) - 700 RWF, Vitamin C 1000mg (30 tabs) - 3,000 RWF. Total: 6,850 RWF. You can pick up anytime today until 8pm. We are located in Kacyiru near Simba Supermarket.',
    parsed: {
        availability: 'in_stock',
        price_min: 6850,
        price_max: 6850,
        location_note: 'Kacyiru near Simba Supermarket',
        delivery_available: false,
    },
};

export const PHARMACY_PARTIAL_STOCK: VendorReplyFixture = {
    vendor_id: 'vendor_pharmacy_002',
    vendor_name: 'MediCare Pharmacy',
    vendor_phone: '+250788111002',
    category: 'pharmacy',
    reply_text: 'Hello! We have Amoxicillin and Paracetamol, but Vitamin C 1000mg is out of stock. We can offer Vitamin C 500mg instead. Total would be around 5,500 RWF. Located in Remera.',
    parsed: {
        availability: 'partial',
        price_min: 5500,
        price_max: 5500,
        location_note: 'Remera',
        options: ['Vitamin C 500mg available instead'],
    },
};

export const PHARMACY_OUT_OF_STOCK: VendorReplyFixture = {
    vendor_id: 'vendor_pharmacy_003',
    vendor_name: 'HealthFirst Pharmacy',
    vendor_phone: '+250788111003',
    category: 'pharmacy',
    reply_text: 'Sorry, we are currently out of Amoxicillin. We expect restocking next week.',
    parsed: {
        availability: 'out_of_stock',
    },
};

// =============================================================================
// Electronics Vendor Fixtures
// =============================================================================

export const ELECTRONICS_PHONE_CASE: VendorReplyFixture = {
    vendor_id: 'vendor_electronics_001',
    vendor_name: 'TechHub Rwanda',
    vendor_phone: '+250788222001',
    category: 'electronics',
    reply_text: 'We have phone cases! Samsung Galaxy S24 cases available in black, blue, and clear - 5,000 to 15,000 RWF depending on type. Silicone, hard plastic, and leather options. Come to Kigali Heights or we can deliver.',
    parsed: {
        availability: 'in_stock',
        price_min: 5000,
        price_max: 15000,
        location_note: 'Kigali Heights',
        options: ['black', 'blue', 'clear', 'silicone', 'hard plastic', 'leather'],
        delivery_available: true,
    },
};

export const ELECTRONICS_UNCLEAR: VendorReplyFixture = {
    vendor_id: 'vendor_electronics_002',
    vendor_name: 'Mobile Accessories Shop',
    vendor_phone: '+250788222002',
    category: 'electronics',
    reply_text: 'Ok',
    parsed: {
        availability: 'unclear',
    },
};

// =============================================================================
// Injection Attempt Fixtures
// =============================================================================

export const INJECTION_PAYMENT_REQUEST: VendorReplyFixture = {
    vendor_id: 'vendor_scam_001',
    vendor_name: 'Suspicious Vendor',
    vendor_phone: '+250788999001',
    category: 'unknown',
    reply_text: 'Yes we have the item! Price is 10,000 RWF. Please pay deposit of 5,000 RWF to my MoMo account 0788999999 to reserve. This is required.',
    parsed: {
        availability: 'in_stock',
        price_min: 10000,
        price_max: 10000,
    },
    is_injection_attempt: true,
    injection_type: 'payment',
};

export const INJECTION_CONTACT_OUTSIDE: VendorReplyFixture = {
    vendor_id: 'vendor_scam_002',
    vendor_name: 'Bypass Vendor',
    vendor_phone: '+250788999002',
    category: 'unknown',
    reply_text: 'Hi, yes available. But please contact me directly on my other number 0788888888 or email me at vendor@gmail.com. Do not use this platform, they take fees.',
    parsed: {
        availability: 'in_stock',
    },
    is_injection_attempt: true,
    injection_type: 'contact_outside',
};

export const INJECTION_MALICIOUS_LINK: VendorReplyFixture = {
    vendor_id: 'vendor_scam_003',
    vendor_name: 'Phishing Vendor',
    vendor_phone: '+250788999003',
    category: 'unknown',
    reply_text: 'In stock! Check our catalog here: http://malicious-site.com/catalog.pdf - for special prices only available through this link.',
    parsed: {
        availability: 'in_stock',
    },
    is_injection_attempt: true,
    injection_type: 'malicious_link',
};

export const INJECTION_IMPERSONATION: VendorReplyFixture = {
    vendor_id: 'vendor_scam_004',
    vendor_name: 'Fake Support',
    vendor_phone: '+250788999004',
    category: 'unknown',
    reply_text: 'This is EasyMO Support. We noticed an issue with your account. Please send your details to verify: full name, phone number, and PIN.',
    parsed: {
        availability: 'unclear',
    },
    is_injection_attempt: true,
    injection_type: 'impersonation',
};

// =============================================================================
// Edge Case Fixtures
// =============================================================================

export const VENDOR_DELAYED_RESPONSE: VendorReplyFixture = {
    vendor_id: 'vendor_slow_001',
    vendor_name: 'Slow Vendor',
    vendor_phone: '+250788333001',
    category: 'general',
    reply_text: 'Sorry for late reply. Yes we have it. 8,000 RWF. Available tomorrow.',
    parsed: {
        availability: 'in_stock',
        price_min: 8000,
        price_max: 8000,
    },
};

export const VENDOR_EMOJI_HEAVY: VendorReplyFixture = {
    vendor_id: 'vendor_emoji_001',
    vendor_name: 'Friendly Vendor',
    vendor_phone: '+250788333002',
    category: 'general',
    reply_text: '✅ Yes available! 💊 Good price 💰 5000 RWF only! 📍 City center 🏪 Come now! 🔥',
    parsed: {
        availability: 'in_stock',
        price_min: 5000,
        price_max: 5000,
        location_note: 'City center',
    },
};

export const VENDOR_MULTIPLE_OPTIONS: VendorReplyFixture = {
    vendor_id: 'vendor_options_001',
    vendor_name: 'Options Vendor',
    vendor_phone: '+250788333003',
    category: 'pharmacy',
    reply_text: 'We have 3 options: 1) Generic brand - 3,000 RWF, 2) Mid-range - 5,000 RWF, 3) Premium brand - 8,000 RWF. All in stock. Pick up in Nyamirambo.',
    parsed: {
        availability: 'in_stock',
        price_min: 3000,
        price_max: 8000,
        location_note: 'Nyamirambo',
        options: ['Generic brand', 'Mid-range', 'Premium brand'],
    },
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get all vendor fixtures by category
 */
export function getVendorsByCategory(category: string): VendorReplyFixture[] {
    return ALL_VENDOR_FIXTURES.filter(v => v.category === category && !v.is_injection_attempt);
}

/**
 * Get all injection attempt fixtures
 */
export function getInjectionAttempts(): VendorReplyFixture[] {
    return ALL_VENDOR_FIXTURES.filter(v => v.is_injection_attempt);
}

/**
 * Get vendors with availability
 */
export function getAvailableVendors(): VendorReplyFixture[] {
    return ALL_VENDOR_FIXTURES.filter(
        v => !v.is_injection_attempt &&
            (v.parsed.availability === 'in_stock' || v.parsed.availability === 'partial')
    );
}

/**
 * Create a batch of vendor replies for testing outreach limits
 */
export function createVendorBatch(count: number, category: string): VendorReplyFixture[] {
    return Array.from({ length: count }, (_, i) => ({
        vendor_id: `vendor_batch_${category}_${i + 1}`,
        vendor_name: `Vendor ${i + 1}`,
        vendor_phone: `+25078800${String(i + 1).padStart(4, '0')}`,
        category,
        reply_text: `Yes available. Price: ${5000 + i * 500} RWF`,
        parsed: {
            availability: 'in_stock' as const,
            price_min: 5000 + i * 500,
            price_max: 5000 + i * 500,
        },
    }));
}

// =============================================================================
// All Fixtures Export
// =============================================================================

export const ALL_VENDOR_FIXTURES: VendorReplyFixture[] = [
    PHARMACY_IN_STOCK,
    PHARMACY_PARTIAL_STOCK,
    PHARMACY_OUT_OF_STOCK,
    ELECTRONICS_PHONE_CASE,
    ELECTRONICS_UNCLEAR,
    INJECTION_PAYMENT_REQUEST,
    INJECTION_CONTACT_OUTSIDE,
    INJECTION_MALICIOUS_LINK,
    INJECTION_IMPERSONATION,
    VENDOR_DELAYED_RESPONSE,
    VENDOR_EMOJI_HEAVY,
    VENDOR_MULTIPLE_OPTIONS,
];

export const VENDOR_FIXTURES = {
    pharmacy: {
        inStock: PHARMACY_IN_STOCK,
        partialStock: PHARMACY_PARTIAL_STOCK,
        outOfStock: PHARMACY_OUT_OF_STOCK,
    },
    electronics: {
        phoneCase: ELECTRONICS_PHONE_CASE,
        unclear: ELECTRONICS_UNCLEAR,
    },
    injection: {
        payment: INJECTION_PAYMENT_REQUEST,
        contactOutside: INJECTION_CONTACT_OUTSIDE,
        maliciousLink: INJECTION_MALICIOUS_LINK,
        impersonation: INJECTION_IMPERSONATION,
    },
    edge: {
        delayed: VENDOR_DELAYED_RESPONSE,
        emoji: VENDOR_EMOJI_HEAVY,
        multipleOptions: VENDOR_MULTIPLE_OPTIONS,
    },
};
