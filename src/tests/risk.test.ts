import { describe, expect, it } from 'vitest';
import { normalObservation, fallObservation, elevatedRiskObservation } from '../lib/mockObservations';
import { calculateRisk } from '../lib/riskEngine';

describe('risk engine', () => {
  it('keeps normal tracking and vitals in low risk', () => {
    const patient = normalObservation().patients[0];
    const result = calculateRisk(patient);
    expect(result.severity).toBe('LOW');
    expect(result.score).toBeLessThan(45);
  });

  it('derives a warning from elevated patient observations', () => {
    const patient = elevatedRiskObservation().patients[0];
    const result = calculateRisk(patient);
    expect(['MEDIUM', 'HIGH', 'CRITICAL']).toContain(result.severity);
    expect(result.reasons.length).toBeGreaterThan(1);
  });

  it('derives critical risk from fall-like tracking and vitals', () => {
    const patient = fallObservation().patients[0];
    const result = calculateRisk(patient);
    expect(result.severity).toBe('CRITICAL');
    expect(result.reasons.some((reason) => reason.includes('possible fall'))).toBe(true);
  });
});
