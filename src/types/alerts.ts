import { z } from 'zod';
import { SeveritySchema } from './dashboard';

/**
 * Authoritative alerts produced by the backend rule/state engine
 * (EdgeCloud_Main/engine) and the LLM narration produced from them
 * (EdgeCloud_Main/app). These arrive over the WebSocket bridge, wrapped in a
 * { type, data } envelope, alongside the raw patient observations.
 *
 * The dashboard still derives its own per-patient risk for instant UI feedback,
 * but these are the source of truth: the engine evaluates EVERY patient (not
 * just the selected one) and keeps working when no browser is open.
 */

export const BackendAlertSchema = z.object({
  id: z.string(),
  patientId: z.string(),
  displayAlias: z.string(),
  bedZone: z.string(),
  severity: SeveritySchema,
  score: z.number(),
  title: z.string(),
  reasons: z.array(z.string()),
  triggers: z.array(z.string()),
  createdAt: z.string(),
  status: z.string(),
});

export const BackendAlertSnapshotSchema = z.object({
  roomId: z.string(),
  timestamp: z.string(),
  alerts: z.array(BackendAlertSchema),
});

export const EnrichedAlertSchema = z.object({
  roomId: z.string().optional(),
  timestamp: z.string().optional(),
  alertId: z.string(),
  patientId: z.string(),
  severity: SeveritySchema,
  summary: z.string(),
  recommendedAction: z.string(),
  robotSpeech: z.string(),
  model: z.string().optional(),
});

export type BackendAlert = z.infer<typeof BackendAlertSchema>;
export type BackendAlertSnapshot = z.infer<typeof BackendAlertSnapshotSchema>;
export type EnrichedAlert = z.infer<typeof EnrichedAlertSchema>;

/** Enrichment keyed by patientId — at most one current narration per patient. */
export type EnrichmentMap = Record<string, EnrichedAlert>;
