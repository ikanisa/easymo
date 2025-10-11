import { describe, it, expect } from 'vitest';
import {
  timeAgo,
  chatLink,
  momoTelLink,
  formatPhone,
  VEHICLE_LABELS,
  STATUS_VARIANTS
} from './format';

describe('Time formatting', () => {
  it('should format time differences correctly', () => {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    expect(timeAgo(fiveMinutesAgo.toISOString())).toBe('5m ago');
    expect(timeAgo(oneHourAgo.toISOString())).toBe('1h ago');
    expect(timeAgo(oneDayAgo.toISOString())).toBe('1d ago');
  });

  it('should handle recent times', () => {
    const now = new Date();
    const thirtySecondsAgo = new Date(now.getTime() - 30 * 1000);
    
    expect(timeAgo(thirtySecondsAgo.toISOString())).toBe('now');
  });

  it('should handle future dates gracefully', () => {
    const future = new Date(Date.now() + 60000).toISOString();
    const result = timeAgo(future);
    expect(result).toBe('now');
  });
});

describe('Phone number formatting', () => {
  it('should format Rwanda phone numbers correctly', () => {
    expect(formatPhone('+250788123456')).toBe('+250 788 123 456');
  });

  it('should handle phones that do not match pattern', () => {
    expect(formatPhone('+1234567890')).toBe('+1234567890');
    expect(formatPhone('invalid')).toBe('invalid');
  });
});

describe('WhatsApp chat links', () => {
  it('should build chat links correctly', () => {
    const link = chatLink('+250788123456', 'Hello');
    expect(link).toBe('https://wa.me/250788123456?text=Hello');
  });

  it('should encode messages properly', () => {
    const link = chatLink('+250788123456', 'Hello world!');
    expect(link).toBe('https://wa.me/250788123456?text=Hello%20world!');
  });

  it('should clean phone numbers', () => {
    const link = chatLink('+250-788-123-456', 'Test');
    expect(link).toBe('https://wa.me/250788123456?text=Test');
  });
});

describe('MoMo payment links', () => {
  it('should build MoMo USSD links correctly', () => {
    const link = momoTelLink('0788123456', 5000);
    expect(link).toBe('tel:*182*1*0788123456*5000%23');
  });

  it('should clean phone numbers for MoMo', () => {
    const link = momoTelLink('+250-788-123-456', 1000);
    expect(link).toBe('tel:*182*1*250788123456*1000%23');
  });
});

describe('Vehicle labels', () => {
  it('should provide display labels for all vehicle types', () => {
    expect(VEHICLE_LABELS.moto).toBe('Moto Taxi');
    expect(VEHICLE_LABELS.cab).toBe('Cab');
    expect(VEHICLE_LABELS.lifan).toBe('Lifan');
    expect(VEHICLE_LABELS.truck).toBe('Truck');
    expect(VEHICLE_LABELS.others).toBe('Others');
  });

  it('should handle unknown vehicle types', () => {
    expect(VEHICLE_LABELS.unknown).toBeUndefined();
  });
});

describe('Status variants', () => {
  it('should map statuses to proper badge variants', () => {
    expect(STATUS_VARIANTS.active).toBe('default');
    expect(STATUS_VARIANTS.pending_review).toBe('secondary');
    expect(STATUS_VARIANTS.expired).toBe('outline');
    expect(STATUS_VARIANTS.rejected).toBe('destructive');
    expect(STATUS_VARIANTS.open).toBe('default');
    expect(STATUS_VARIANTS.none).toBe('outline');
  });

  it('should handle unknown statuses', () => {
    expect(STATUS_VARIANTS.unknown).toBeUndefined();
  });
});