import { evaluateAttribution } from '../src/evaluator';

describe('evaluateAttribution', () => {
  it('prefers CTWA endorser id when present', () => {
    const res = evaluateAttribution({ referrals: ['ctwa:endorser-99'], events: [] });
    expect(res.type).toBe('ENDORSER');
    expect(res.entityId).toBe('99');
  });

  it('falls back to endorser click within timebox window', () => {
    const now = Date.now();
    const res = evaluateAttribution({
      events: [{ type: 'CONTACT_ENDORSER', endorserId: 'abc', timestamp: new Date(now - 60_000).toISOString() }],
      timeboxDays: 7,
    });
    expect(res.type).toBe('ENDORSER');
    expect(res.entityId).toBe('abc');
  });

  it('assigns AGENT when no endorser signals and agent assist present', () => {
    const res = evaluateAttribution({
      events: [{ type: 'AGENT_ASSIST', agentId: 'agent-1' }],
    });
    expect(res.type).toBe('AGENT');
    expect(res.entityId).toBe('agent-1');
  });
});

