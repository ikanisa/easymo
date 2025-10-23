import { describe, it, expect } from 'vitest';
import { classify } from './suggestions.controller';

describe('suggestions classify()', () => {
  it('detects pharmacy intents', () => {
    expect(classify('nearest pharmacy Kigali')).toBe('pharmacy');
    expect(classify('need medic help')).toBe('pharmacy');
  });
  it('detects bar intents', () => {
    expect(classify('best bar with drinks')).toBe('bar');
    expect(classify('wine and beer tonight')).toBe('bar');
  });
  it('detects live music', () => {
    expect(classify('bars with live music')).toBe('live-music');
  });
  it('defaults to general', () => {
    expect(classify('looking for something')).toBe('general');
  });
});
