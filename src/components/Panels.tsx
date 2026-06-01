import { useMemo, useState } from 'react';
import type { AuditSnapshot, DashboardData } from '../types/dashboard';
import { buildRobotOptions, type RobotCommandCode } from '../lib/robot';
import { Panel, StatusBadge, TrendSnippet, TrendZoomModal } from './common';

const severityTone = (severity: string) =>
  severity === 'CRITICAL' || severity === 'HIGH' ? 'danger' : severity === 'MEDIUM' ? 'warning' : 'neutral';

type ZoomMetric = 'heartRate' | 'motion' | 'fallRisk' | null;


export function PatientStatusPanel({
  data,
  onSelectPatient,
}: {
  data: DashboardData;
  onSelectPatient: (patientId: string) => void;
}) {
  return (
    <Panel title='Room Patients' subtitle='Three independent patients, each analyzed separately'>
      <div className='patient-selector-grid'>
        {data.roomPatients.map((patient) => (
          <button
            key={patient.id}
            type='button'
            className={patient.id === data.patient.id ? 'patient-selector-card selected' : 'patient-selector-card'}
            onClick={() => onSelectPatient(patient.id)}
          >
            <span>
              <strong>{patient.displayAlias}</strong>
              <small>{patient.bedZone} · {patient.zone}</small>
            </span>
            <StatusBadge label={`${patient.severity} · ${patient.riskScore}`} tone={severityTone(patient.severity)} />
          </button>
        ))}
      </div>

      <div className='key-values compact patient-focus-grid'>
        <div><span>Selected Patient</span><strong>{data.patient.displayAlias}</strong></div>
        <div><span>Bed Zone</span><strong>{data.patient.bedZone}</strong></div>
        <div><span>Current Zone</span><strong>{data.tracking.zone}</strong></div>
        <div><span>Risk Score</span><strong>{data.health.riskScore}</strong></div>
        <div><span>Patients in Room</span><strong>{data.roomPatients.length}</strong></div>
        <div><span>Last Update</span><strong>{new Date(data.lastUpdated).toLocaleTimeString()}</strong></div>
      </div>
    </Panel>
  );
}


export function HealthSummaryPanel({ data }: { data: DashboardData }) {
  const [zoomMetric, setZoomMetric] = useState<ZoomMetric>(null);
  const modalConfig = useMemo(() => {
    if (zoomMetric === 'heartRate') return { title: 'Heart Rate History', values: data.health.heartRateHistory, suffix: ' bpm' };
    if (zoomMetric === 'motion') return { title: 'Motion Activity History', values: data.health.motionHistory, suffix: '' };
    if (zoomMetric === 'fallRisk') return { title: 'Fall Risk History', values: data.health.fallRiskHistory, suffix: '%' };
    return null;
  }, [zoomMetric, data]);

  return (
    <>
      <Panel title='Health & Tracking Summary' subtitle='Edge-derived tracking metadata + vitals interpreted locally'>
        <div className='key-values compact'>
          <div><span>Heart Rate</span><strong>{data.health.heartRate} bpm</strong></div>
          <div><span>Temperature</span><strong>{data.health.temperature} °C</strong></div>
          <div><span>Oxygen Saturation</span><strong>{data.health.oxygenSaturation ? `${data.health.oxygenSaturation}%` : 'Not provided'}</strong></div>
          <div><span>Posture</span><strong>{data.health.posture}</strong></div>
          <div><span>Motion</span><strong>{data.health.motionState} ({data.health.motionLevel})</strong></div>
          <div><span>Fall Probability</span><strong>{data.health.fallProbability}%</strong></div>
          <div><span>Immobile Time</span><strong>{data.tracking.timeImmobileSeconds}s</strong></div>
          <div><span>Tracking Confidence</span><strong>{Math.round(data.tracking.confidence * 100)}%</strong></div>
          <div><span>Person Detected</span><strong>{String(data.tracking.personDetected)}</strong></div>
          <div><span>Distance From Bed</span><strong>{typeof data.tracking.distanceFromBedMeters === 'number' ? `${data.tracking.distanceFromBedMeters} m` : 'Unknown'}</strong></div>
        </div>

        <div className='trend-grid'>
          <TrendSnippet label='Heart Rate' values={data.health.heartRateHistory} suffix=' bpm' onClick={() => setZoomMetric('heartRate')} />
          <TrendSnippet label='Motion' values={data.health.motionHistory} onClick={() => setZoomMetric('motion')} />
          <TrendSnippet label='Fall Risk' values={data.health.fallRiskHistory} suffix='%' onClick={() => setZoomMetric('fallRisk')} />
        </div>

        <div className='timeline'><strong>Posture Timeline</strong><p>{data.health.postureHistory.join(' → ')}</p></div>
      </Panel>

      <TrendZoomModal open={Boolean(modalConfig)} title={modalConfig?.title ?? ''} values={modalConfig?.values ?? [0]} suffix={modalConfig?.suffix ?? ''} onClose={() => setZoomMetric(null)} />
    </>
  );
}

export function AlertsPanel({
  data,
  onAcknowledge,
  onResolve,
  onEscalate,
}: {
  data: DashboardData;
  onAcknowledge: (id: string) => void;
  onResolve: (id: string) => void;
  onEscalate: (id: string) => void;
}) {
  return (
    <Panel title='Active Alerts' subtitle='Generated internally from edge-derived tracking metadata and vitals'>
      {data.alerts.length === 0 ? <div className='empty-state'>No active alerts. Current observations are inside monitoring range.</div> : (
        <div className='stack'>
          {data.alerts.map((alert) => (
            <article key={alert.id} className='alert-card'>
              <div className='alert-card-header'>
                <div><h3>{alert.title}</h3><p>{new Date(alert.createdAt).toLocaleTimeString()}</p></div>
                <StatusBadge label={`${alert.severity} · ${alert.status}`} tone={severityTone(alert.severity)} />
              </div>

              <ul>{alert.reason.map((reason, index) => <li key={`${alert.id}-${index}`}>{reason}</li>)}</ul>

              <div className='panel-actions'>
                {alert.status === 'OPEN' ? <button type='button' onClick={() => onAcknowledge(alert.id)}>Acknowledge</button> : null}
                {alert.status !== 'RESOLVED' ? <button type='button' onClick={() => onResolve(alert.id)}>Resolve</button> : null}
                {alert.status !== 'RESOLVED' ? <button type='button' className='danger-button' onClick={() => onEscalate(alert.id)}>Escalate</button> : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </Panel>
  );
}

export function DevicesPanel({ data }: { data: DashboardData }) {
  const [batteryZoom, setBatteryZoom] = useState<{ title: string; values: number[] } | null>(null);

  return (
    <>
      <Panel title='Device Health' subtitle='Status derived from battery and last-seen timestamps'>
        <div className='stack'>
          {data.devices.map((device) => (
            <div className='device-card' key={device.id}>
              <div className='device-card-header'>
                <div><strong>{device.id}</strong><p>{device.type}</p></div>
                <StatusBadge label={device.status} tone={device.status === 'ONLINE' ? 'success' : device.status === 'DEGRADED' ? 'warning' : 'danger'} />
              </div>
              <div className='key-values compact'>
                <div><span>Last Seen</span><strong>{new Date(device.lastSeen).toLocaleTimeString()}</strong></div>
                {typeof device.battery === 'number' ? <div><span>Battery</span><strong>{device.battery}%</strong></div> : null}
              </div>
              {device.batteryHistory ? <TrendSnippet label={`${device.id} battery`} values={device.batteryHistory} suffix='%' onClick={() => setBatteryZoom({ title: `${device.id} Battery History`, values: device.batteryHistory! })} /> : null}
            </div>
          ))}
        </div>
      </Panel>
      <TrendZoomModal open={Boolean(batteryZoom)} title={batteryZoom?.title ?? ''} values={batteryZoom?.values ?? [0]} suffix='%' onClose={() => setBatteryZoom(null)} />
    </>
  );
}

export function PrivacyPanel({ data }: { data: DashboardData }) {
  const observationAgeSeconds = Math.max(0, Math.round((Date.now() - new Date(data.lastUpdated).getTime()) / 1000));
  const trackingQuality = data.tracking.personDetected && data.tracking.confidence >= 0.75 ? 'Reliable' : data.tracking.confidence >= 0.45 ? 'Limited' : 'Uncertain';
  const identityScope = `${data.patient.displayAlias} · ${data.patient.bedZone}`;

  return (
    <Panel title='Privacy & Compliance' subtitle='Live status separated from fixed policy guarantees'>
      <div className='privacy-split'>
        <section className='privacy-group'>
          <h3>Live privacy status</h3>
          <div className='key-values compact'>
            <div><span>Identity Shown</span><strong>{identityScope}</strong></div>
            <div><span>Tracking Quality</span><strong>{trackingQuality}</strong></div>
            <div><span>Observation Age</span><strong>{observationAgeSeconds}s</strong></div>
            <div><span>Last Operator Action</span><strong>{data.privacy.lastAccessEvent}</strong></div>
          </div>
        </section>

        <section className='privacy-group'>
          <h3>Policy guarantees</h3>
          <div className='key-values compact'>
            <div><span>Privacy Mode</span><strong>{data.privacyMode}</strong></div>
            <div><span>Raw Video</span><strong>{data.privacy.rawVideoExposed ? 'Exposed' : 'Blocked'}</strong></div>
            <div><span>Face Recognition</span><strong>{data.privacy.faceRecognitionEnabled ? 'Enabled' : 'Disabled'}</strong></div>
            <div><span>Retention Rule</span><strong>{data.privacy.retentionPolicy}</strong></div>
          </div>
        </section>
      </div>
    </Panel>
  );
}

export function RobotPanel({
  data,
  onSendCommand,
  onPatientOk,
  onNoResponse,
}: {
  data: DashboardData;
  onSendCommand: (code: RobotCommandCode) => void;
  onPatientOk: () => void;
  onNoResponse: () => void;
}) {
  const options = buildRobotOptions(data);
  const activeCode = data.robot.lastCommand ?? options[0]?.code;
  const activeOption = options.find((option) => option.code === activeCode) ?? options[0];

  return (
    <Panel title='Robot Interaction' subtitle='Operator-selectable robot actions'>
      <div className='key-values compact'>
        <div><span>Available</span><strong>{String(data.robot.available)}</strong></div>
        <div><span>Current Mode</span><strong>{data.robot.lastCommand ?? 'No command selected'}</strong></div>
        <div><span>Awaiting Patient Response</span><strong>{String(data.robot.awaitingPatientResponse ?? false)}</strong></div>
      </div>

      {options.length > 0 && activeOption ? (
        <div className='robot-box'>
          <strong>Choose Robot Action</strong>
          <div className='robot-option-grid'>
            {options.map((option) => (
              <button
                key={option.code}
                type='button'
                className={option.code === data.robot.lastCommand ? 'robot-option selected' : 'robot-option'}
                onClick={() => onSendCommand(option.code)}
              >
                <span>{option.label}</span>
                <small>{option.priority}</small>
              </button>
            ))}
          </div>

          <strong>Selected / Recommended Action</strong><p>{activeOption.label}</p>
          <strong>Speech Output</strong><p>{activeOption.speech}</p>
          <strong>What would happen</strong><p>{activeOption.actionResult}</p>
          {activeOption.nextStepIfNoResponse ? <><strong>No-response rule</strong><p>{activeOption.nextStepIfNoResponse}</p></> : null}
          <strong>Safety Note</strong><p>{activeOption.safetyNote}</p>

          <div className='panel-actions'>
            {data.robot.awaitingPatientResponse ? <button type='button' onClick={onPatientOk}>Patient responded OK</button> : null}
            {data.robot.awaitingPatientResponse ? <button type='button' className='danger-button' onClick={onNoResponse}>No patient response</button> : null}
          </div>

          {data.robot.lastCommandPayload ? (
            <details className='command-payload'>
              <summary>Outgoing command payload preview</summary>
              <pre>{JSON.stringify(data.robot.lastCommandPayload, null, 2)}</pre>
            </details>
          ) : null}
        </div>
      ) : <div className='empty-state'>Robot unavailable.</div>}
    </Panel>
  );
}

function SnapshotInspector({ snapshot }: { snapshot: AuditSnapshot }) {
  const alertSummary = snapshot.alerts.length > 0
    ? snapshot.alerts.map((alert) => `${alert.severity}: ${alert.title}`).join(' | ')
    : 'No active alert at this measured state';

  return (
    <div className='snapshot-inspector'>
      <div className='key-values compact'>
        <div><span>Measured At</span><strong>{new Date(snapshot.lastUpdated).toLocaleTimeString()}</strong></div>
        <div><span>Patient</span><strong>{snapshot.patient.displayAlias} · {snapshot.patient.bedZone}</strong></div>
        <div><span>Risk Score</span><strong>{snapshot.health.riskScore}</strong></div>
        <div><span>Zone</span><strong>{snapshot.tracking.zone}</strong></div>
        <div><span>Heart Rate</span><strong>{snapshot.health.heartRate} bpm</strong></div>
        <div><span>Temperature</span><strong>{snapshot.health.temperature} °C</strong></div>
        <div><span>Oxygen</span><strong>{snapshot.health.oxygenSaturation ? `${snapshot.health.oxygenSaturation}%` : 'Not provided'}</strong></div>
        <div><span>Posture</span><strong>{snapshot.health.posture}</strong></div>
        <div><span>Motion Level</span><strong>{snapshot.health.motionLevel}</strong></div>
        <div><span>Fall Risk</span><strong>{snapshot.health.fallProbability}%</strong></div>
        <div><span>Immobile Time</span><strong>{snapshot.tracking.timeImmobileSeconds}s</strong></div>
        <div><span>Tracking Confidence</span><strong>{Math.round(snapshot.tracking.confidence * 100)}%</strong></div>
      </div>
      <div className='snapshot-summary'>
        <strong>Alert state at this measurement</strong>
        <p>{alertSummary}</p>
      </div>
      <div className='snapshot-summary'>
        <strong>Device state at this measurement</strong>
        <p>{snapshot.devices.map((device) => `${device.id}: ${device.status}${typeof device.battery === 'number' ? ` (${device.battery}%)` : ''}`).join(' | ')}</p>
      </div>
    </div>
  );
}


export function AuditPanel({ data }: { data: DashboardData }) {
  const [selectedSnapshot, setSelectedSnapshot] = useState<{ key: string; snapshot: AuditSnapshot } | null>(null);

  return (
    <Panel title='Audit Log' subtitle='Measured states can be inspected without being reset by new incoming observations'>
      {selectedSnapshot ? (
        <div className='selected-snapshot-card'>
          <div className='selected-snapshot-header'>
            <div>
              <strong>Selected measured state</strong>
              <p>This state stays open until you click Hide state.</p>
            </div>
            <button type='button' onClick={() => setSelectedSnapshot(null)}>Hide state</button>
          </div>
          <SnapshotInspector snapshot={selectedSnapshot.snapshot} />
        </div>
      ) : null}

      <div className='stack'>
        {data.audit.map((entry) => {
          const key = entry.id ?? `${entry.timestamp}-${entry.type}-${entry.message}-${entry.snapshot?.patient.id ?? 'operator'}`;
          const hasSnapshot = Boolean(entry.snapshot);
          const isSelected = selectedSnapshot?.key === key;

          return (
            <article key={key} className={hasSnapshot ? 'audit-card audit-card-clickable' : 'audit-card'}>
              <button
                type='button'
                className='audit-card-main'
                onClick={() => entry.snapshot ? setSelectedSnapshot({ key, snapshot: entry.snapshot }) : undefined}
                disabled={!hasSnapshot}
                aria-pressed={hasSnapshot ? isSelected : undefined}
              >
                <span>
                  <strong>{entry.type}</strong>
                  <p>{entry.message}</p>
                  <small>{new Date(entry.timestamp).toLocaleTimeString()}</small>
                </span>
                <em>{hasSnapshot ? (isSelected ? 'Selected' : 'Inspect state') : 'Operator action'}</em>
              </button>
            </article>
          );
        })}
      </div>
    </Panel>
  );
}
