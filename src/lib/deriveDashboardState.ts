import type { AuditSnapshot, DashboardData, RoomPatientSummary } from '../types/dashboard';
import type { IncomingPatient, IncomingRoomState } from '../types/incoming';
import { generateAlerts } from './alertEngine';
import { deriveDevices } from './deviceEngine';
import { calculateRisk, deriveMotionState } from './riskEngine';

const HISTORY_LENGTH = 12;
const DEFAULT_INTERVAL_SECONDS = 3;
const IMMOBILE_THRESHOLD = 1.5;

function appendNumber(history: number[] | undefined, value: number) {
  const safeHistory = history && history.length > 0 ? history : [value, value, value];
  return [...safeHistory, value].slice(-HISTORY_LENGTH);
}

function appendText(history: string[] | undefined, value: string) {
  const safeHistory = history && history.length > 0 ? history : [value, value, value];
  return [...safeHistory, value].slice(-HISTORY_LENGTH);
}

function secondsBetween(currentTimestamp: string, previousTimestamp?: string) {
  if (!previousTimestamp) return DEFAULT_INTERVAL_SECONDS;

  const current = new Date(currentTimestamp).getTime();
  const previous = new Date(previousTimestamp).getTime();
  if (Number.isNaN(current) || Number.isNaN(previous)) return DEFAULT_INTERVAL_SECONDS;

  const diff = Math.round((current - previous) / 1000);
  return diff > 0 && diff < 60 ? diff : DEFAULT_INTERVAL_SECONDS;
}

function deriveImmobileSeconds(
  patient: IncomingPatient,
  previousRecord: RoomPatientSummary | undefined,
  currentTimestamp: string,
  previousTimestamp?: string,
) {
  const isMobileNow = patient.tracking.motionLevel > IMMOBILE_THRESHOLD || patient.tracking.posture === 'standing';
  if (isMobileNow) return 0;

  const interval = secondsBetween(currentTimestamp, previousTimestamp);
  if (!previousRecord) return Math.max(patient.tracking.timeImmobileSeconds ?? 0, interval);

  return previousRecord.timeImmobileSeconds + interval;
}

function patientWithDerivedImmobile(
  patient: IncomingPatient,
  timeImmobileSeconds: number,
): IncomingPatient {
  return {
    ...patient,
    tracking: {
      ...patient.tracking,
      timeImmobileSeconds,
    },
  };
}

function createAuditSnapshot(state: Omit<DashboardData, 'audit'>): AuditSnapshot {
  return {
    roomId: state.roomId,
    lastUpdated: state.lastUpdated,
    patient: state.patient,
    health: {
      heartRate: state.health.heartRate,
      temperature: state.health.temperature,
      oxygenSaturation: state.health.oxygenSaturation,
      motionState: state.health.motionState,
      motionLevel: state.health.motionLevel,
      fallProbability: state.health.fallProbability,
      posture: state.health.posture,
      riskScore: state.health.riskScore,
    },
    tracking: state.tracking,
    alerts: state.alerts.map((alert) => ({
      id: alert.id,
      severity: alert.severity,
      title: alert.title,
      status: alert.status,
    })),
    devices: state.devices.map((device) => ({
      id: device.id,
      type: device.type,
      status: device.status,
      battery: device.battery,
      lastSeen: device.lastSeen,
    })),
  };
}

export function deriveDashboardState(
  input: IncomingRoomState,
  previous?: DashboardData,
  selectedPatientId?: string,
  options: { appendAudit?: boolean } = {},
): DashboardData {
  const shouldAppendAudit = options.appendAudit ?? true;
  const selectedId = selectedPatientId ?? previous?.patient.id ?? input.patients[0]?.patientId;

  const roomPatients = input.patients.map((rawPatient) => {
    const previousRecord = previous?.roomPatients.find((record) => record.id === rawPatient.patientId);
    const timeImmobileSeconds = deriveImmobileSeconds(rawPatient, previousRecord, input.timestamp, previous?.lastUpdated);
    const patient = patientWithDerivedImmobile(rawPatient, timeImmobileSeconds);
    const risk = calculateRisk(patient);
    const motionState = deriveMotionState(patient.tracking.motionLevel);

    return {
      id: patient.patientId,
      displayAlias: patient.displayAlias,
      bedZone: patient.bedZone,
      zone: patient.tracking.zone,
      riskScore: risk.score,
      severity: risk.severity,
      heartRate: patient.vitals.heartRate,
      temperature: patient.vitals.temperature,
      oxygenSaturation: patient.vitals.oxygenSaturation,
      posture: patient.tracking.posture,
      motionState,
      motionLevel: patient.tracking.motionLevel,
      fallProbability: patient.tracking.fallProbability,
      timeImmobileSeconds,
      distanceFromBedMeters: patient.tracking.distanceFromBedMeters,
      confidence: patient.tracking.confidence,
      personDetected: patient.tracking.personDetected,
      heartRateHistory: appendNumber(previousRecord?.heartRateHistory, patient.vitals.heartRate),
      motionHistory: appendNumber(previousRecord?.motionHistory, patient.tracking.motionLevel),
      fallRiskHistory: appendNumber(previousRecord?.fallRiskHistory, patient.tracking.fallProbability),
      postureHistory: appendText(previousRecord?.postureHistory, patient.tracking.posture),
    };
  });

  const selectedRecord = roomPatients.find((record) => record.id === selectedId) ?? roomPatients[0];
  const rawSelectedPatient = input.patients.find((candidate) => candidate.patientId === selectedRecord.id) ?? input.patients[0];
  const selectedPatient = patientWithDerivedImmobile(rawSelectedPatient, selectedRecord.timeImmobileSeconds);
  const risk = calculateRisk(selectedPatient);
  const alerts = generateAlerts(selectedPatient, risk, input.timestamp, previous?.alerts ?? []);
  const devices = deriveDevices(selectedPatient, previous?.devices ?? []);

  const alertAudit = alerts.length > 0 && previous?.alerts[0]?.id !== alerts[0].id;
  const patientChecked = previous?.privacy.lastAccessEvent ?? 'Dashboard viewed by operator role';

  const baseState: Omit<DashboardData, 'audit'> = {
    roomId: input.roomId,
    privacyMode: 'STRICT',
    lastUpdated: input.timestamp,

    patient: {
      id: selectedPatient.patientId,
      displayAlias: selectedPatient.displayAlias,
      bedZone: selectedPatient.bedZone,
    },

    roomPatients,

    health: {
      heartRate: selectedPatient.vitals.heartRate,
      temperature: selectedPatient.vitals.temperature,
      oxygenSaturation: selectedPatient.vitals.oxygenSaturation,
      motionState: risk.motionState,
      motionLevel: selectedPatient.tracking.motionLevel,
      fallProbability: selectedPatient.tracking.fallProbability,
      posture: selectedPatient.tracking.posture,
      riskScore: risk.score,
      heartRateHistory: selectedRecord.heartRateHistory,
      motionHistory: selectedRecord.motionHistory,
      fallRiskHistory: selectedRecord.fallRiskHistory,
      postureHistory: selectedRecord.postureHistory,
    },

    tracking: {
      personDetected: selectedPatient.tracking.personDetected,
      zone: selectedPatient.tracking.zone,
      confidence: selectedPatient.tracking.confidence,
      timeImmobileSeconds: selectedRecord.timeImmobileSeconds,
      distanceFromBedMeters: selectedPatient.tracking.distanceFromBedMeters,
    },

    // Real device readings ride at room level — pass them straight through.
    environment: input.environment,

    alerts,
    devices,

    privacy: {
      rawVideoExposed: false,
      faceRecognitionEnabled: false,
      dataMinimizationMode: true,
      retentionPolicy: 'routine_metadata_24h_alerts_30d',
      lastAccessEvent: patientChecked,
    },

    robot: {
      available: selectedPatient.robot?.available ?? previous?.robot.available ?? true,
      suggestedActions: [],
      lastCommand: previous?.robot.lastCommand,
      awaitingPatientResponse: previous?.robot.awaitingPatientResponse ?? false,
      lastCommandPayload: previous?.robot.lastCommandPayload,
    },
  };

  const previousAudit = previous?.audit ?? [];

  if (!shouldAppendAudit) {
    return {
      ...baseState,
      audit: previousAudit,
    };
  }

  const auditType = alertAudit ? 'ALERT_DERIVED' : alerts.length > 0 ? 'RISK_REEVALUATED' : 'OBSERVATION_UPDATE';

  return {
    ...baseState,
    audit: [
      {
        id: `OBS-${input.timestamp}-${selectedPatient.patientId}-${auditType}`,
        timestamp: input.timestamp,
        type: auditType,
        message:
          alerts.length > 0
            ? `${risk.severity} warning derived internally for ${selectedPatient.displayAlias}.`
            : `Dashboard refreshed for ${selectedPatient.displayAlias}.`,
        snapshot: createAuditSnapshot(baseState),
      },
      ...previousAudit.slice(0, 14),
    ],
  };
}
