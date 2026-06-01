import { useEffect, useMemo, useState } from 'react';
import { observationForSelectedPatient, type Scenario } from '../lib/mockObservations';
import type { IncomingPatient, IncomingRoomState } from '../types/incoming';
import { Panel } from './common';

function pretty(value: unknown) {
  return JSON.stringify(value, null, 2);
}

type LoadedSample = 'Emergency sample' | 'Normal sample' | 'Tracking-loss sample' | 'Custom input';

type SinglePatientObservation = {
  roomId: string;
  timestamp: string;
  patient: IncomingPatient;
};

function selectedPatientObservation(room: IncomingRoomState, selectedPatientId: string): SinglePatientObservation {
  const selected = room.patients.find((patient) => patient.patientId === selectedPatientId) ?? room.patients[0];

  return {
    roomId: room.roomId,
    timestamp: room.timestamp,
    patient: selected,
  };
}

export function ObservationInputPanel({
  error,
  lastAcceptedAt,
  selectedPatientId,
  selectedPatientLabel,
  latestObservation,
  onSubmit,
}: {
  error: string | null;
  lastAcceptedAt: string | null;
  selectedPatientId: string;
  selectedPatientLabel: string;
  latestObservation: IncomingRoomState;
  onSubmit: (jsonText: string) => boolean;
}) {
  const selectedJson = useMemo(
    () => pretty(selectedPatientObservation(latestObservation, selectedPatientId)),
    [latestObservation, selectedPatientId],
  );

  const [jsonText, setJsonText] = useState(selectedJson);
  const [jsonVisible, setJsonVisible] = useState(false);
  const [loadedSample, setLoadedSample] = useState<LoadedSample>('Custom input');
  const [localStatus, setLocalStatus] = useState<string>('Select a patient above, load a sample if needed, then ingest only that patient observation.');
  const [customEditing, setCustomEditing] = useState(false);

  useEffect(() => {
    if (!customEditing) setJsonText(selectedJson);
  }, [customEditing, selectedJson]);

  const characterCount = useMemo(() => jsonText.length, [jsonText]);

  function loadSample(label: LoadedSample, scenario: Scenario) {
    const room = observationForSelectedPatient(selectedPatientId, scenario);
    setLoadedSample(label);
    setCustomEditing(false);
    setJsonText(pretty(selectedPatientObservation(room, selectedPatientId)));
    setLocalStatus(`${label} loaded for ${selectedPatientLabel}. Open the JSON editor to inspect or edit it.`);
  }

  function submit() {
    const ok = onSubmit(jsonText);
    setCustomEditing(false);
    setLocalStatus(ok ? `${loadedSample} accepted and processed for ${selectedPatientLabel}.` : 'Observation rejected. Check validation error below.');
  }

  return (
    <Panel title='Patient Observation JSON Input' subtitle={`Manual test input for ${selectedPatientLabel}`}>
      <div className='json-toolbar'>
        <button type='button' onClick={() => loadSample('Normal sample', 'normal')}>Load normal sample</button>
        <button type='button' onClick={() => loadSample('Emergency sample', 'fall')}>Load emergency sample</button>
        <button type='button' onClick={() => loadSample('Tracking-loss sample', 'trackingLost')}>Load tracking-loss sample</button>
        <button type='button' onClick={() => setJsonVisible((current) => !current)}>{jsonVisible ? `Hide JSON for ${selectedPatientLabel}` : `Show JSON for ${selectedPatientLabel}`}</button>
        <button type='button' className='danger-button' onClick={submit}>Ingest JSON</button>
      </div>

      {jsonVisible ? (
        <textarea
          className='json-input'
          value={jsonText}
          onChange={(event) => {
            setJsonText(event.target.value);
            setLoadedSample('Custom input');
            setCustomEditing(true);
          }}
          spellCheck={false}
          aria-label={`Patient observation JSON input for ${selectedPatientLabel}`}
        />
      ) : null}

      <div className='json-status'>
        <span>{localStatus}</span>
        <span>{loadedSample}</span>
        {jsonVisible ? <span>{characterCount} characters</span> : null}
        {lastAcceptedAt ? <span>Last accepted: {new Date(lastAcceptedAt).toLocaleTimeString()}</span> : null}
      </div>

      {error ? <div className='json-error'><strong>Validation error:</strong> {error}</div> : null}
    </Panel>
  );
}
