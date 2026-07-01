#include "PatientCounter.h"

// --- Debounce tuning (tune to your doorway/bed geometry) ---
// Hysteresis dead-band: enter "present" below ENTER, leave only above EXIT.
// The gap between them is what absorbs jitter around the threshold.
static const int PRESENT_ENTER_MM = 1500;
static const int PRESENT_EXIT_MM  = 1800;
// How many consecutive confirmed readings are required before the debounced
// state flips. Leaving is stricter than entering so brief occlusions don't
// drop a present patient.
static const uint8_t ENTER_SAMPLES = 3;
static const uint8_t EXIT_SAMPLES  = 5;

bool PatientCounter::begin() {
  is_ready = false;
  // Der Laser hat standardmäßig die I2C Adresse 0x29
  if (lox.begin()) {
    is_ready = true;
  } else {
    Serial.println("[WARNUNG] VL53L0X (Laser) nicht gefunden!");
  }

  last_distance_mm = -1; // -1 bedeutet Fehler oder "out of range"
  present = false;
  enter_streak = 0;
  exit_streak = 0;
  count = 0;
  return is_ready;
}

void PatientCounter::update() {
  if (!is_ready) {
    last_distance_mm = -1;
    return; // hold debounced state; a dead sensor is not "patient left"
  }

  VL53L0X_RangingMeasurementData_t measure;
  lox.rangingTest(&measure, false); // false = kein Debug-Spam

  // Only status 0 is a trustworthy range. Any other status (4 = phase fail,
  // plus sigma/signal/min-range failures) is a drop-out: treat it as "no new
  // information" and HOLD the debounced state instead of flipping to absent.
  // This alone removes most phantom counts, which came from momentary -1s.
  if (measure.RangeStatus != 0) {
    last_distance_mm = -1;
    return;
  }

  int dist = measure.RangeMilliMeter;
  last_distance_mm = dist;

  if (dist < PRESENT_ENTER_MM) {
    exit_streak = 0;
    if (!present && ++enter_streak >= ENTER_SAMPLES) {
      present = true;
      enter_streak = 0;
      count++; // one count per debounced arrival
    }
  } else if (dist > PRESENT_EXIT_MM) {
    enter_streak = 0;
    if (present && ++exit_streak >= EXIT_SAMPLES) {
      present = false;
      exit_streak = 0;
    }
  }
  // Inside the dead-band [ENTER..EXIT]: ambiguous — keep the current state and
  // do not advance either streak.
}

int PatientCounter::getDistance() {
  return last_distance_mm;
}

bool PatientCounter::isPresent() {
  return present;
}

unsigned long PatientCounter::getCount() {
  return count;
}

void PatientCounter::resetCount() {
  count = 0;
}
