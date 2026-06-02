import type { DashboardData } from '../types/dashboard';

export function isPrivacyHealthy(data: DashboardData) {
  return !data.privacy.rawVideoExposed && !data.privacy.faceRecognitionEnabled && data.privacy.dataMinimizationMode;
}

export function describePrivacyState(data: DashboardData) {
  return isPrivacyHealthy(data) ? 'Protected' : 'Privacy issue detected';
}

export function canShowRawVideo(data: DashboardData, userRole: string) {
  if (data.privacy.rawVideoExposed) return false;
  return userRole === 'emergency_admin_override';
}
