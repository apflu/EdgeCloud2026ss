#include "PatientCounter.h"

bool PatientCounter::begin() {
  is_ready = false;
  // Der Laser hat standardmäßig die I2C Adresse 0x29
  if (lox.begin()) {
    is_ready = true;
  } else {
    Serial.println("[WARNUNG] VL53L0X (Laser) nicht gefunden!");
  }
  
  last_distance_mm = -1; // -1 bedeutet Fehler oder "out of range"
  return is_ready;
}

void PatientCounter::update() {
  if (!is_ready) {
    last_distance_mm = -1;
    return;
  }

  VL53L0X_RangingMeasurementData_t measure;
  lox.rangingTest(&measure, false); // false = kein Debug-Spam
  
  if (measure.RangeStatus != 4) {  // 4 = Phase Fail (Kein Objekt getroffen)
    last_distance_mm = measure.RangeMilliMeter;
  } else {
    last_distance_mm = -1; // Nichts in Reichweite
  }
}

int PatientCounter::getDistance() {
  return last_distance_mm;
}