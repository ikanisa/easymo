/**
 * Tests for feature flags
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isAgentFeatureEnabled, requireAgentFeature } from './feature-flags';

describe('Feature Flags', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('isAgentFeatureEnabled', () => {
    it('should default to false when not set', () => {
      expect(isAgentFeatureEnabled('agents.booking')).toBe(false);
      expect(isAgentFeatureEnabled('agents.redemption')).toBe(false);
      expect(isAgentFeatureEnabled('agents.triage')).toBe(false);
    });

    it('should return true when set to "true"', () => {
      process.env.FEATURE_AGENTS_BOOKING = 'true';
      expect(isAgentFeatureEnabled('agents.booking')).toBe(true);
    });

    it('should return true when set to "1"', () => {
      process.env.FEATURE_AGENTS_BOOKING = '1';
      expect(isAgentFeatureEnabled('agents.booking')).toBe(true);
    });

    it('should return true when set to "yes"', () => {
      process.env.FEATURE_AGENTS_BOOKING = 'yes';
      expect(isAgentFeatureEnabled('agents.booking')).toBe(true);
    });

    it('should return false when set to "false"', () => {
      process.env.FEATURE_AGENTS_BOOKING = 'false';
      expect(isAgentFeatureEnabled('agents.booking')).toBe(false);
    });

    it('should be case insensitive', () => {
      process.env.FEATURE_AGENTS_BOOKING = 'TRUE';
      expect(isAgentFeatureEnabled('agents.booking')).toBe(true);
    });
  });

  describe('requireAgentFeature', () => {
    it('should not throw when feature is enabled', () => {
      process.env.FEATURE_AGENTS_BOOKING = 'true';
      expect(() => {
        requireAgentFeature('agents.booking');
      }).not.toThrow();
    });

    it('should throw when feature is disabled', () => {
      process.env.FEATURE_AGENTS_BOOKING = 'false';
      expect(() => {
        requireAgentFeature('agents.booking');
      }).toThrow('Feature agents.booking is not enabled');
    });

    it('should throw when feature is not set (defaults to disabled)', () => {
      delete process.env.FEATURE_AGENTS_BOOKING;
      expect(() => {
        requireAgentFeature('agents.booking');
      }).toThrow('Feature agents.booking is not enabled');
    });
  });
});
