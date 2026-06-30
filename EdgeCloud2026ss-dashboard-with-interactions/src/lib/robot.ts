import type { DashboardData } from '../types/dashboard';
import { deriveOverallSeverity } from './risk';

export type RobotCommandCode =
  | 'IDLE_MONITORING'
  | 'ASK_PATIENT_STATUS'
  | 'GUIDE_STAY_STILL'
  | 'BREATHING_CHECK'
  | 'CALL_STAFF_AND_REASSURE'
  | 'REQUEST_OPERATOR_VISUAL_CHECK'
  | 'GUIDE_SAFE_BED_RETURN'
  | 'CONFIRM_CONSCIOUS_RESPONSE';

export interface RobotCommand {
  code: RobotCommandCode;
  label: string;
  speech: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  intent: 'observe' | 'check_patient' | 'guide_patient' | 'notify_staff' | 'operator_review';
  expectedResponse: 'none' | 'patient_confirmation';
  nextStepIfNoResponse?: string;
  staffNotification: boolean;
  safetyNote: string;
  actionResult: string;
}

function isTrackingUncertain(data: DashboardData) {
  return !data.tracking.personDetected || data.tracking.confidence < 0.55;
}

function isAwayFromBed(data: DashboardData) {
  return typeof data.tracking.distanceFromBedMeters === 'number' && data.tracking.distanceFromBedMeters > 1.1;
}

function hasVitalsConcern(data: DashboardData) {
  return data.health.heartRate >= 120 || data.health.heartRate <= 45 || (data.health.oxygenSaturation ?? 100) < 93 || data.health.temperature >= 38;
}

export function buildRobotOptions(data: DashboardData): RobotCommand[] {
  if (!data.robot.available) return [];

  const severity = deriveOverallSeverity(data);
  const options: RobotCommand[] = [];

  if (severity === 'CRITICAL') {
    options.push({
      code: 'CALL_STAFF_AND_REASSURE',
      label: 'Call staff + reassure patient',
      speech: 'Assistance is being called. Please remain calm and avoid moving until staff arrives.',
      priority: 'HIGH',
      intent: 'notify_staff',
      expectedResponse: 'patient_confirmation',
      nextStepIfNoResponse: 'Keep the staff notification active and mark the alert as critical.',
      staffNotification: true,
      safetyNote: 'The robot gives safety support only; it does not diagnose or move the patient.',
      actionResult: 'The system would notify staff, keep the robot near the patient, and display a critical response state.',
    });

    options.push({
      code: 'CONFIRM_CONSCIOUS_RESPONSE',
      label: 'Check if patient can respond',
      speech: 'Can you hear me? If you can, please say yes or raise your hand slowly.',
      priority: 'HIGH',
      intent: 'check_patient',
      expectedResponse: 'patient_confirmation',
      nextStepIfNoResponse: 'Escalate as no response and keep staff notification active.',
      staffNotification: true,
      safetyNote: 'The prompt checks responsiveness without making a medical claim.',
      actionResult: 'The dashboard would wait for patient response and escalate if no response is recorded.',
    });

    options.push({
      code: 'GUIDE_STAY_STILL',
      label: 'Tell patient not to move',
      speech: 'Please try not to move. Help is on the way. Stay as comfortable as possible.',
      priority: 'HIGH',
      intent: 'guide_patient',
      expectedResponse: 'none',
      staffNotification: true,
      safetyNote: 'Useful for possible fall cases where movement could worsen injury.',
      actionResult: 'The robot would give a calm safety instruction and keep the emergency state visible.',
    });

    return options;
  }

  if (severity === 'HIGH') {
    options.push({
      code: 'ASK_PATIENT_STATUS',
      label: 'Ask if help is needed',
      speech: 'I detected a possible problem. Do you need help?',
      priority: 'HIGH',
      intent: 'check_patient',
      expectedResponse: 'patient_confirmation',
      nextStepIfNoResponse: 'Notify staff if the patient does not respond.',
      staffNotification: false,
      safetyNote: 'Keeps the interaction simple and avoids medical diagnosis.',
      actionResult: 'The robot would ask the patient for confirmation and the dashboard would wait for response.',
    });

    options.push({
      code: 'CALL_STAFF_AND_REASSURE',
      label: 'Notify staff immediately',
      speech: 'I am notifying staff now. Please remain calm and wait for assistance.',
      priority: 'HIGH',
      intent: 'notify_staff',
      expectedResponse: 'patient_confirmation',
      nextStepIfNoResponse: 'Keep staff notification active.',
      staffNotification: true,
      safetyNote: 'Appropriate when high risk is already visible and operator wants immediate escalation.',
      actionResult: 'The system would prepare a staff notification and keep the alert open.',
    });

    if (hasVitalsConcern(data)) {
      options.push({
        code: 'BREATHING_CHECK',
        label: 'Ask calm breathing/status question',
        speech: 'Please breathe normally if you can. Are you feeling short of breath or dizzy?',
        priority: 'HIGH',
        intent: 'check_patient',
        expectedResponse: 'patient_confirmation',
        nextStepIfNoResponse: 'Escalate to staff notification if no response is received.',
        staffNotification: false,
        safetyNote: 'This gathers a simple symptom response without diagnosing.',
        actionResult: 'The dashboard would record a symptom-check interaction and wait for response.',
      });
    }

    return options;
  }

  if (severity === 'MEDIUM') {
    if (isTrackingUncertain(data)) {
      options.push({
        code: 'REQUEST_OPERATOR_VISUAL_CHECK',
        label: 'Request operator check',
        speech: 'I cannot reliably confirm the patient position. Staff review may be needed.',
        priority: 'MEDIUM',
        intent: 'operator_review',
        expectedResponse: 'none',
        staffNotification: false,
        safetyNote: 'Used when tracking confidence is too low for direct patient prompting.',
        actionResult: 'The dashboard would create an operator-review event instead of escalating medically.',
      });
    }

    if (isAwayFromBed(data)) {
      options.push({
        code: 'GUIDE_SAFE_BED_RETURN',
        label: 'Guide safe bed return',
        speech: 'If you feel stable, please return to the bed slowly or wait for staff assistance.',
        priority: 'MEDIUM',
        intent: 'guide_patient',
        expectedResponse: 'patient_confirmation',
        nextStepIfNoResponse: 'Request operator review if no response is recorded.',
        staffNotification: false,
        safetyNote: 'The robot does not physically assist; it only gives a cautious instruction.',
        actionResult: 'The robot would give a safe movement instruction and the dashboard would wait for confirmation.',
      });
    }

    options.push({
      code: 'ASK_PATIENT_STATUS',
      label: 'Check patient status',
      speech: 'Are you feeling well? Please respond if you need assistance.',
      priority: 'MEDIUM',
      intent: 'check_patient',
      expectedResponse: 'patient_confirmation',
      nextStepIfNoResponse: 'Escalate to staff review if no response is received.',
      staffNotification: false,
      safetyNote: 'Appropriate for non-critical uncertainty or elevated vitals.',
      actionResult: 'The robot would ask a short status question and wait for patient response.',
    });

    return options;
  }

  options.push({
    code: 'IDLE_MONITORING',
    label: 'Idle monitoring',
    speech: 'Monitoring is active. No action is needed right now.',
    priority: 'LOW',
    intent: 'observe',
    expectedResponse: 'none',
    staffNotification: false,
    safetyNote: 'No patient interaction is needed while observations remain stable.',
    actionResult: 'The robot would remain available without interrupting the patient.',
  });

  return options;
}

export function buildRobotCommand(data: DashboardData, preferredCode?: RobotCommandCode): RobotCommand | null {
  const options = buildRobotOptions(data);
  if (options.length === 0) return null;
  return options.find((option) => option.code === preferredCode) ?? options[0];
}

export function buildRobotCommandPayload(data: DashboardData, command: RobotCommand) {
  return {
    roomId: data.roomId,
    patientId: data.patient.id,
    patientAlias: data.patient.displayAlias,
    bedZone: data.patient.bedZone,
    command: command.code,
    priority: command.priority,
    speech: command.speech,
    staffNotification: command.staffNotification,
    expectedResponse: command.expectedResponse,
    generatedAt: new Date().toISOString(),
  };
}
