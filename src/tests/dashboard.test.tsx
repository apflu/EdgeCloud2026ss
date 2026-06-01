import { describe, expect, it } from 'vitest';
import { deriveDashboardState } from '../lib/deriveDashboardState';
import { fallObservation, normalObservation } from '../lib/mockObservations';

describe('dashboard derivation pipeline', () => {
  it('creates a low-risk dashboard state from a normal observation', () => {
    const state = deriveDashboardState(normalObservation());
    expect(state.health.riskScore).toBeLessThan(45);
    expect(state.alerts).toHaveLength(0);
  });

  it('creates an alert internally from a fall-like observation', () => {
    const state = deriveDashboardState(fallObservation());
    expect(state.health.riskScore).toBeGreaterThanOrEqual(90);
    expect(state.alerts[0].severity).toBe('CRITICAL');
    expect(state.alerts[0].title).toMatch(/derived from observation/i);
  });
});
