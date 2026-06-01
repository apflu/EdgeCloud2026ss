import { describe, expect, it } from 'vitest';
import { deriveDashboardState } from '../lib/deriveDashboardState';
import { fallObservation, normalObservation } from '../lib/mockObservations';
import { buildRobotCommand, buildRobotOptions } from '../lib/robot';

describe('robot command builder', () => {
  it('uses idle monitoring in low severity conditions', () => {
    const data = deriveDashboardState(normalObservation());
    expect(buildRobotCommand(data)?.code).toBe('IDLE_MONITORING');
  });

  it('offers staff-notification actions when internally derived risk is critical', () => {
    const data = deriveDashboardState(fallObservation());
    const options = buildRobotOptions(data);
    expect(options.some((option) => option.staffNotification)).toBe(true);
    expect(buildRobotCommand(data)?.priority).toBe('HIGH');
  });
});
