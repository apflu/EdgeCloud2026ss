import type { Severity } from '../types/dashboard';
import type { IncomingPatient } from '../types/incoming';

export interface RiskResult {
  score: number;
  severity: Severity;
  reasons: string[];
  motionState: 'no_motion' | 'low_motion' | 'active' | 'unknown';
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export function deriveMotionState(motionLevel: number): RiskResult['motionState'] {
  if (Number.isNaN(motionLevel)) return 'unknown';
  if (motionLevel <= 0.5) return 'no_motion';
  if (motionLevel <= 3) return 'low_motion';
  return 'active';
}

function severityFromScore(score: number): Severity {
  if (score >= 90) return 'CRITICAL';
  if (score >= 75) return 'HIGH';
  if (score >= 45) return 'MEDIUM';
  return 'LOW';
}

export function calculateRisk(patient: IncomingPatient): RiskResult {
  const { tracking, vitals } = patient;
  const reasons: string[] = [];
  let score = 0;

  score += tracking.fallProbability * 0.4;

  if (!tracking.personDetected) {
    score += 12;
    reasons.push('Patient tracking is temporarily lost.');
  }

  if (tracking.confidence < 0.55) {
    score += 8;
    reasons.push('Tracking confidence is low, requiring operator attention.');
  }

  if (tracking.posture === 'falling') {
    score += 35;
    reasons.push('Camera tracking reports a falling posture.');
  } else if (tracking.posture === 'lying') {
    score += 15;
    reasons.push('Patient posture is lying.');
  }

  const motionState = deriveMotionState(tracking.motionLevel);
  if (motionState === 'no_motion') {
    score += 18;
    reasons.push('Motion level is near zero.');
  } else if (motionState === 'low_motion') {
    score += 8;
    reasons.push('Motion level is low.');
  }

  const awayFromBed = typeof tracking.distanceFromBedMeters === 'number' && tracking.distanceFromBedMeters >= 1;
  const suspiciousImmobility = awayFromBed || tracking.fallProbability >= 50 || tracking.zone.toLowerCase().includes('floor');
  if (tracking.timeImmobileSeconds >= 45 && suspiciousImmobility) {
    score += 15;
    reasons.push(`Patient has been immobile for ${Math.round(tracking.timeImmobileSeconds)} seconds in a risky context.`);
  } else if (tracking.timeImmobileSeconds >= 20 && suspiciousImmobility) {
    score += 8;
    reasons.push(`Patient has been immobile for ${Math.round(tracking.timeImmobileSeconds)} seconds in a risky context.`);
  }

  if (awayFromBed) {
    score += 12;
    reasons.push('Patient appears to be away from the bed zone.');
  }

  if (tracking.fallProbability >= 85) {
    reasons.push(`Fall probability is high (${Math.round(tracking.fallProbability)}%).`);
  } else if (tracking.fallProbability >= 60) {
    reasons.push(`Fall probability is elevated (${Math.round(tracking.fallProbability)}%).`);
  }

  if (vitals.heartRate >= 130) {
    score += 18;
    reasons.push(`Heart rate is very high (${Math.round(vitals.heartRate)} bpm).`);
  } else if (vitals.heartRate >= 115) {
    score += 10;
    reasons.push(`Heart rate is elevated (${Math.round(vitals.heartRate)} bpm).`);
  } else if (vitals.heartRate <= 45) {
    score += 15;
    reasons.push(`Heart rate is very low (${Math.round(vitals.heartRate)} bpm).`);
  }

  if (vitals.temperature >= 38.5) {
    score += 14;
    reasons.push(`Temperature is high (${vitals.temperature.toFixed(1)} °C).`);
  } else if (vitals.temperature >= 37.8) {
    score += 7;
    reasons.push(`Temperature is elevated (${vitals.temperature.toFixed(1)} °C).`);
  } else if (vitals.temperature <= 35.5) {
    score += 10;
    reasons.push(`Temperature is below expected range (${vitals.temperature.toFixed(1)} °C).`);
  }

  if (typeof vitals.oxygenSaturation === 'number') {
    if (vitals.oxygenSaturation < 92) {
      score += 18;
      reasons.push(`Oxygen saturation is low (${Math.round(vitals.oxygenSaturation)}%).`);
    } else if (vitals.oxygenSaturation < 95) {
      score += 8;
      reasons.push(`Oxygen saturation needs attention (${Math.round(vitals.oxygenSaturation)}%).`);
    }
  }

  // Strong real-case combo: possible fall away from bed + no movement after impact.
  if (
    tracking.fallProbability >= 80 &&
    (tracking.posture === 'lying' || tracking.posture === 'falling') &&
    motionState === 'no_motion' &&
    tracking.timeImmobileSeconds >= 20
  ) {
    score += 18;
    reasons.push('Combined evidence indicates a possible fall with post-event immobility.');
  }

  const finalScore = Math.round(clamp(score));
  const severity = severityFromScore(finalScore);

  if (reasons.length === 0) {
    reasons.push('Tracking and vital measurements are within normal monitoring range.');
  }

  return { score: finalScore, severity, reasons, motionState };
}
