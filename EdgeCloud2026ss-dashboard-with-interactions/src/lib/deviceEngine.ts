import type { DeviceItem, DeviceStatus } from '../types/dashboard';
import type { IncomingPatient } from '../types/incoming';

function minutesSince(timestamp: string): number {
  const parsed = new Date(timestamp).getTime();
  if (Number.isNaN(parsed)) return Number.POSITIVE_INFINITY;
  return (Date.now() - parsed) / 1000 / 60;
}

export function deriveDeviceStatus(lastSeen: string, battery?: number): DeviceStatus {
  if (minutesSince(lastSeen) > 2) return 'OFFLINE';
  if (typeof battery === 'number' && battery < 20) return 'DEGRADED';
  return 'ONLINE';
}

export function deriveDevices(patient: IncomingPatient, previousDevices: DeviceItem[] = []): DeviceItem[] {
  return patient.devices.map((device) => {
    const previous = previousDevices.find((item) => item.id === device.id);
    const batteryHistory =
      typeof device.battery === 'number'
        ? [...(previous?.batteryHistory ?? [device.battery, device.battery, device.battery, device.battery]).slice(-5), device.battery]
        : undefined;

    return {
      id: device.id,
      type: device.type,
      status: deriveDeviceStatus(device.lastSeen, device.battery),
      battery: device.battery,
      lastSeen: device.lastSeen,
      batteryHistory,
    };
  });
}
