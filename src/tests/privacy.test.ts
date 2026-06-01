import { describe, expect, it } from 'vitest';
import { deriveDashboardState } from '../lib/deriveDashboardState';
import { normalObservation } from '../lib/mockObservations';
import { canShowRawVideo, describePrivacyState, isPrivacyHealthy } from '../lib/privacy';

describe('privacy logic', () => {
  const data = deriveDashboardState(normalObservation());

  it('keeps the interface privacy healthy by default', () => {
    expect(isPrivacyHealthy(data)).toBe(true);
    expect(describePrivacyState(data)).toMatch(/Protected/);
  });

  it('blocks raw video for normal operator roles', () => {
    expect(canShowRawVideo(data, 'operator')).toBe(false);
  });
});
