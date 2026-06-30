import { Header } from './components/Header';
import { ObservationInputPanel } from './components/ObservationInputPanel';
import {
  AlertsPanel,
  AuditPanel,
  DevicesPanel,
  EnvironmentPanel,
  HealthSummaryPanel,
  PatientStatusPanel,
  PrivacyPanel,
  RobotPanel,
} from './components/Panels';
import { useDashboardStream } from './hooks/useDashboardStream';
import { describePrivacyState } from './lib/privacy';
import { deriveOverallSeverity } from './lib/risk';

export default function App() {
  const {
    data,
    streaming,
    connectionMode,
    jsonInputError,
    lastManualJsonAcceptedAt,
    backendAlerts,
    enrichments,
    latestObservation,
    selectedPatientId,
    pause,
    resume,
    reset,
    triggerEmergency,
    triggerElevated,
    triggerDeviceFailure,
    triggerTrackingLost,
    triggerVitalsConcern,
    triggerBedExit,
    acknowledgeAlert,
    resolveAlert,
    escalateAlert,
    markPatientChecked,
    sendRobotCommand,
    recordPatientResponseOk,
    recordNoPatientResponse,
    submitObservationJson,
    selectPatient,
  } = useDashboardStream();

  const severity = deriveOverallSeverity(data);
  const privacyState = describePrivacyState(data);

  return (
    <main className='app-shell'>
      <Header
        data={data}
        severity={severity}
        privacyState={privacyState}
        streaming={streaming}
        connectionMode={connectionMode}
        onPause={pause}
        onResume={resume}
        onReset={reset}
        onEmergency={triggerEmergency}
        onElevatedRisk={triggerElevated}
        onDeviceIssue={triggerDeviceFailure}
        onTrackingLost={triggerTrackingLost}
        onVitalsConcern={triggerVitalsConcern}
        onBedExit={triggerBedExit}
        onPatientChecked={markPatientChecked}
      />

      <div className='dashboard-grid'>
        <PatientStatusPanel data={data} onSelectPatient={selectPatient} />
        <EnvironmentPanel data={data} />
        <HealthSummaryPanel data={data} />
        <AlertsPanel
          data={data}
          backendAlerts={backendAlerts}
          enrichments={enrichments}
          onAcknowledge={acknowledgeAlert}
          onResolve={resolveAlert}
          onEscalate={escalateAlert}
        />
        <DevicesPanel data={data} />
        <PrivacyPanel data={data} />
        <RobotPanel
          data={data}
          onSendCommand={sendRobotCommand}
          onPatientOk={recordPatientResponseOk}
          onNoResponse={recordNoPatientResponse}
        />
        <AuditPanel data={data} />
      </div>

      <ObservationInputPanel
        error={jsonInputError}
        lastAcceptedAt={lastManualJsonAcceptedAt}
        selectedPatientId={selectedPatientId}
        selectedPatientLabel={`${data.patient.displayAlias} · ${data.patient.bedZone}`}
        latestObservation={latestObservation}
        onSubmit={submitObservationJson}
      />
    </main>
  );
}
