import type { DashboardData } from '../types/dashboard';
import { StatusBadge } from './common';

export function Header({
  data,
  severity,
  privacyState,
  streaming,
  connectionMode,
  onPause,
  onResume,
  onReset,
  onEmergency,
  onElevatedRisk,
  onDeviceIssue,
  onTrackingLost,
  onVitalsConcern,
  onBedExit,
  onPatientChecked,
}: {
  data: DashboardData;
  severity: string;
  privacyState: string;
  streaming: boolean;
  connectionMode: string;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  onEmergency: () => void;
  onElevatedRisk: () => void;
  onDeviceIssue: () => void;
  onTrackingLost: () => void;
  onVitalsConcern: () => void;
  onBedExit: () => void;
  onPatientChecked: () => void;
}) {
  const privacyOk = privacyState.startsWith('Protected');

  return (
    <header className='app-header'>
      <div>
        <h1>Secure MedTech Dashboard</h1>
        <p>{data.roomId} · {data.patient.displayAlias} · {data.patient.bedZone}</p>
      </div>

      <div className='header-meta'>
        <StatusBadge
          label={`Alert: ${severity}`}
          tone={severity === 'CRITICAL' || severity === 'HIGH' ? 'danger' : severity === 'MEDIUM' ? 'warning' : 'success'}
        />
        <StatusBadge label={`Privacy: ${privacyState}`} tone={privacyOk ? 'success' : 'danger'} />
        <StatusBadge label={streaming ? 'Live simulation on' : 'Input paused'} tone={streaming ? 'neutral' : 'warning'} />
        <StatusBadge label={`Input: ${connectionMode}`} tone={connectionMode === 'server-websocket' ? 'success' : connectionMode === 'paused' ? 'warning' : 'neutral'} />
      </div>

      <div className='header-actions'>
        <button type='button' onClick={streaming ? onPause : onResume}>{streaming ? 'Pause simulation' : 'Resume simulation'}</button>
        <button type='button' onClick={onReset}>Reset data</button>
        <button type='button' onClick={onElevatedRisk}>Simulate elevated risk</button>
        <button type='button' onClick={onVitalsConcern}>Simulate vitals concern</button>
        <button type='button' onClick={onBedExit}>Simulate bed exit</button>
        <button type='button' onClick={onDeviceIssue}>Simulate device issue</button>
        <button type='button' onClick={onTrackingLost}>Simulate tracking loss</button>
        <button type='button' onClick={onPatientChecked}>Patient checked</button>
        <button type='button' className='danger-button' onClick={onEmergency}>Simulate emergency</button>
      </div>
    </header>
  );
}
