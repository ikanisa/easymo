import { describe, expect, it } from 'vitest';

import type { VoiceCall } from '@/features/voice/types';
import { formatAverage, resolveDurationSeconds } from '@/pages/VoiceOps';

describe('resolveDurationSeconds', () => {
  const baseCall: VoiceCall = {
    id: 'call-1',
    direction: 'inbound',
    startedAt: new Date('2025-01-01T12:00:00Z').toISOString(),
  };

  it('returns the provided duration when present', () => {
    const result = resolveDurationSeconds({ ...baseCall, durationSeconds: 125 });
    expect(result).toBe(125);
  });

  it('calculates duration from timestamps when not provided', () => {
    const result = resolveDurationSeconds({
      ...baseCall,
      startedAt: '2025-01-01T12:00:00Z',
      endedAt: '2025-01-01T12:03:45Z',
    });
    expect(result).toBe(225);
  });

  it('returns null when timestamps are invalid', () => {
    const result = resolveDurationSeconds({ ...baseCall, startedAt: 'invalid', endedAt: 'invalid' });
    expect(result).toBeNull();
  });

  it('returns null when call has not ended and no explicit duration', () => {
    const result = resolveDurationSeconds(baseCall);
    expect(result).toBeNull();
  });
});

describe('formatAverage', () => {
  it('returns placeholder when there is no data', () => {
    expect(formatAverage(null, 0)).toEqual({ value: '—', description: 'No completed calls yet' });
    expect(formatAverage(0, 0)).toEqual({ value: '—', description: 'No completed calls yet' });
  });

  it('formats minutes and seconds for positive durations', () => {
    expect(formatAverage(185, 3)).toEqual({ value: '3m 5s', description: 'Across 3 completed calls' });
  });

  it('handles singular sample size correctly', () => {
    expect(formatAverage(59, 1)).toEqual({ value: '0m 59s', description: 'Across 1 completed call' });
  });
});
