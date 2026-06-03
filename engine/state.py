"""Per-patient state for the rule/state engine.

Holds exactly what the snapshot rules in rules.py cannot compute on their own:

  * a short rolling history of metrics (for rate-of-change detection);
  * accumulated immobility time (mirrors the dashboard's deriveImmobileSeconds);
  * the patient's currently-active alert id + createdAt (for lifecycle / dedup).
"""

from __future__ import annotations

from collections import deque

from rules import IMMOBILE_THRESHOLD

DEFAULT_INTERVAL = 3.0
MIN_CHANGE_SPAN = 2.0  # need at least this much elapsed time to trust a delta


def seconds_between(current_epoch: float, previous_epoch: float | None) -> float:
    if previous_epoch is None:
        return DEFAULT_INTERVAL
    diff = current_epoch - previous_epoch
    return diff if 0 < diff < 60 else DEFAULT_INTERVAL


class PatientState:
    def __init__(self, window_seconds: float):
        self.window = window_seconds
        self.samples: deque[tuple[float, dict]] = deque()
        self.time_immobile = 0.0
        self.last_epoch: float | None = None
        self.last_alert: dict | None = None  # {"id": str, "createdAt": str}

    def update_immobility(self, motion_level: float, posture: str, epoch: float,
                          incoming_immobile: float | None) -> float:
        """Accumulate immobile seconds across frames, mirroring the dashboard."""
        interval = seconds_between(epoch, self.last_epoch)
        mobile_now = motion_level > IMMOBILE_THRESHOLD or posture == "standing"
        if mobile_now:
            self.time_immobile = 0.0
        elif self.last_epoch is None:
            self.time_immobile = max(incoming_immobile or 0.0, interval)
        else:
            self.time_immobile += interval
        return self.time_immobile

    def reference(self, epoch: float) -> tuple[float, dict] | None:
        """Oldest in-window sample to diff against, or None if too little history."""
        if not self.samples:
            return None
        ref_epoch, ref_metrics = self.samples[0]
        span = epoch - ref_epoch
        if span < MIN_CHANGE_SPAN:
            return None
        return span, ref_metrics

    def add_sample(self, epoch: float, metrics: dict) -> None:
        self.samples.append((epoch, metrics))
        cutoff = epoch - self.window
        while len(self.samples) > 1 and self.samples[0][0] < cutoff:
            self.samples.popleft()
        self.last_epoch = epoch

    def alert_lifecycle(self, alert_id: str, timestamp: str) -> str:
        """Return createdAt for this alert, preserving it across repeats."""
        if self.last_alert and self.last_alert["id"] == alert_id:
            created = self.last_alert["createdAt"]
        else:
            created = timestamp
        self.last_alert = {"id": alert_id, "createdAt": created}
        return created

    def clear_alert(self) -> None:
        self.last_alert = None


class RoomState:
    def __init__(self, window_seconds: float):
        self.window = window_seconds
        self.patients: dict[str, PatientState] = {}

    def get(self, patient_id: str) -> PatientState:
        if patient_id not in self.patients:
            self.patients[patient_id] = PatientState(self.window)
        return self.patients[patient_id]
