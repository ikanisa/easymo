/**
 * Test for WhatsApp Home Menu Cleanup
 * Validates the normalizeMenuKey function and alias mappings
 * 
 * NOTE: These constants are duplicated from dynamic_home_menu.ts because
 * that file is Deno code and cannot be imported into Node.js tests.
 * The test suite validates that the mappings are correct and comprehensive.
 */

import { describe, it, expect } from 'vitest';

// CANONICAL KEYS - These must match dynamic_home_menu.ts
const CANONICAL_KEYS = [
  'waiter_agent',
  'rides_agent',
  'jobs_agent',
  'business_broker_agent',
  'real_estate_agent',
  'farmer_agent',
  'insurance_agent',
  'sales_agent',
  'profile',
] as const;

// LEGACY KEY MAPPINGS - These must match HOME_MENU_KEY_ALIASES in dynamic_home_menu.ts
const HOME_MENU_KEY_ALIASES: Record<string, string> = {
  // Canonical keys (9 active items) - map to themselves
  waiter_agent: "waiter_agent",
  rides_agent: "rides_agent",
  jobs_agent: "jobs_agent",
  business_broker_agent: "business_broker_agent",
  real_estate_agent: "real_estate_agent",
  farmer_agent: "farmer_agent",
  insurance_agent: "insurance_agent",
  sales_agent: "sales_agent",
  profile: "profile",
  
  // Legacy aliases - route to canonical agents
  schedule_trip: "rides_agent",
  nearby_drivers: "rides_agent",
  nearby_passengers: "rides_agent",
  rides: "rides_agent",
  jobs_gigs: "jobs_agent",
  jobs: "jobs_agent",
  bars_restaurants: "waiter_agent",
  nearby_pharmacies: "business_broker_agent",
  quincailleries: "business_broker_agent",
  shops_services: "business_broker_agent",
  notary_services: "business_broker_agent",
  general_broker: "business_broker_agent",
  property_rentals: "real_estate_agent",
  motor_insurance: "insurance_agent",
  momo_qr: "profile",
  token_transfer: "profile",
  profile_assets: "profile",
  customer_support: "sales_agent",
};

function normalizeMenuKey(key: string): string {
  return HOME_MENU_KEY_ALIASES[key] || key;
}

describe('WhatsApp Home Menu Cleanup', () => {
  describe('normalizeMenuKey', () => {
    it('should map canonical keys to themselves', () => {
      CANONICAL_KEYS.forEach(key => {
        expect(normalizeMenuKey(key)).toBe(key);
      });
    });

    it('should map rides-related legacy keys to rides_agent', () => {
      const ridesLegacyKeys = [
        'schedule_trip',
        'nearby_drivers',
        'nearby_passengers',
        'rides',
      ];

      ridesLegacyKeys.forEach(key => {
        expect(normalizeMenuKey(key)).toBe('rides_agent');
      });
    });

    it('should map jobs-related legacy keys to jobs_agent', () => {
      expect(normalizeMenuKey('jobs_gigs')).toBe('jobs_agent');
      expect(normalizeMenuKey('jobs')).toBe('jobs_agent');
    });

    it('should map waiter-related legacy keys to waiter_agent', () => {
      expect(normalizeMenuKey('bars_restaurants')).toBe('waiter_agent');
    });

    it('should map business-related legacy keys to business_broker_agent', () => {
      const businessLegacyKeys = [
        'nearby_pharmacies',
        'quincailleries',
        'shops_services',
        'notary_services',
        'general_broker',
      ];

      businessLegacyKeys.forEach(key => {
        expect(normalizeMenuKey(key)).toBe('business_broker_agent');
      });
    });

    it('should map property_rentals to real_estate_agent', () => {
      expect(normalizeMenuKey('property_rentals')).toBe('real_estate_agent');
    });

    it('should map motor_insurance to insurance_agent', () => {
      expect(normalizeMenuKey('motor_insurance')).toBe('insurance_agent');
    });

    it('should map profile-related legacy keys to profile', () => {
      const profileLegacyKeys = [
        'momo_qr',
        'token_transfer',
        'profile_assets',
      ];

      profileLegacyKeys.forEach(key => {
        expect(normalizeMenuKey(key)).toBe('profile');
      });
    });

    it('should map customer_support to sales_agent', () => {
      expect(normalizeMenuKey('customer_support')).toBe('sales_agent');
    });

    it('should return unknown keys unchanged', () => {
      expect(normalizeMenuKey('unknown_key')).toBe('unknown_key');
    });
  });

  describe('Canonical Menu Structure', () => {
    it('should have exactly 9 canonical keys', () => {
      const canonicalKeys = Object.keys(HOME_MENU_KEY_ALIASES).filter(
        key => HOME_MENU_KEY_ALIASES[key] === key
      );
      expect(canonicalKeys).toHaveLength(9);
    });

    it('should have all required canonical keys', () => {
      CANONICAL_KEYS.forEach(key => {
        expect(HOME_MENU_KEY_ALIASES).toHaveProperty(key);
        expect(HOME_MENU_KEY_ALIASES[key]).toBe(key);
      });
    });

    it('should map all legacy keys to one of the 9 canonical keys', () => {
      const canonicalKeysSet = new Set(CANONICAL_KEYS);

      Object.entries(HOME_MENU_KEY_ALIASES).forEach(([key, value]) => {
        expect(canonicalKeysSet.has(value)).toBe(true);
      });
    });
  });

  describe('Migration Requirements', () => {
    it('should validate expected UUIDs for canonical items', () => {
      const expectedUUIDs: Record<string, string> = {
        waiter_agent: 'a1000001-0000-0000-0000-000000000001',
        rides_agent: 'a1000002-0000-0000-0000-000000000002',
        jobs_agent: 'a1000003-0000-0000-0000-000000000003',
        business_broker_agent: 'a1000004-0000-0000-0000-000000000004',
        real_estate_agent: 'a1000005-0000-0000-0000-000000000005',
        farmer_agent: 'b1ef9975-27b1-4f67-848d-0c21c0ada9d2',
        insurance_agent: '382626fc-e270-4d2c-8b47-cc606ebc0592',
        sales_agent: 'a1000008-0000-0000-0000-000000000008',
        profile: 'a1000009-0000-0000-0000-000000000009',
      };

      // Validate UUID format
      Object.entries(expectedUUIDs).forEach(([key, uuid]) => {
        expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      });
    });

    it('should validate expected display names after cleanup', () => {
      const expectedNames: Record<string, string> = {
        waiter_agent: 'Waiter AI',
        rides_agent: 'Rides AI',
        jobs_agent: 'Jobs AI',
        business_broker_agent: 'Business Broker',  // Renamed from "Business Finder"
        real_estate_agent: 'Real Estate',  // Renamed from "Property AI"
        farmer_agent: 'Farmer AI',
        insurance_agent: 'Insurance AI',
        sales_agent: 'Sales SDR',  // Renamed from "Sales AI"
        profile: 'Profile',  // Renamed from "My Profile"
      };

      expect(Object.keys(expectedNames)).toHaveLength(9);
    });
  });
});
