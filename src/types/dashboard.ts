import { z } from 'zod';

export const SeveritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export type Severity = z.infer<typeof SeveritySchema>;

export const DeviceStatusSchema = z.enum(['ONLINE', 'OFFLINE', 'DEGRADED']);
export type DeviceStatus = z.infer<typeof DeviceStatusSchema>;

const PatientIdentitySchema = z.object({
  id: z.string(),
  displayAlias: z.string(),
  bedZone: z.string(),
});

const AlertSchema = z.object({
  id: z.string(),
  severity: SeveritySchema,
  title: z.string(),
  reason: z.array(z.string()),
  createdAt: z.string(),
  status: z.enum(['OPEN', 'ACKNOWLEDGED', 'RESOLVED']),
});

const DeviceSchema = z.object({
  id: z.string(),
  type: z.string(),
  status: DeviceStatusSchema,
  battery: z.number().optional(),
  lastSeen: z.string(),
  batteryHistory: z.array(z.number()).optional(),
});

const TrackingSchema = z.object({
  personDetected: z.boolean(),
  zone: z.string(),
  confidence: z.number(),
  timeImmobileSeconds: z.number(),
  distanceFromBedMeters: z.number().optional(),
});

export const DashboardSchema = z.object({
  roomId: z.string(),
  privacyMode: z.enum(['STRICT', 'BALANCED']),
  lastUpdated: z.string(),

  patient: PatientIdentitySchema,

  roomPatients: z.array(
    PatientIdentitySchema.extend({
      zone: z.string(),
      riskScore: z.number(),
      severity: SeveritySchema,
      heartRate: z.number(),
      temperature: z.number(),
      oxygenSaturation: z.number().optional(),
      posture: z.string(),
      motionState: z.string(),
      motionLevel: z.number(),
      fallProbability: z.number(),
      timeImmobileSeconds: z.number(),
      distanceFromBedMeters: z.number().optional(),
      confidence: z.number(),
      personDetected: z.boolean(),
      heartRateHistory: z.array(z.number()),
      motionHistory: z.array(z.number()),
      fallRiskHistory: z.array(z.number()),
      postureHistory: z.array(z.string()),
    }),
  ),

  health: z.object({
    heartRate: z.number(),
    temperature: z.number(),
    oxygenSaturation: z.number().optional(),
    motionState: z.string(),
    motionLevel: z.number(),
    fallProbability: z.number(),
    posture: z.string(),
    riskScore: z.number(),
    heartRateHistory: z.array(z.number()),
    motionHistory: z.array(z.number()),
    fallRiskHistory: z.array(z.number()),
    postureHistory: z.array(z.string()),
  }),

  tracking: TrackingSchema,

  alerts: z.array(AlertSchema),

  devices: z.array(DeviceSchema),

  privacy: z.object({
    rawVideoExposed: z.boolean(),
    faceRecognitionEnabled: z.boolean(),
    dataMinimizationMode: z.boolean(),
    retentionPolicy: z.string(),
    lastAccessEvent: z.string(),
  }),

  robot: z.object({
    available: z.boolean(),
    suggestedActions: z.array(z.string()),
    lastCommand: z.string().optional(),
    awaitingPatientResponse: z.boolean().optional(),
    lastCommandPayload: z.record(z.unknown()).optional(),
  }),

  audit: z.array(
    z.object({
      id: z.string().optional(),
      timestamp: z.string(),
      type: z.string(),
      message: z.string(),
      snapshot: z
        .object({
          roomId: z.string(),
          lastUpdated: z.string(),
          patient: PatientIdentitySchema,
          health: z.object({
            heartRate: z.number(),
            temperature: z.number(),
            oxygenSaturation: z.number().optional(),
            motionState: z.string(),
            motionLevel: z.number(),
            fallProbability: z.number(),
            posture: z.string(),
            riskScore: z.number(),
          }),
          tracking: TrackingSchema,
          alerts: z.array(AlertSchema.pick({ id: true, severity: true, title: true, status: true })),
          devices: z.array(DeviceSchema.pick({ id: true, type: true, status: true, battery: true, lastSeen: true })),
        })
        .optional(),
    }),
  ),
});

export type DashboardData = z.infer<typeof DashboardSchema>;
export type AlertItem = DashboardData['alerts'][number];
export type DeviceItem = DashboardData['devices'][number];
export type AuditItem = DashboardData['audit'][number];
export type AuditSnapshot = NonNullable<AuditItem['snapshot']>;
export type RoomPatientSummary = DashboardData['roomPatients'][number];
