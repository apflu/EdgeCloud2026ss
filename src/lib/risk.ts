import type { DashboardData, Severity } from '../types/dashboard';

export function deriveOverallSeverity(data: DashboardData): Severity {
  if (data.alerts.some((alert) => alert.status === 'OPEN' && alert.severity === 'CRITICAL')) return 'CRITICAL';
  if (data.alerts.some((alert) => alert.status === 'OPEN' && alert.severity === 'HIGH')) return 'HIGH';
  if (data.alerts.some((alert) => alert.status === 'OPEN' && alert.severity === 'MEDIUM')) return 'MEDIUM';

  if (data.health.riskScore >= 90) return 'CRITICAL';
  if (data.health.riskScore >= 75) return 'HIGH';
  if (data.health.riskScore >= 45) return 'MEDIUM';
  return 'LOW';
}
