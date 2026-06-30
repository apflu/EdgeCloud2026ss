import { z } from 'zod';

export const PostureSchema = z.enum(['standing', 'sitting', 'lying', 'falling', 'unknown']);

export const IncomingPatientSchema = z.object({
  patientId: z.string(),
  displayAlias: z.string(),
  bedZone: z.string(),

  tracking: z.object({
    personDetected: z.boolean().default(true),
    zone: z.string().default('Unknown'),
    posture: PostureSchema.default('unknown'),
    motionLevel: z.number().default(0),
    fallProbability: z.number().min(0).max(100).default(0),
    timeImmobileSeconds: z.number().min(0).default(0),
    distanceFromBedMeters: z.number().min(0).optional(),
    confidence: z.number().min(0).max(1).default(0),
  }),

  vitals: z.object({
    heartRate: z.number(),
    temperature: z.number(),
    oxygenSaturation: z.number().min(0).max(100).optional(),
    respiratoryRate: z.number().optional(),
  }),

  devices: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      battery: z.number().min(0).max(100).optional(),
      lastSeen: z.string(),
    }),
  ),

  robot: z
    .object({
      available: z.boolean(),
    })
    .optional(),
});

// Real ESP32 sensor-hub readings the rule engine attaches at room level. The
// node physically measures these (room temperature, gas, doorway laser); they
// are kept separate from the per-patient vitals, which for this node are
// simulated. All fields optional/nullable so older streams still validate.
export const EnvironmentSchema = z.object({
  roomTemperatureC: z.number().nullable().optional(),
  gasLevel: z.number().nullable().optional(),
  doorPresent: z.boolean().optional(),
  distanceFromDoorMeters: z.number().nullable().optional(),
  roomOccupancy: z.number().optional(),
});
export type Environment = z.infer<typeof EnvironmentSchema>;

export const IncomingRoomStateSchema = z.object({
  roomId: z.string(),
  timestamp: z.string(),
  patients: z.array(IncomingPatientSchema).min(1),
  environment: EnvironmentSchema.optional(),
});

export type IncomingPatient = z.infer<typeof IncomingPatientSchema>;
export type IncomingRoomState = z.infer<typeof IncomingRoomStateSchema>;

/**
 * Accepts the preferred real-case structure:
 * { roomId, timestamp, patients: [...] }
 *
 * Also accepts an older/simpler single-patient shape used during demos:
 * { roomId, timestamp, patient, measurements, devices, robot }
 */
export function parseIncomingRoomState(raw: unknown): IncomingRoomState {
  const direct = IncomingRoomStateSchema.safeParse(raw);
  if (direct.success) return direct.data;

  const singlePatientObservation = z
    .object({
      roomId: z.string(),
      timestamp: z.string(),
      patient: IncomingPatientSchema,
    })
    .safeParse(raw);

  if (singlePatientObservation.success) {
    return {
      roomId: singlePatientObservation.data.roomId,
      timestamp: singlePatientObservation.data.timestamp,
      patients: [singlePatientObservation.data.patient],
    };
  }

  const legacy = z
    .object({
      roomId: z.string(),
      timestamp: z.string(),
      patient: z.object({
        id: z.string(),
        displayAlias: z.string(),
        bedZone: z.string(),
      }),
      measurements: z.object({
        heartRate: z.number(),
        temperature: z.number(),
        oxygenSaturation: z.number().optional(),
        motionLevel: z.number(),
        posture: PostureSchema.default('unknown'),
        fallProbability: z.number().min(0).max(100),
        timeImmobileSeconds: z.number().min(0).default(0),
        distanceFromBedMeters: z.number().min(0).optional(),
        confidence: z.number().min(0).max(1).default(0.9),
        zone: z.string().default('Unknown'),
        personDetected: z.boolean().default(true),
      }),
      devices: z.array(
        z.object({
          id: z.string(),
          type: z.string(),
          battery: z.number().min(0).max(100).optional(),
          lastSeen: z.string(),
        }),
      ),
      robot: z.object({ available: z.boolean() }).optional(),
    })
    .parse(raw);

  return {
    roomId: legacy.roomId,
    timestamp: legacy.timestamp,
    patients: [
      {
        patientId: legacy.patient.id,
        displayAlias: legacy.patient.displayAlias,
        bedZone: legacy.patient.bedZone,
        tracking: {
          personDetected: legacy.measurements.personDetected,
          zone: legacy.measurements.zone,
          posture: legacy.measurements.posture,
          motionLevel: legacy.measurements.motionLevel,
          fallProbability: legacy.measurements.fallProbability,
          timeImmobileSeconds: legacy.measurements.timeImmobileSeconds,
          distanceFromBedMeters: legacy.measurements.distanceFromBedMeters,
          confidence: legacy.measurements.confidence,
        },
        vitals: {
          heartRate: legacy.measurements.heartRate,
          temperature: legacy.measurements.temperature,
          oxygenSaturation: legacy.measurements.oxygenSaturation,
        },
        devices: legacy.devices,
        robot: legacy.robot,
      },
    ],
  };
}
