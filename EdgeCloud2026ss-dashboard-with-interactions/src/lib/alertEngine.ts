import type { AlertItem } from '../types/dashboard';
import type { IncomingPatient } from '../types/incoming';
import type { RiskResult } from './riskEngine';

export function generateAlerts(patient: IncomingPatient, risk: RiskResult, timestamp: string, previousAlerts: AlertItem[] = []): AlertItem[] {
  if (risk.severity === 'LOW') return [];

  const id = `ALERT-${patient.patientId}-${risk.severity}`;
  const previous = previousAlerts.find((alert) => alert.id === id);

  return [
    {
      id,
      severity: risk.severity,
      title:
        risk.severity === 'CRITICAL'
          ? 'Critical patient risk derived from observation'
          : risk.severity === 'HIGH'
            ? 'High patient risk derived from observation'
            : 'Elevated patient risk derived from observation',
      reason: risk.reasons,
      createdAt: previous?.createdAt ?? timestamp,
      status: previous?.status ?? 'OPEN',
    },
  ];
}
