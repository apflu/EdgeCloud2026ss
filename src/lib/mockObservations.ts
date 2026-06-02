import type { IncomingPatient, IncomingRoomState, PostureSchema } from '../types/incoming';
import type { z } from 'zod';

const rand = (min: number, max: number) => Math.random() * (max - min) + min;
const now = () => new Date().toISOString();
const round = (value: number, digits = 0) => Number(value.toFixed(digits));
type Posture = z.infer<typeof PostureSchema>;
export type Scenario = 'normal' | 'resting' | 'active' | 'elevated' | 'vitalsConcern' | 'bedExit' | 'deviceIssue' | 'trackingLost' | 'fall';

type PatientProfile = {
  id: string;
  alias: string;
  bed: string;
  wearableId: string;
  baselineHr: number;
};

const profiles: PatientProfile[] = [
  { id: 'PATIENT-A', alias: 'Patient A', bed: 'Bed A', wearableId: 'esp32-a', baselineHr: 76 },
  { id: 'PATIENT-B', alias: 'Patient B', bed: 'Bed B', wearableId: 'esp32-b', baselineHr: 84 },
  { id: 'PATIENT-C', alias: 'Patient C', bed: 'Bed C', wearableId: 'esp32-c', baselineHr: 72 },
];

function trackingForScenario(profile: PatientProfile, scenario: Scenario) {
  const base = {
    personDetected: true,
    zone: profile.bed,
    posture: 'sitting' as Posture,
    motionLevel: round(rand(4, 7), 1),
    fallProbability: Math.round(rand(4, 18)),
    timeImmobileSeconds: 0,
    distanceFromBedMeters: round(rand(0, 0.3), 1),
    confidence: round(rand(0.86, 0.98), 2),
  };

  switch (scenario) {
    case 'resting':
      return {
        ...base,
        posture: 'lying' as Posture,
        motionLevel: round(rand(0.4, 1.3), 1),
        fallProbability: Math.round(rand(6, 20)),
        distanceFromBedMeters: 0,
      };
    case 'active':
      return {
        ...base,
        zone: 'Room Area',
        posture: 'standing' as Posture,
        motionLevel: round(rand(6, 9), 1),
        fallProbability: Math.round(rand(5, 22)),
        distanceFromBedMeters: round(rand(0.8, 1.5), 1),
        confidence: round(rand(0.82, 0.95), 2),
      };
    case 'elevated':
      return {
        ...base,
        posture: 'lying' as Posture,
        motionLevel: 1.1,
        fallProbability: 58,
        timeImmobileSeconds: 24,
        distanceFromBedMeters: 0.2,
        confidence: 0.88,
      };
    case 'vitalsConcern':
      return {
        ...base,
        posture: 'sitting' as Posture,
        motionLevel: 3.2,
        fallProbability: 24,
        distanceFromBedMeters: 0.1,
        confidence: 0.91,
      };
    case 'bedExit':
      return {
        ...base,
        zone: 'Room Area',
        posture: 'standing' as Posture,
        motionLevel: 2.3,
        fallProbability: 41,
        distanceFromBedMeters: 1.7,
        confidence: 0.86,
      };
    case 'deviceIssue':
      return {
        ...base,
        posture: 'sitting' as Posture,
        motionLevel: 3.5,
        fallProbability: 18,
        distanceFromBedMeters: 0.1,
        confidence: 0.92,
      };
    case 'trackingLost':
      return {
        ...base,
        personDetected: false,
        zone: 'Unknown',
        posture: 'unknown' as Posture,
        motionLevel: 0,
        fallProbability: 35,
        distanceFromBedMeters: undefined,
        confidence: 0.21,
      };
    case 'fall':
      return {
        ...base,
        zone: 'Floor Area',
        posture: 'lying' as Posture,
        motionLevel: 0.1,
        fallProbability: 92,
        timeImmobileSeconds: 42,
        distanceFromBedMeters: 1.6,
        confidence: 0.93,
      };
    case 'normal':
    default:
      return base;
  }
}

function vitalsForScenario(profile: PatientProfile, scenario: Scenario) {
  const base = {
    heartRate: Math.round(rand(profile.baselineHr - 8, profile.baselineHr + 12)),
    temperature: round(rand(36.3, 37.0), 1),
    oxygenSaturation: Math.round(rand(96, 99)),
  };

  switch (scenario) {
    case 'resting':
      return {
        heartRate: Math.round(rand(profile.baselineHr - 12, profile.baselineHr + 2)),
        temperature: round(rand(36.2, 36.9), 1),
        oxygenSaturation: Math.round(rand(96, 99)),
      };
    case 'active':
      return {
        heartRate: Math.round(rand(profile.baselineHr + 8, profile.baselineHr + 24)),
        temperature: round(rand(36.4, 37.1), 1),
        oxygenSaturation: Math.round(rand(95, 99)),
      };
    case 'elevated':
      return { heartRate: 116, temperature: 37.8, oxygenSaturation: 94 };
    case 'vitalsConcern':
      return { heartRate: 132, temperature: 38.4, oxygenSaturation: 91 };
    case 'bedExit':
      return { heartRate: 108, temperature: 36.9, oxygenSaturation: 95 };
    case 'fall':
      return { heartRate: 128, temperature: 37.7, oxygenSaturation: 93 };
    default:
      return base;
  }
}

function patient(profile: PatientProfile, scenario: Scenario, timestamp: string): IncomingPatient {
  const stale = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const tracking = trackingForScenario(profile, scenario);
  const vitals = vitalsForScenario(profile, scenario);
  const deviceIssue = scenario === 'deviceIssue';

  return {
    patientId: profile.id,
    displayAlias: profile.alias,
    bedZone: profile.bed,
    tracking,
    vitals,
    devices: [
      {
        id: profile.wearableId,
        type: 'wearable',
        battery: deviceIssue ? 12 : Math.round(rand(62, 96)),
        lastSeen: deviceIssue ? stale : timestamp,
      },
      {
        id: 'edge-room-101',
        type: 'edge_server',
        lastSeen: timestamp,
      },
    ],
    robot: { available: true },
  };
}

function roomFromScenarios(scenarios: Scenario[]): IncomingRoomState {
  const timestamp = now();
  return {
    roomId: 'Room-101',
    timestamp,
    patients: profiles.map((profile, index) => patient(profile, scenarios[index] ?? 'normal', timestamp)),
  };
}

function weightedScenario(): Scenario {
  const roll = Math.random();
  if (roll < 0.32) return 'normal';
  if (roll < 0.50) return 'resting';
  if (roll < 0.66) return 'active';
  if (roll < 0.78) return 'elevated';
  if (roll < 0.86) return 'bedExit';
  if (roll < 0.92) return 'vitalsConcern';
  if (roll < 0.96) return 'deviceIssue';
  if (roll < 0.985) return 'trackingLost';
  return 'fall';
}

export function normalObservation(): IncomingRoomState {
  return roomFromScenarios(['normal', 'resting', 'normal']);
}

export function restingObservation(): IncomingRoomState {
  return roomFromScenarios(['resting', 'resting', 'normal']);
}

export function activeInRoomObservation(): IncomingRoomState {
  return roomFromScenarios(['active', 'normal', 'resting']);
}

export function elevatedRiskObservation(): IncomingRoomState {
  return roomFromScenarios(['elevated', 'normal', 'resting']);
}

export function vitalsConcernObservation(): IncomingRoomState {
  return roomFromScenarios(['vitalsConcern', 'resting', 'normal']);
}

export function bedExitObservation(): IncomingRoomState {
  return roomFromScenarios(['bedExit', 'normal', 'active']);
}

export function fallObservation(): IncomingRoomState {
  return roomFromScenarios(['fall', 'normal', 'resting']);
}

export function deviceIssueObservation(): IncomingRoomState {
  return roomFromScenarios(['deviceIssue', 'normal', 'resting']);
}

export function trackingLostObservation(): IncomingRoomState {
  return roomFromScenarios(['trackingLost', 'resting', 'normal']);
}


export function observationForSelectedPatient(patientId: string, scenario: Scenario): IncomingRoomState {
  const scenarios = profiles.map((profile) => {
    if (profile.id === patientId) return scenario;
    if (scenario === 'fall' || scenario === 'trackingLost') return 'normal';
    if (scenario === 'deviceIssue') return 'resting';
    return weightedScenario();
  });

  return roomFromScenarios(scenarios);
}

export const observationSamples = [
  normalObservation,
  restingObservation,
  activeInRoomObservation,
  elevatedRiskObservation,
  vitalsConcernObservation,
  bedExitObservation,
  deviceIssueObservation,
  trackingLostObservation,
  fallObservation,
];

export function randomObservation(): IncomingRoomState {
  return roomFromScenarios([weightedScenario(), weightedScenario(), weightedScenario()]);
}
