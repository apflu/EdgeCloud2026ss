import { useCallback, useEffect, useRef, useState } from 'react';
import { deriveDashboardState } from '../lib/deriveDashboardState';
import {
  deviceIssueObservation,
  elevatedRiskObservation,
  fallObservation,
  normalObservation,
  randomObservation,
  trackingLostObservation,
  vitalsConcernObservation,
  bedExitObservation,
} from '../lib/mockObservations';
import { buildRobotCommand, buildRobotCommandPayload, type RobotCommandCode } from '../lib/robot';
import { DashboardSchema, type AlertItem, type DashboardData, type Severity } from '../types/dashboard';
import { parseIncomingRoomState, type IncomingRoomState } from '../types/incoming';
import {
  BackendAlertSnapshotSchema,
  EnrichedAlertSchema,
  type BackendAlert,
  type EnrichmentMap,
} from '../types/alerts';

// Resolve the configured WS endpoint. A full ws://host:port URL is used as-is;
// a relative value like "/ws" is resolved against the page origin (correct
// scheme + host), so the WebSocket rides the same port that served the app.
function resolveWsUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  if (raw.startsWith('ws://') || raw.startsWith('wss://')) return raw;
  if (typeof window === 'undefined') return undefined;
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  return `${proto}//${window.location.host}${path}`;
}

const WS_URL = resolveWsUrl(import.meta.env.VITE_WS_URL as string | undefined);
type ConnectionMode = 'local-observation-simulation' | 'server-websocket' | 'paused' | 'manual-json';

const seed = normalObservation();
const now = () => new Date().toISOString();

function makeManualAlert(message: string, severity: Severity = 'HIGH'): AlertItem {
  const timestamp = now();
  return {
    id: `MANUAL-${Date.now()}`,
    severity,
    title: severity === 'CRITICAL' ? 'Critical operator escalation' : 'Operator escalation',
    reason: [message],
    createdAt: timestamp,
    status: 'OPEN',
  };
}

function mergeSinglePatientObservation(incoming: IncomingRoomState, current: IncomingRoomState): IncomingRoomState {
  if (incoming.patients.length !== 1 || current.patients.length <= 1) return incoming;

  const updatedPatient = incoming.patients[0];
  const exists = current.patients.some((patient) => patient.patientId === updatedPatient.patientId);
  if (!exists) return incoming;

  return {
    ...current,
    roomId: incoming.roomId || current.roomId,
    timestamp: incoming.timestamp,
    patients: current.patients.map((patient) =>
      patient.patientId === updatedPatient.patientId ? updatedPatient : patient,
    ),
  };
}

export function useDashboardStream(intervalMs = 3000) {
  const [data, setData] = useState<DashboardData>(() => DashboardSchema.parse(deriveDashboardState(seed)));
  const [streaming, setStreaming] = useState(true);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('local-observation-simulation');
  const [jsonInputError, setJsonInputError] = useState<string | null>(null);
  const [lastManualJsonAcceptedAt, setLastManualJsonAcceptedAt] = useState<string | null>(null);
  // Authoritative alerts from the backend engine + their LLM narration. These
  // come over the WebSocket bridge; they stay empty in local/manual modes.
  const [backendAlerts, setBackendAlerts] = useState<BackendAlert[]>([]);
  const [enrichments, setEnrichments] = useState<EnrichmentMap>({});
  const wsRef = useRef<WebSocket | null>(null);
  const latestObservationRef = useRef<IncomingRoomState>(seed);
  const selectedPatientIdRef = useRef(seed.patients[0]?.patientId ?? '');

  const ingestObservation = useCallback((incoming: IncomingRoomState, mode?: ConnectionMode) => {
    latestObservationRef.current = incoming;
    setData((previous) => DashboardSchema.parse(deriveDashboardState(incoming, previous, selectedPatientIdRef.current)));
    if (mode) setConnectionMode(mode);
  }, []);

  function selectPatient(patientId: string) {
    selectedPatientIdRef.current = patientId;
    setData((previous) => DashboardSchema.parse(deriveDashboardState(latestObservationRef.current, previous, patientId, { appendAudit: false })));
  }

  function submitObservationJson(text: string) {
    try {
      const parsed = JSON.parse(text);
      const parsedObservation = parseIncomingRoomState(parsed);
      const observation = mergeSinglePatientObservation(parsedObservation, latestObservationRef.current);
      setStreaming(false);
      setJsonInputError(null);
      const acceptedAt = now();
      setLastManualJsonAcceptedAt(acceptedAt);
      ingestObservation(observation, 'manual-json');
      setData((previous) => ({
        ...previous,
        audit: [
          {
            timestamp: acceptedAt,
            type: 'MANUAL_JSON_ACCEPTED',
            message: 'Operator imported a patient observation JSON. Dashboard state was derived internally.',
          },
          ...previous.audit.slice(0, 14),
        ],
      }));
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown JSON parsing/validation error.';
      setJsonInputError(message);
      setConnectionMode('manual-json');
      return false;
    }
  }

  useEffect(() => {
    wsRef.current?.close();

    if (!streaming) {
      setConnectionMode((previous) => previous === 'manual-json' ? previous : 'paused');
      return;
    }

    if (WS_URL) {
      // The bridge connection can drop (e.g. an SSH-forwarded port hiccup). A
      // single drop must NOT freeze the dashboard forever, so we auto-reconnect
      // with a short backoff until the effect is torn down.
      let disposed = false;
      let reconnectTimer: number | undefined;

      const handleMessage = (event: MessageEvent) => {
        try {
          const raw = JSON.parse(event.data);
          // Bridge wraps every message as { type, data }. A bare observation
          // (no type) is still accepted for backward compatibility.
          const envelope = raw as { type?: string; data?: unknown };
          if (envelope && typeof envelope === 'object' && typeof envelope.type === 'string') {
            if (envelope.type === 'observation') {
              ingestObservation(parseIncomingRoomState(envelope.data), 'server-websocket');
            } else if (envelope.type === 'alerts') {
              const parsed = BackendAlertSnapshotSchema.safeParse(envelope.data);
              if (parsed.success) setBackendAlerts(parsed.data.alerts);
            } else if (envelope.type === 'enriched') {
              const parsed = EnrichedAlertSchema.safeParse(envelope.data);
              if (parsed.success) setEnrichments((previous) => ({ ...previous, [parsed.data.patientId]: parsed.data }));
            }
          } else {
            ingestObservation(parseIncomingRoomState(raw), 'server-websocket');
          }
          setJsonInputError(null);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Invalid incoming patient observation payload received from server.';
          setJsonInputError(message);
          console.error(message, error);
        }
      };

      const connect = () => {
        if (disposed) return;
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;
        setConnectionMode('server-websocket');
        ws.onmessage = handleMessage;
        ws.onerror = () => {
          console.warn('WebSocket connection error. Will retry shortly.');
        };
        ws.onclose = () => {
          if (disposed) return;
          // Reconnect after a short delay; the bridge replays the latest
          // observation/alerts on connect, so state recovers immediately.
          reconnectTimer = window.setTimeout(connect, 2000);
        };
      };

      connect();

      return () => {
        disposed = true;
        if (reconnectTimer) window.clearTimeout(reconnectTimer);
        const ws = wsRef.current;
        if (ws) {
          ws.onclose = null;
          ws.close();
        }
      };
    }

    setConnectionMode('local-observation-simulation');
    const id = window.setInterval(() => ingestObservation(randomObservation(), 'local-observation-simulation'), intervalMs);
    return () => window.clearInterval(id);
  }, [ingestObservation, intervalMs, streaming]);

  function acknowledgeAlert(id: string) {
    setData((previous) => ({
      ...previous,
      alerts: previous.alerts.map((alert) =>
        alert.id === id ? { ...alert, status: 'ACKNOWLEDGED' } : alert,
      ),
      audit: [
        { timestamp: now(), type: 'ALERT_ACKNOWLEDGED', message: `Operator acknowledged ${id}.` },
        ...previous.audit.slice(0, 14),
      ],
    }));
  }

  function resolveAlert(id: string) {
    setData((previous) => ({
      ...previous,
      alerts: previous.alerts.map((alert) =>
        alert.id === id ? { ...alert, status: 'RESOLVED' } : alert,
      ),
      audit: [
        { timestamp: now(), type: 'ALERT_RESOLVED', message: `Operator resolved ${id}.` },
        ...previous.audit.slice(0, 14),
      ],
    }));
  }

  function escalateAlert(id: string) {
    setData((previous) => ({
      ...previous,
      alerts: previous.alerts.map((alert) => {
        if (alert.id !== id) return alert;
        const nextSeverity: Severity = alert.severity === 'MEDIUM' ? 'HIGH' : 'CRITICAL';
        return {
          ...alert,
          severity: nextSeverity,
          status: 'OPEN',
          reason: [...alert.reason, 'Operator manually escalated this alert.'],
        };
      }),
      audit: [
        { timestamp: now(), type: 'ALERT_ESCALATED', message: `Operator escalated ${id}.` },
        ...previous.audit.slice(0, 14),
      ],
    }));
  }

  function markPatientChecked() {
    setData((previous) => ({
      ...previous,
      alerts: previous.alerts.map((alert) =>
        alert.status === 'OPEN' ? { ...alert, status: 'ACKNOWLEDGED' } : alert,
      ),
      privacy: {
        ...previous.privacy,
        lastAccessEvent: 'Patient checked by operator role',
      },
      robot: {
        ...previous.robot,
        awaitingPatientResponse: false,
      },
      audit: [
        { timestamp: now(), type: 'PATIENT_CHECKED', message: 'Operator marked patient as checked.' },
        ...previous.audit.slice(0, 14),
      ],
    }));
  }

  function sendRobotCommand(code?: RobotCommandCode) {
    setData((previous) => {
      const command = buildRobotCommand(previous, code);
      if (!command) {
        return {
          ...previous,
          audit: [
            { timestamp: now(), type: 'ROBOT_UNAVAILABLE', message: 'Robot command was not sent because the robot is unavailable.' },
            ...previous.audit.slice(0, 14),
          ],
        };
      }

      const payload = buildRobotCommandPayload(previous, command);

      return {
        ...previous,
        robot: {
          ...previous.robot,
          lastCommand: command.code,
          awaitingPatientResponse: command.expectedResponse === 'patient_confirmation',
          lastCommandPayload: payload,
        },
        audit: [
          {
            timestamp: now(),
            type: 'ROBOT_COMMAND_SENT',
            message: `Robot action selected: ${command.code}. ${command.actionResult}`,
          },
          ...previous.audit.slice(0, 14),
        ],
      };
    });
  }

  function recordPatientResponseOk() {
    setData((previous) => ({
      ...previous,
      robot: {
        ...previous.robot,
        awaitingPatientResponse: false,
      },
      alerts: previous.alerts.map((alert) =>
        alert.status === 'OPEN' && alert.severity !== 'CRITICAL'
          ? { ...alert, status: 'ACKNOWLEDGED' }
          : alert,
      ),
      audit: [
        { timestamp: now(), type: 'PATIENT_RESPONSE_OK', message: 'Patient response was recorded as OK after robot check.' },
        ...previous.audit.slice(0, 14),
      ],
    }));
  }

  function recordNoPatientResponse() {
    setData((previous) => {
      const hasOpenAlert = previous.alerts.some((alert) => alert.status === 'OPEN');
      const escalatedAlerts = hasOpenAlert
        ? previous.alerts.map((alert) =>
            alert.status === 'OPEN'
              ? {
                  ...alert,
                  severity: 'CRITICAL' as Severity,
                  reason: [...alert.reason, 'No patient response was received after robot check.'],
                }
              : alert,
          )
        : [makeManualAlert('No patient response was received after robot check.', 'CRITICAL')];

      return {
        ...previous,
        alerts: escalatedAlerts,
        robot: {
          ...previous.robot,
          awaitingPatientResponse: false,
        },
        audit: [
          { timestamp: now(), type: 'NO_PATIENT_RESPONSE', message: 'No patient response after robot interaction. Alert escalated.' },
          ...previous.audit.slice(0, 14),
        ],
      };
    });
  }

  return {
    data,
    streaming,
    connectionMode,
    jsonInputError,
    lastManualJsonAcceptedAt,
    backendAlerts,
    enrichments,
    latestObservation: latestObservationRef.current,
    selectedPatientId: data.patient.id,
    pause: () => setStreaming(false),
    resume: () => {
      setJsonInputError(null);
      setStreaming(true);
    },
    reset: () => {
      const fresh = normalObservation();
      latestObservationRef.current = fresh;
      selectedPatientIdRef.current = fresh.patients[0]?.patientId ?? '';
      setJsonInputError(null);
      setLastManualJsonAcceptedAt(null);
      setConnectionMode('local-observation-simulation');
      setBackendAlerts([]);
      setEnrichments({});
      setData(DashboardSchema.parse(deriveDashboardState(fresh, undefined, selectedPatientIdRef.current)));
    },
    selectPatient,
    triggerEmergency: () => ingestObservation(fallObservation()),
    triggerElevated: () => ingestObservation(elevatedRiskObservation()),
    triggerDeviceFailure: () => ingestObservation(deviceIssueObservation()),
    triggerTrackingLost: () => ingestObservation(trackingLostObservation()),
    triggerVitalsConcern: () => ingestObservation(vitalsConcernObservation()),
    triggerBedExit: () => ingestObservation(bedExitObservation()),
    acknowledgeAlert,
    resolveAlert,
    escalateAlert,
    markPatientChecked,
    sendRobotCommand,
    recordPatientResponseOk,
    recordNoPatientResponse,
    submitObservationJson,
    ingestObservation,
  };
}
